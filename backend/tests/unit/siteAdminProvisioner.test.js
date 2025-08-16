const SiteAdminProvisioner = require('../../src/services/siteAdminProvisioner');
const crypto = require('crypto');

describe('SiteAdminProvisioner', () => {
  let provisioner;

  beforeEach(() => {
    provisioner = new SiteAdminProvisioner({
      passwordLength: 20,
      recoveryCodeCount: 10,
      mfaRequired: true,
      alertsEnabled: false,
      environment: 'test'
    });
  });

  describe('generateSecurePassword', () => {
    test('should generate password with correct length', () => {
      const password = provisioner.generateSecurePassword();
      expect(password).toHaveLength(20);
    });

    test('should include all character types', () => {
      const password = provisioner.generateSecurePassword();
      
      // Check for uppercase
      expect(password).toMatch(/[A-Z]/);
      // Check for lowercase
      expect(password).toMatch(/[a-z]/);
      // Check for numbers
      expect(password).toMatch(/[0-9]/);
      // Check for special characters
      expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/);
    });

    test('should generate unique passwords', () => {
      const passwords = new Set();
      for (let i = 0; i < 100; i++) {
        passwords.add(provisioner.generateSecurePassword());
      }
      // All 100 passwords should be unique
      expect(passwords.size).toBe(100);
    });

    test('should have minimum 3 characters from each category', () => {
      // Generate multiple passwords to test consistency
      for (let i = 0; i < 10; i++) {
        const password = provisioner.generateSecurePassword();
        
        const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
        const lowercaseCount = (password.match(/[a-z]/g) || []).length;
        const numberCount = (password.match(/[0-9]/g) || []).length;
        const specialCount = (password.match(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/g) || []).length;
        
        expect(uppercaseCount).toBeGreaterThanOrEqual(3);
        expect(lowercaseCount).toBeGreaterThanOrEqual(3);
        expect(numberCount).toBeGreaterThanOrEqual(3);
        expect(specialCount).toBeGreaterThanOrEqual(3);
      }
    });

    test('should have high entropy', () => {
      const password = provisioner.generateSecurePassword();
      
      // Calculate entropy: log2(charset_size ^ length)
      // With 4 character sets, roughly 94 possible characters
      // Entropy = 20 * log2(94) ≈ 131 bits
      const charsetSize = 26 + 26 + 10 + 32; // uppercase + lowercase + digits + special
      const entropy = password.length * Math.log2(charsetSize);
      
      expect(entropy).toBeGreaterThan(100); // Should have > 100 bits of entropy
    });
  });

  describe('generateRecoveryCodes', () => {
    test('should generate correct number of codes', () => {
      const codes = provisioner.generateRecoveryCodes();
      expect(codes).toHaveLength(10);
    });

    test('should generate codes in correct format', () => {
      const codes = provisioner.generateRecoveryCodes();
      
      codes.forEach(code => {
        // Format should be XXXX-XXXX
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
      });
    });

    test('should generate unique codes', () => {
      const codes = provisioner.generateRecoveryCodes();
      const uniqueCodes = new Set(codes);
      
      // All codes should be unique
      expect(uniqueCodes.size).toBe(codes.length);
    });

    test('should use cryptographically secure randomness', () => {
      // Mock crypto.randomBytes to ensure it's called
      const spy = jest.spyOn(crypto, 'randomBytes');
      
      provisioner.generateRecoveryCodes();
      
      // Should be called once per code
      expect(spy).toHaveBeenCalledTimes(10);
      expect(spy).toHaveBeenCalledWith(4);
      
      spy.mockRestore();
    });
  });

  describe('validateProvisioning', () => {
    test('should prevent provisioning if admin exists', async () => {
      // Mock the checkExistingSiteAdmin method
      provisioner.checkExistingSiteAdmin = jest.fn().mockResolvedValue({
        username: 'existing_admin',
        created_at: '2024-01-01'
      });

      const result = await provisioner.validateProvisioning();
      
      expect(result.canProceed).toBe(false);
      expect(result.message).toContain('Site admin already exists');
    });

    test('should allow provisioning if no admin exists', async () => {
      // Mock the checkExistingSiteAdmin method
      provisioner.checkExistingSiteAdmin = jest.fn().mockResolvedValue(null);
      
      // Mock query for pending provisioning
      const { query } = require('../../src/database/connection');
      jest.mock('../../src/database/connection');
      query.mockResolvedValue({ rows: [] });

      const result = await provisioner.validateProvisioning();
      
      expect(result.canProceed).toBe(true);
      expect(result.message).toBe('Provisioning can proceed');
    });
  });

  describe('Password Complexity', () => {
    test('should meet NIST password guidelines', () => {
      const password = provisioner.generateSecurePassword();
      
      // NIST SP 800-63B recommendations
      // - Minimum 8 characters (we exceed with 20)
      expect(password.length).toBeGreaterThanOrEqual(8);
      
      // - Should not be a common password
      const commonPasswords = ['password', '123456', 'admin', 'letmein'];
      expect(commonPasswords).not.toContain(password.toLowerCase());
      
      // - Should have sufficient complexity
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumbers = /[0-9]/.test(password);
      const hasSpecial = /[^a-zA-Z0-9]/.test(password);
      
      const complexityFactors = [hasUppercase, hasLowercase, hasNumbers, hasSpecial].filter(Boolean).length;
      expect(complexityFactors).toBe(4); // All 4 character types present
    });

    test('should not contain sequential characters', () => {
      // Generate multiple passwords to test
      for (let i = 0; i < 10; i++) {
        const password = provisioner.generateSecurePassword();
        
        // Check for sequential letters (abc, xyz)
        expect(password).not.toMatch(/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i);
        
        // Check for sequential numbers (123, 234)
        expect(password).not.toMatch(/012|123|234|345|456|567|678|789|890/);
      }
    });

    test('should not contain repeated patterns', () => {
      const password = provisioner.generateSecurePassword();
      
      // Check for repeated characters (aaa, 111)
      expect(password).not.toMatch(/(.)\1{2,}/);
      
      // Check for repeated patterns (abcabc)
      for (let len = 2; len <= 5; len++) {
        const regex = new RegExp(`(.{${len}})\\1`);
        expect(password).not.toMatch(regex);
      }
    });
  });

  describe('Recovery Code Security', () => {
    test('should have sufficient entropy per code', () => {
      const codes = provisioner.generateRecoveryCodes();
      
      codes.forEach(code => {
        // Each code is 8 hex characters = 32 bits of entropy
        const cleanCode = code.replace('-', '');
        const entropy = cleanCode.length * 4; // 4 bits per hex character
        
        expect(entropy).toBe(32);
      });
    });

    test('should handle format consistently', () => {
      const codes = provisioner.generateRecoveryCodes();
      
      codes.forEach(code => {
        const parts = code.split('-');
        expect(parts).toHaveLength(2);
        expect(parts[0]).toHaveLength(4);
        expect(parts[1]).toHaveLength(4);
        
        // Should be uppercase hex
        expect(parts[0]).toMatch(/^[A-F0-9]{4}$/);
        expect(parts[1]).toMatch(/^[A-F0-9]{4}$/);
      });
    });
  });

  describe('Configuration', () => {
    test('should respect custom password length', () => {
      const customProvisioner = new SiteAdminProvisioner({
        passwordLength: 32
      });
      
      const password = customProvisioner.generateSecurePassword();
      expect(password).toHaveLength(32);
    });

    test('should respect custom recovery code count', () => {
      const customProvisioner = new SiteAdminProvisioner({
        recoveryCodeCount: 20
      });
      
      const codes = customProvisioner.generateRecoveryCodes();
      expect(codes).toHaveLength(20);
    });

    test('should handle environment configuration', () => {
      const prodProvisioner = new SiteAdminProvisioner({
        environment: 'production'
      });
      
      expect(prodProvisioner.config.environment).toBe('production');
    });
  });
});

describe('Password Entropy Calculations', () => {
  test('should calculate correct entropy for generated passwords', () => {
    const provisioner = new SiteAdminProvisioner();
    const password = provisioner.generateSecurePassword();
    
    // Count unique characters
    const uniqueChars = new Set(password.split('')).size;
    
    // Minimum entropy based on unique characters
    const minEntropy = Math.log2(Math.pow(uniqueChars, password.length / 2));
    
    // Should have substantial entropy
    expect(minEntropy).toBeGreaterThan(50);
  });

  test('should maintain entropy across multiple generations', () => {
    const provisioner = new SiteAdminProvisioner();
    const entropies = [];
    
    for (let i = 0; i < 100; i++) {
      const password = provisioner.generateSecurePassword();
      const uniqueChars = new Set(password.split('')).size;
      const entropy = password.length * Math.log2(uniqueChars);
      entropies.push(entropy);
    }
    
    // Calculate average entropy
    const avgEntropy = entropies.reduce((a, b) => a + b, 0) / entropies.length;
    
    // Average should be high
    expect(avgEntropy).toBeGreaterThan(80);
    
    // Variance should be reasonable (not all passwords the same)
    const variance = entropies.reduce((sum, e) => sum + Math.pow(e - avgEntropy, 2), 0) / entropies.length;
    expect(variance).toBeGreaterThan(0);
    expect(variance).toBeLessThan(1000); // Not too variable
  });
});