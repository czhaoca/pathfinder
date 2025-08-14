---
name: Security Feature
about: Implement security-related features or improvements
title: 'feat: [Security] Implement token-based password system with client-side hashing'
labels: security, enhancement, priority:critical, breaking-change, authentication
assignees: ''

---

## 📋 Description
Replace direct password transmission with a secure token-based password retrieval system. Implement client-side hashing before transmission and server-side Argon2 additional hashing. All new users receive system-generated temporary passwords retrieved via one-time tokens.

## 🎯 Acceptance Criteria
- [ ] Registration API no longer accepts passwords in request body
- [ ] System generates cryptographically secure temporary passwords (16+ characters)
- [ ] One-time tokens enable password retrieval (single use only)
- [ ] Temporary passwords expire 24 hours after retrieval
- [ ] Password reset tokens expire after 3 hours
- [ ] Client-side SHA256 hashing implemented before transmission
- [ ] Server-side Argon2id hashing applied to received hashes
- [ ] Password history tracking prevents reuse of last N passwords
- [ ] All password operations audit logged
- [ ] Plain text passwords never stored or logged anywhere

## 🔒 Security Considerations
- **Impact on existing security**: Complete elimination of plain text password transmission
- **New vulnerabilities mitigated**:
  - Man-in-the-middle password interception
  - Server-side password exposure in logs
  - Database breach plain text exposure
  - Password reuse attacks
- **Compliance requirements**:
  - HIPAA: Encryption of authentication credentials
  - GDPR: Secure processing of authentication data
  - PCI-DSS: Strong cryptography for password storage
  - NIST 800-63B: Password security guidelines

## 📊 Technical Implementation

### Database Changes
```sql
-- Password management tables from /database/security/authentication.sql

-- Current password storage with enhanced security
CREATE TABLE pf_user_passwords (
    user_id VARCHAR2(36) PRIMARY KEY,
    password_hash VARCHAR2(255) NOT NULL, -- Argon2id hash
    server_salt VARCHAR2(255) NOT NULL,
    client_salt VARCHAR2(255) NOT NULL,
    algorithm VARCHAR2(20) DEFAULT 'argon2id',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- For temporary passwords
    must_change NUMBER(1) DEFAULT 0,
    last_changed TIMESTAMP,
    change_count NUMBER(5) DEFAULT 0,
    password_version NUMBER(5) DEFAULT 1,
    strength_score NUMBER(3),
    FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
);

-- Password history for reuse prevention
CREATE TABLE pf_password_history (
    id VARCHAR2(36) PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    used_from TIMESTAMP NOT NULL,
    used_until TIMESTAMP NOT NULL,
    change_reason VARCHAR2(100),
    changed_by VARCHAR2(36),
    FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
);

-- One-time password tokens
CREATE TABLE pf_password_tokens (
    token_hash VARCHAR2(255) PRIMARY KEY, -- SHA256 hash
    user_id VARCHAR2(36) NOT NULL,
    token_type VARCHAR2(50) NOT NULL, -- retrieval, reset, force_reset
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_by VARCHAR2(36),
    reason VARCHAR2(500),
    ip_address VARCHAR2(45),
    user_agent VARCHAR2(500),
    FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE,
    CONSTRAINT chk_token_type CHECK (token_type IN ('retrieval', 'reset', 'force_reset'))
);

-- Indexes for performance
CREATE INDEX idx_pwd_tokens_user ON pf_password_tokens(user_id);
CREATE INDEX idx_pwd_tokens_expires ON pf_password_tokens(expires_at);
CREATE INDEX idx_pwd_history_user ON pf_password_history(user_id, used_from DESC);
```

### API Changes
```javascript
// backend/src/services/passwordService.js
const crypto = require('crypto');
const argon2 = require('argon2');

class PasswordService {
  // Generate secure temporary password
  generateTemporaryPassword() {
    const length = 16;
    const charset = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    
    let password = '';
    // Ensure at least 2 chars from each category
    Object.values(charset).forEach(chars => {
      for (let i = 0; i < 2; i++) {
        password += chars[crypto.randomInt(0, chars.length)];
      }
    });
    
    // Fill remaining with random mix
    const allChars = Object.values(charset).join('');
    while (password.length < length) {
      password += allChars[crypto.randomInt(0, allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => crypto.randomInt(-1, 2)).join('');
  }
  
  // Generate one-time token
  generateToken() {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, tokenHash };
  }
  
  // Store password with dual hashing
  async storePassword(userId, clientHash, clientSalt) {
    const serverSalt = crypto.randomBytes(32).toString('hex');
    
    // Apply Argon2 to the client hash
    const finalHash = await argon2.hash(clientHash + serverSalt, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
    
    // Store in database
    await db.query(`
      INSERT INTO pf_user_passwords 
      (user_id, password_hash, server_salt, client_salt, expires_at, must_change)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, finalHash, serverSalt, clientSalt, 
        new Date(Date.now() + 24*60*60*1000), // 24 hours
        true]);
    
    return true;
  }
  
  // Verify password with dual hashing
  async verifyPassword(userId, clientHash, clientSalt) {
    const pwd = await db.query(
      'SELECT * FROM pf_user_passwords WHERE user_id = ?',
      [userId]
    );
    
    if (!pwd) return false;
    
    // Check expiry
    if (pwd.expires_at && new Date() > pwd.expires_at) {
      throw new Error('Password expired');
    }
    
    // Verify the hash
    const valid = await argon2.verify(
      pwd.password_hash,
      clientHash + pwd.server_salt
    );
    
    if (valid && pwd.must_change) {
      throw new Error('Password change required');
    }
    
    return valid;
  }
}

// backend/src/routes/auth.js
router.post('/register', async (req, res) => {
  const { username, email, firstName, lastName, role } = req.body;
  
  // NO PASSWORD IN REQUEST
  if (req.body.password) {
    return res.status(400).json({
      success: false,
      message: 'Password should not be sent in registration'
    });
  }
  
  // Create user
  const userId = await createUser({ username, email, firstName, lastName });
  
  // Generate temporary password
  const tempPassword = passwordService.generateTemporaryPassword();
  
  // Hash it for storage (server generates its own salt)
  const tempHash = crypto.createHash('sha256')
    .update(tempPassword + 'temp_salt')
    .digest('hex');
  await passwordService.storePassword(userId, tempHash, 'temp_salt');
  
  // Generate retrieval token
  const { token, tokenHash } = passwordService.generateToken();
  
  // Store token (expires in 1 hour)
  await db.query(`
    INSERT INTO pf_password_tokens 
    (token_hash, user_id, token_type, expires_at, created_by)
    VALUES (?, ?, 'retrieval', ?, ?)
  `, [tokenHash, userId, new Date(Date.now() + 60*60*1000), req.user.id]);
  
  // Log the action
  await auditLog('user_created', userId, req.user.id);
  
  res.json({
    success: true,
    data: {
      user: { id: userId, username, email },
      password_token: token,
      token_expires_at: new Date(Date.now() + 60*60*1000)
    }
  });
});

router.post('/password/retrieve', async (req, res) => {
  const { password_token } = req.body;
  
  // Hash the provided token
  const tokenHash = crypto.createHash('sha256')
    .update(password_token)
    .digest('hex');
  
  // Find and validate token
  const tokenRecord = await db.query(
    'SELECT * FROM pf_password_tokens WHERE token_hash = ? AND used_at IS NULL',
    [tokenHash]
  );
  
  if (!tokenRecord || new Date() > tokenRecord.expires_at) {
    return res.status(404).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
  
  // Mark token as used
  await db.query(
    'UPDATE pf_password_tokens SET used_at = ? WHERE token_hash = ?',
    [new Date(), tokenHash]
  );
  
  // Get user details
  const user = await getUser(tokenRecord.user_id);
  
  // Generate the temporary password (this would be retrieved, not regenerated)
  const tempPassword = await getStoredTempPassword(tokenRecord.user_id);
  
  // Audit log
  await auditLog('password_retrieved', tokenRecord.user_id, null, req.ip);
  
  res.json({
    success: true,
    data: {
      username: user.username,
      temporary_password: tempPassword,
      expires_at: new Date(Date.now() + 24*60*60*1000),
      must_change: true
    }
  });
});

router.post('/login', async (req, res) => {
  const { username, password_hash, client_salt } = req.body;
  
  // NO PLAIN PASSWORD
  if (req.body.password) {
    return res.status(400).json({
      success: false,
      message: 'Plain text password not accepted'
    });
  }
  
  const user = await getUserByUsername(username);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
  
  try {
    const valid = await passwordService.verifyPassword(
      user.id,
      password_hash,
      client_salt
    );
    
    if (!valid) {
      await auditLog('login_failed', user.id, null, req.ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT
    const token = generateJWT(user);
    await auditLog('login_success', user.id, null, req.ip);
    
    res.json({
      success: true,
      data: { user, token }
    });
    
  } catch (error) {
    if (error.message === 'Password change required') {
      return res.status(403).json({
        success: false,
        message: 'Password change required',
        must_change_password: true
      });
    }
    throw error;
  }
});
```

### Configuration
```yaml
# Environment variables (for default settings only)
PASSWORD_MIN_LENGTH=8
PASSWORD_TEMP_LENGTH=16
PASSWORD_HISTORY_COUNT=5
PASSWORD_EXPIRY_DAYS=90
TOKEN_RETRIEVAL_EXPIRY_HOURS=1
TOKEN_RESET_EXPIRY_HOURS=3
TEMP_PASSWORD_EXPIRY_HOURS=24

# Database configuration (pf_system_config)
password.min_length: 8
password.require_uppercase: true
password.require_lowercase: true
password.require_numbers: true
password.require_special: true
password.temp_expiry_hours: 24
password.reset_token_expiry_hours: 3
```

### Frontend Implementation
```javascript
// frontend/src/utils/crypto.js
export class PasswordHasher {
  static async hashPassword(password) {
    // Generate client salt
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const saltHex = Array.from(salt)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Hash password with salt
    const encoder = new TextEncoder();
    const data = encoder.encode(password + saltHex);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Clear password from memory
    password = null;
    
    return {
      hash: hashHex,
      salt: saltHex
    };
  }
}

// frontend/src/components/LoginForm.jsx
import { PasswordHasher } from '../utils/crypto';

function LoginForm() {
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const username = usernameRef.current.value;
    const password = passwordRef.current.value;
    
    // Hash password client-side
    const { hash, salt } = await PasswordHasher.hashPassword(password);
    
    // Clear password field immediately
    passwordRef.current.value = '';
    
    // Send hashed password to server
    const response = await api.post('/auth/login', {
      username,
      password_hash: hash,
      client_salt: salt
    });
    
    // Never send plain password
    // Never store password in state
    // Never log password
  };
}
```

## 🧪 Testing Requirements
- [ ] Unit tests for password generation (entropy, complexity)
- [ ] Unit tests for token generation and validation
- [ ] Unit tests for dual hashing (client + server)
- [ ] Integration tests for complete registration flow
- [ ] Integration tests for password retrieval via token
- [ ] Integration tests for password history checking
- [ ] Security tests for timing attacks
- [ ] Security tests for token reuse prevention
- [ ] Load tests for Argon2 performance
- [ ] E2E tests for password reset flow

### Test Cases
```javascript
describe('Password Security', () => {
  test('Generated passwords meet complexity requirements', () => {
    const pwd = generateTemporaryPassword();
    expect(pwd.length).toBeGreaterThanOrEqual(16);
    expect(pwd).toMatch(/[A-Z]/);
    expect(pwd).toMatch(/[a-z]/);
    expect(pwd).toMatch(/[0-9]/);
    expect(pwd).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/);
  });
  
  test('Tokens are single-use only', async () => {
    const token = await createPasswordToken(userId);
    const pwd1 = await retrievePassword(token);
    expect(pwd1).toBeDefined();
    
    await expect(retrievePassword(token)).rejects.toThrow('Token already used');
  });
  
  test('Passwords expire after 24 hours', async () => {
    const userId = await createUser();
    // Fast-forward 25 hours
    jest.advanceTimersByTime(25 * 60 * 60 * 1000);
    
    await expect(login(userId, hash)).rejects.toThrow('Password expired');
  });
  
  test('Password history prevents reuse', async () => {
    const oldHash = await getCurrentPasswordHash(userId);
    await changePassword(userId, newHash);
    
    await expect(changePassword(userId, oldHash))
      .rejects.toThrow('Password was recently used');
  });
});
```

## 📚 Documentation Updates
- [ ] Update API documentation to show password_hash instead of password
- [ ] Document client-side hashing implementation guide
- [ ] Create password security best practices guide
- [ ] Update user registration flow documentation
- [ ] Document token retrieval process
- [ ] Add troubleshooting for common password issues
- [ ] Create migration guide for existing passwords

## ⚠️ Breaking Changes
**MAJOR Breaking Change**: Complete change in password handling

### Migration Strategy:
1. **Phase 1**: Deploy new password tables alongside existing
2. **Phase 2**: Update APIs to support both old and new methods
3. **Phase 3**: Migrate existing users' passwords on next login
4. **Phase 4**: Force password reset for users who haven't logged in
5. **Phase 5**: Remove old password system after all users migrated

### Backwards Compatibility:
```javascript
// Temporary dual support during migration
router.post('/login', async (req, res) => {
  if (req.body.password) {
    // Old method - to be removed
    console.warn('Legacy password login used');
    return handleLegacyLogin(req, res);
  }
  
  // New method
  return handleSecureLogin(req, res);
});
```

## 🔗 Dependencies
- Depends on: #8 (RBAC system for roles)
- Blocks: 
  - #10 (Site admin provisioning needs password system)
  - #18 (Frontend password hashing implementation)

## 📈 Success Metrics
- **Security Metrics:**
  - Zero plain text passwords in logs
  - 100% of passwords dual-hashed
  - Zero password reuse within history limit
  - All password operations audit logged
  
- **Performance Benchmarks:**
  - Password hashing < 100ms
  - Token generation < 10ms
  - Login process < 500ms total
  - Argon2 memory usage < 64MB per operation
  
- **User Experience:**
  - Password reset success rate > 95%
  - Token retrieval success rate > 99%
  - Average time to first login < 5 minutes
  
- **Security Audit Requirements:**
  - Pass OWASP password security checklist
  - No timing attack vulnerabilities
  - Cryptographically secure randomness verified
  - Complete audit trail for all password events

## 🏃 Implementation Checklist

### Backend Tasks:
- [ ] Create password tables migration
- [ ] Implement password generation service
- [ ] Implement token management service
- [ ] Add Argon2 hashing layer
- [ ] Update authentication endpoints
- [ ] Add password history tracking
- [ ] Implement audit logging for all operations
- [ ] Create password expiry job

### Frontend Tasks:
- [ ] Implement client-side SHA256 hashing
- [ ] Update all password forms
- [ ] Add password strength indicator
- [ ] Create token retrieval UI
- [ ] Implement secure password storage practices
- [ ] Add password expiry warnings

### DevOps Tasks:
- [ ] Install Argon2 dependencies
- [ ] Configure password policy settings
- [ ] Set up password expiry monitoring
- [ ] Create backup for password migration
- [ ] Configure rate limiting for password endpoints

---

**Estimated Effort**: 13 story points
**Sprint**: 1 (Critical Security)
**Target Completion**: Week 2