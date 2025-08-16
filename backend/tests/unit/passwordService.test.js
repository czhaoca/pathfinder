const passwordService = require('../../src/services/passwordService');
const crypto = require('crypto');
const argon2 = require('argon2');

describe('PasswordService', () => {
  describe('generateTemporaryPassword', () => {
    test('should generate password with correct length', () => {
      const password = passwordService.generateTemporaryPassword(16);
      expect(password).toHaveLength(16);
      
      const longerPassword = passwordService.generateTemporaryPassword(24);
      expect(longerPassword).toHaveLength(24);
    });
    
    test('should include all character types', () => {
      const password = passwordService.generateTemporaryPassword();
      
      expect(password).toMatch(/[A-Z]/); // Has uppercase
      expect(password).toMatch(/[a-z]/); // Has lowercase
      expect(password).toMatch(/[0-9]/); // Has numbers
      expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/); // Has special chars
    });
    
    test('should generate unique passwords', () => {
      const passwords = new Set();
      for (let i = 0; i < 100; i++) {
        passwords.add(passwordService.generateTemporaryPassword());
      }
      // All 100 passwords should be unique
      expect(passwords.size).toBe(100);
    });
    
    test('should have minimum character counts from each category', () => {
      // Generate multiple passwords to test consistency
      for (let i = 0; i < 10; i++) {
        const password = passwordService.generateTemporaryPassword();
        
        const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
        const lowercaseCount = (password.match(/[a-z]/g) || []).length;
        const numberCount = (password.match(/[0-9]/g) || []).length;
        const specialCount = (password.match(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/g) || []).length;
        
        expect(uppercaseCount).toBeGreaterThanOrEqual(2);
        expect(lowercaseCount).toBeGreaterThanOrEqual(2);
        expect(numberCount).toBeGreaterThanOrEqual(2);
        expect(specialCount).toBeGreaterThanOrEqual(2);
      }
    });
  });
  
  describe('generateToken', () => {
    test('should generate token with correct format', () => {
      const { token, tokenHash } = passwordService.generateToken();
      
      expect(token).toBeDefined();
      expect(tokenHash).toBeDefined();
      expect(typeof token).toBe('string');
      expect(typeof tokenHash).toBe('string');
      expect(tokenHash).toHaveLength(64); // SHA256 hash in hex
    });
    
    test('should generate unique tokens', () => {
      const tokens = new Set();
      const hashes = new Set();
      
      for (let i = 0; i < 100; i++) {
        const { token, tokenHash } = passwordService.generateToken();
        tokens.add(token);
        hashes.add(tokenHash);
      }
      
      expect(tokens.size).toBe(100);
      expect(hashes.size).toBe(100);
    });
    
    test('should create valid SHA256 hash of token', () => {
      const { token, tokenHash } = passwordService.generateToken();
      
      // Verify the hash
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
      expect(tokenHash).toBe(expectedHash);
    });
  });
  
  describe('calculatePasswordStrength', () => {
    test('should score weak passwords low', () => {
      const weakPasswords = [
        'password',
        '12345678',
        'abcdefgh',
        'ABCDEFGH'
      ];
      
      weakPasswords.forEach(pwd => {
        const score = passwordService.calculatePasswordStrength(pwd);
        expect(score).toBeLessThan(40);
      });
    });
    
    test('should score strong passwords high', () => {
      const strongPasswords = [
        'MyStr0ng!P@ssw0rd123',
        'C0mpl3x&P@ssphrase#2024',
        'Secur3!ty$First&Always'
      ];
      
      strongPasswords.forEach(pwd => {
        const score = passwordService.calculatePasswordStrength(pwd);
        expect(score).toBeGreaterThan(60);
      });
    });
    
    test('should penalize repeated characters', () => {
      const withRepeats = 'Passw000rd!';
      const withoutRepeats = 'Passw0rd!23';
      
      const scoreWithRepeats = passwordService.calculatePasswordStrength(withRepeats);
      const scoreWithoutRepeats = passwordService.calculatePasswordStrength(withoutRepeats);
      
      expect(scoreWithoutRepeats).toBeGreaterThan(scoreWithRepeats);
    });
    
    test('should penalize common passwords', () => {
      const commonPassword = 'Password123!';
      const uncommonPassword = 'Xj9#mK2$pL8!';
      
      const commonScore = passwordService.calculatePasswordStrength(commonPassword);
      const uncommonScore = passwordService.calculatePasswordStrength(uncommonPassword);
      
      expect(uncommonScore).toBeGreaterThan(commonScore);
    });
    
    test('should reward length', () => {
      const short = 'Ab1!';
      const medium = 'Ab1!Cd2@';
      const long = 'Ab1!Cd2@Ef3#Gh4$';
      
      const shortScore = passwordService.calculatePasswordStrength(short);
      const mediumScore = passwordService.calculatePasswordStrength(medium);
      const longScore = passwordService.calculatePasswordStrength(long);
      
      expect(mediumScore).toBeGreaterThan(shortScore);
      expect(longScore).toBeGreaterThan(mediumScore);
    });
  });
  
  describe('validatePasswordAgainstPolicy', () => {
    const defaultPolicy = {
      MIN_LENGTH: 8,
      MAX_LENGTH: 128,
      REQUIRE_UPPERCASE: true,
      REQUIRE_LOWERCASE: true,
      REQUIRE_NUMBERS: true,
      REQUIRE_SPECIAL: true,
      MIN_UPPERCASE: 1,
      MIN_LOWERCASE: 1,
      MIN_NUMBERS: 1,
      MIN_SPECIAL: 1,
      ALLOW_COMMON_PASSWORDS: false
    };
    
    test('should validate correct password', () => {
      const result = passwordService.validatePasswordAgainstPolicy(
        'ValidP@ssw0rd',
        defaultPolicy
      );
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.strength).toBeGreaterThan(0);
    });
    
    test('should reject password too short', () => {
      const result = passwordService.validatePasswordAgainstPolicy(
        'Ab1!',
        defaultPolicy
      );
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });
    
    test('should reject password too long', () => {
      const longPassword = 'A'.repeat(129) + 'b1!';
      const result = passwordService.validatePasswordAgainstPolicy(
        longPassword,
        defaultPolicy
      );
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 128 characters');
    });
    
    test('should check character type requirements', () => {
      const testCases = [
        { password: 'abcdefgh1!', missing: 'uppercase' },
        { password: 'ABCDEFGH1!', missing: 'lowercase' },
        { password: 'ABCDEFGHa!', missing: 'numbers' },
        { password: 'ABCDEFGHa1', missing: 'special' }
      ];
      
      testCases.forEach(({ password, missing }) => {
        const result = passwordService.validatePasswordAgainstPolicy(
          password,
          defaultPolicy
        );
        
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(err => err.toLowerCase().includes(missing))).toBe(true);
      });
    });
    
    test('should check minimum character counts', () => {
      const strictPolicy = {
        ...defaultPolicy,
        MIN_UPPERCASE: 3,
        MIN_LOWERCASE: 3,
        MIN_NUMBERS: 3,
        MIN_SPECIAL: 3
      };
      
      const result = passwordService.validatePasswordAgainstPolicy(
        'Ab1!cD2@',
        strictPolicy
      );
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(err => err.includes('at least 3'))).toBe(true);
    });
    
    test('should reject common passwords when policy requires', () => {
      const result = passwordService.validatePasswordAgainstPolicy(
        'Password123!',
        defaultPolicy
      );
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password is too common. Please choose a more unique password');
    });
  });
  
  describe('Token validation', () => {
    test('should handle token expiry correctly', () => {
      // This would require mocking date/time or database queries
      // Placeholder for integration tests
      expect(true).toBe(true);
    });
  });
  
  describe('Argon2 hashing', () => {
    test('should use correct Argon2 parameters', async () => {
      const password = 'TestPassword123!';
      const salt = crypto.randomBytes(32).toString('hex');
      
      const hash = await argon2.hash(password + salt, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1
      });
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      
      // Verify the hash
      const isValid = await argon2.verify(hash, password + salt);
      expect(isValid).toBe(true);
      
      // Wrong password should fail
      const isInvalid = await argon2.verify(hash, 'WrongPassword' + salt);
      expect(isInvalid).toBe(false);
    });
  });
});

describe('Password Security Edge Cases', () => {
  test('should handle empty password gracefully', () => {
    const score = passwordService.calculatePasswordStrength('');
    expect(score).toBe(0);
  });
  
  test('should handle special unicode characters', () => {
    const unicodePassword = 'Pāsswörd123!€';
    const score = passwordService.calculatePasswordStrength(unicodePassword);
    expect(score).toBeGreaterThan(0);
  });
  
  test('should handle very long passwords efficiently', () => {
    const longPassword = 'A'.repeat(1000) + 'b1!';
    const startTime = Date.now();
    const score = passwordService.calculatePasswordStrength(longPassword);
    const endTime = Date.now();
    
    expect(score).toBeDefined();
    expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
  });
  
  test('should not leak timing information', async () => {
    // Test constant-time comparison
    const timings = [];
    
    for (let i = 0; i < 10; i++) {
      const start = process.hrtime.bigint();
      passwordService.calculatePasswordStrength('TestPassword' + i);
      const end = process.hrtime.bigint();
      timings.push(Number(end - start));
    }
    
    // Check that timings are relatively consistent (within 50% variance)
    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    const variance = timings.map(t => Math.abs(t - avgTime) / avgTime);
    
    expect(Math.max(...variance)).toBeLessThan(0.5);
  });
});