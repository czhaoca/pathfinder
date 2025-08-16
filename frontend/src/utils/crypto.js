/**
 * Client-side password hashing utilities
 * Implements SHA-256 hashing with salt for secure password transmission
 */

export class PasswordHasher {
  /**
   * Generate a cryptographically secure salt
   * @returns {string} - Hex-encoded salt (64 characters)
   */
  static generateSalt() {
    const saltArray = new Uint8Array(32);
    crypto.getRandomValues(saltArray);
    return Array.from(saltArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Hash a password with SHA-256
   * @param {string} password - Plain text password
   * @param {string} salt - Optional salt (will generate if not provided)
   * @returns {Promise<{hash: string, salt: string}>} - Hash and salt
   */
  static async hashPassword(password, salt = null) {
    // Generate salt if not provided
    if (!salt) {
      salt = this.generateSalt();
    }

    // Combine password and salt
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);

    // Hash with SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Clear password from memory (best effort)
    password = null;

    return {
      hash: hashHex,
      salt: salt
    };
  }

  /**
   * Validate password complexity
   * @param {string} password - Password to validate
   * @returns {Object} - Validation result with score and feedback
   */
  static validatePassword(password) {
    const feedback = [];
    let score = 0;

    // Length checks
    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long');
    } else if (password.length < 12) {
      score += 10;
      feedback.push('Consider using a longer password (12+ characters recommended)');
    } else if (password.length < 16) {
      score += 20;
    } else {
      score += 30;
    }

    // Character type checks
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if (!hasLowercase) {
      feedback.push('Add lowercase letters');
    } else {
      score += 10;
    }

    if (!hasUppercase) {
      feedback.push('Add uppercase letters');
    } else {
      score += 10;
    }

    if (!hasNumbers) {
      feedback.push('Add numbers');
    } else {
      score += 10;
    }

    if (!hasSpecial) {
      feedback.push('Add special characters (!@#$%^&*...)');
    } else {
      score += 15;
    }

    // Pattern checks
    if (/(.)\1{2,}/.test(password)) {
      feedback.push('Avoid repeated characters');
      score -= 10;
    }

    if (/^[a-zA-Z]+$/.test(password)) {
      feedback.push('Don\'t use only letters');
      score -= 10;
    }

    if (/^[0-9]+$/.test(password)) {
      feedback.push('Don\'t use only numbers');
      score -= 10;
    }

    // Common patterns
    const commonPatterns = [
      'password', '123456', 'qwerty', 'admin', 'letmein',
      'welcome', 'monkey', 'dragon', 'master', 'superman'
    ];

    const lowerPassword = password.toLowerCase();
    if (commonPatterns.some(pattern => lowerPassword.includes(pattern))) {
      feedback.push('Avoid common words or patterns');
      score -= 20;
    }

    // Ensure score is between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Determine strength level
    let strength = 'weak';
    if (score >= 80) {
      strength = 'strong';
    } else if (score >= 60) {
      strength = 'good';
    } else if (score >= 40) {
      strength = 'fair';
    }

    return {
      score,
      strength,
      feedback,
      isValid: password.length >= 8 && hasLowercase && hasUppercase && hasNumbers && hasSpecial
    };
  }

  /**
   * Generate a secure random password
   * @param {number} length - Password length (default 16)
   * @returns {string} - Generated password
   */
  static generatePassword(length = 16) {
    const charset = {
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      numbers: '0123456789',
      special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };

    let password = '';
    
    // Ensure at least one character from each set
    Object.values(charset).forEach(chars => {
      const randomIndex = Math.floor(Math.random() * chars.length);
      password += chars[randomIndex];
    });

    // Fill the rest randomly
    const allChars = Object.values(charset).join('');
    for (let i = password.length; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * allChars.length);
      password += allChars[randomIndex];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Check if password has been exposed in data breaches
   * Uses the Have I Been Pwned API (k-anonymity model)
   * @param {string} password - Password to check
   * @returns {Promise<{exposed: boolean, count: number}>}
   */
  static async checkPasswordExposure(password) {
    try {
      // Hash the password with SHA-1 (required by HIBP API)
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      // Use k-anonymity: send only first 5 characters
      const prefix = hashHex.substring(0, 5);
      const suffix = hashHex.substring(5);

      // Check with Have I Been Pwned API
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      
      if (!response.ok) {
        console.error('Failed to check password exposure');
        return { exposed: false, count: 0, error: true };
      }

      const text = await response.text();
      const lines = text.split('\n');

      // Look for our suffix in the response
      for (const line of lines) {
        const [returnedSuffix, count] = line.split(':');
        if (returnedSuffix === suffix) {
          return { exposed: true, count: parseInt(count, 10) };
        }
      }

      return { exposed: false, count: 0 };
      
    } catch (error) {
      console.error('Error checking password exposure:', error);
      return { exposed: false, count: 0, error: true };
    }
  }

  /**
   * Estimate time to crack password
   * @param {string} password - Password to analyze
   * @returns {string} - Human-readable time estimate
   */
  static estimateCrackTime(password) {
    // Calculate entropy
    let charsetSize = 0;
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

    const combinations = Math.pow(charsetSize, password.length);
    
    // Assume 10 billion guesses per second (modern GPU)
    const guessesPerSecond = 10000000000;
    const seconds = combinations / (2 * guessesPerSecond); // Average case

    // Convert to human-readable format
    if (seconds < 1) return 'instantly';
    if (seconds < 60) return 'less than a minute';
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
    if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
    if (seconds < 31536000) return `${Math.round(seconds / 2592000)} months`;
    if (seconds < 315360000) return `${Math.round(seconds / 31536000)} years`;
    if (seconds < 3153600000) return `${Math.round(seconds / 315360000)} decades`;
    if (seconds < 31536000000) return `${Math.round(seconds / 3153600000)} centuries`;
    return 'thousands of years';
  }

  /**
   * Securely compare two strings (constant time)
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} - True if equal
   */
  static secureCompare(a, b) {
    if (a.length !== b.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Clear sensitive data from memory (best effort)
   * @param {...any} values - Values to clear
   */
  static clearMemory(...values) {
    values.forEach(value => {
      if (typeof value === 'string') {
        // For strings, we can't truly clear them, but we can null the reference
        value = null;
      } else if (value instanceof Uint8Array) {
        // For typed arrays, we can overwrite
        crypto.getRandomValues(value);
        value.fill(0);
      } else if (Array.isArray(value)) {
        // For arrays, clear each element
        value.forEach((_, i) => { value[i] = null; });
        value.length = 0;
      } else if (typeof value === 'object' && value !== null) {
        // For objects, clear all properties
        Object.keys(value).forEach(key => {
          value[key] = null;
          delete value[key];
        });
      }
    });
  }
}

/**
 * Password strength indicator component helper
 */
export class PasswordStrengthIndicator {
  static getColor(score) {
    if (score < 20) return '#dc2626'; // red-600
    if (score < 40) return '#ea580c'; // orange-600
    if (score < 60) return '#ca8a04'; // yellow-600
    if (score < 80) return '#65a30d'; // lime-600
    return '#16a34a'; // green-600
  }

  static getLabel(score) {
    if (score < 20) return 'Very Weak';
    if (score < 40) return 'Weak';
    if (score < 60) return 'Fair';
    if (score < 80) return 'Good';
    return 'Strong';
  }

  static getWidth(score) {
    return `${Math.max(10, score)}%`;
  }
}

/**
 * Token manager for password operations
 */
export class TokenManager {
  static STORAGE_KEY = 'password_tokens';

  /**
   * Store a password token temporarily
   * @param {string} token - Token to store
   * @param {string} type - Token type (retrieval, reset, etc.)
   * @param {Date} expiresAt - Expiration date
   */
  static storeToken(token, type, expiresAt) {
    const tokens = this.getTokens();
    tokens.push({
      token,
      type,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString()
    });
    
    // Store in sessionStorage (not localStorage for security)
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(tokens));
    
    // Clean up expired tokens
    this.cleanupExpiredTokens();
  }

  /**
   * Get all stored tokens
   * @returns {Array} - Array of tokens
   */
  static getTokens() {
    const stored = sessionStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Get a specific token by type
   * @param {string} type - Token type
   * @returns {Object|null} - Token object or null
   */
  static getToken(type) {
    const tokens = this.getTokens();
    const now = new Date();
    
    return tokens.find(t => 
      t.type === type && 
      new Date(t.expiresAt) > now
    ) || null;
  }

  /**
   * Remove a used token
   * @param {string} token - Token to remove
   */
  static removeToken(token) {
    const tokens = this.getTokens();
    const filtered = tokens.filter(t => t.token !== token);
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  /**
   * Clean up expired tokens
   */
  static cleanupExpiredTokens() {
    const tokens = this.getTokens();
    const now = new Date();
    const valid = tokens.filter(t => new Date(t.expiresAt) > now);
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(valid));
  }

  /**
   * Clear all tokens
   */
  static clearAllTokens() {
    sessionStorage.removeItem(this.STORAGE_KEY);
  }
}

export default PasswordHasher;