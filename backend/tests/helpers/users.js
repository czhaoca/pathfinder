const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('./database');

/**
 * Generate test users with different roles
 */
async function generateTestUsers() {
  const users = {
    siteAdmin: await createTestUser({ 
      username: 'site_admin_test',
      role: 'site_admin' 
    }),
    admin1: await createTestUser({ 
      username: 'admin1_test',
      role: 'admin' 
    }),
    admin2: await createTestUser({ 
      username: 'admin2_test',
      role: 'admin' 
    }),
    regularUser: await createTestUser({ 
      username: 'user_test',
      role: 'user' 
    }),
    user1: await createTestUser({ 
      username: 'user1_test',
      role: 'user' 
    }),
    user2: await createTestUser({ 
      username: 'user2_test',
      role: 'user' 
    })
  };

  return users;
}

/**
 * Create a single test user
 */
async function createTestUser(options = {}) {
  const defaults = {
    username: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: `test_${Date.now()}@example.com`,
    password: 'Test@Password123',
    first_name: 'Test',
    last_name: 'User',
    role: 'user',
    account_status: 'active'
  };

  const userData = { ...defaults, ...options };
  
  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(userData.password, salt);

  // Insert user
  const userId = crypto.randomUUID();
  await query(
    `INSERT INTO pf_users (
      id, username, email, password_hash, password_salt,
      first_name, last_name, account_status
    ) VALUES (:1, :2, :3, :4, :5, :6, :7, :8)`,
    [
      userId,
      userData.username,
      userData.email,
      passwordHash,
      salt,
      userData.first_name,
      userData.last_name,
      userData.account_status
    ]
  );

  // Assign role
  await query(
    `INSERT INTO pf_user_roles (user_id, role) VALUES (:1, :2)`,
    [userId, userData.role]
  );

  return {
    id: userId,
    username: userData.username,
    email: userData.email,
    password: userData.password,
    role: userData.role,
    first_name: userData.first_name,
    last_name: userData.last_name
  };
}

/**
 * Create user with retrieval token
 */
async function createUserWithToken() {
  const user = await createTestUser({ password: null });
  
  // Generate retrieval token
  const retrievalToken = crypto.randomBytes(32).toString('base64url');
  const hashedToken = crypto.createHash('sha256').update(retrievalToken).digest('hex');
  
  // Store token
  await query(
    `INSERT INTO pf_password_tokens (
      user_id, token, token_type, expires_at
    ) VALUES (:1, :2, :3, :4)`,
    [
      user.id,
      hashedToken,
      'retrieval',
      new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    ]
  );

  return {
    user,
    retrievalToken
  };
}

/**
 * Create user with temporary password
 */
async function createUserWithTempPassword() {
  const tempPassword = generateSecurePassword();
  const user = await createTestUser({ 
    password: tempPassword,
    must_change_password: true 
  });

  // Set password expiry
  await query(
    `UPDATE pf_users 
     SET must_change_password = 1,
         password_expires_at = :1
     WHERE id = :2`,
    [
      new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      user.id
    ]
  );

  return {
    ...user,
    tempPassword
  };
}

/**
 * Login as a test user and get token
 */
async function loginAs(userOrUsername) {
  let user;
  
  if (typeof userOrUsername === 'string') {
    // Fetch user by username
    user = await queryOne(
      `SELECT u.*, r.role 
       FROM pf_users u
       JOIN pf_user_roles r ON u.id = r.user_id
       WHERE u.username = :1`,
      [userOrUsername]
    );
  } else {
    user = userOrUsername;
  }

  if (!user) {
    throw new Error(`User not found: ${userOrUsername}`);
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      roles: [user.role]
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '15m' }
  );

  // Create session
  const sessionId = crypto.randomUUID();
  const refreshToken = crypto.randomBytes(32).toString('base64url');
  
  await query(
    `INSERT INTO pf_user_sessions (
      id, user_id, token, refresh_token, expires_at
    ) VALUES (:1, :2, :3, :4, :5)`,
    [
      sessionId,
      user.id,
      token,
      refreshToken,
      new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    ]
  );

  return token;
}

/**
 * Hash password with salt (client-side simulation)
 */
async function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto
    .createHash('sha256')
    .update(password + salt)
    .digest('hex');
  
  return { hash, salt };
}

/**
 * Generate secure password
 */
function generateSecurePassword() {
  const length = 16;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each required character type
  password += 'A'; // Uppercase
  password += 'a'; // Lowercase
  password += '1'; // Number
  password += '!'; // Special
  
  // Fill rest randomly
  for (let i = 4; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  // Shuffle password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Get user by ID
 */
async function getUser(userId) {
  return queryOne(
    `SELECT u.*, 
            (SELECT LISTAGG(role, ',') WITHIN GROUP (ORDER BY role)
             FROM pf_user_roles WHERE user_id = u.id) as roles
     FROM pf_users u 
     WHERE id = :1`,
    [userId]
  );
}

/**
 * Initiate user deletion
 */
async function initiateDeletion(userId) {
  const cancellationToken = crypto.randomBytes(32).toString('base64url');
  
  await query(
    `UPDATE pf_users 
     SET account_status = 'pending_deletion',
         deletion_scheduled_at = :1,
         deletion_reason = :2
     WHERE id = :3`,
    [
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      'User requested deletion',
      userId
    ]
  );

  return {
    userId,
    cancellationToken
  };
}

/**
 * Create multiple test users
 */
async function createTestUsers(count = 10) {
  const users = [];
  
  for (let i = 0; i < count; i++) {
    users.push(await createTestUser({
      username: `bulk_user_${i}`,
      email: `bulk${i}@example.com`
    }));
  }
  
  return users;
}

/**
 * Create user with PHI (Protected Health Information)
 */
async function createUserWithPHI() {
  const user = await createTestUser();
  
  // Add sensitive medical information
  await query(
    `UPDATE pf_users 
     SET bio = :1
     WHERE id = :2`,
    [
      'Patient with diabetes, hypertension. Medical record #12345',
      user.id
    ]
  );
  
  return user.id;
}

module.exports = {
  generateTestUsers,
  createTestUser,
  createUserWithToken,
  createUserWithTempPassword,
  loginAs,
  hashPassword,
  generateSecurePassword,
  getUser,
  initiateDeletion,
  createTestUsers,
  createUserWithPHI
};