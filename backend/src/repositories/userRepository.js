const oracledb = require('oracledb');
const logger = require('../utils/logger');

class UserRepository {
  constructor(database) {
    this.database = database;
  }

  async findByUsernameOrEmail(username, email) {
    const sql = `
      SELECT 
        RAWTOHEX(user_id) as user_id,
        username,
        email,
        password_hash,
        mfa_secret,
        schema_prefix,
        first_name,
        last_name,
        account_status,
        created_at,
        last_login
      FROM ${this.database.tablePrefix}users 
      WHERE username = :username OR email = :email
    `;
    
    const result = await this.database.executeQuery(sql, { username, email });
    return result.rows.length > 0 ? this.mapToUser(result.rows[0]) : null;
  }

  async findByUsername(username) {
    const sql = `
      SELECT 
        RAWTOHEX(user_id) as user_id,
        username,
        email,
        password_hash,
        mfa_secret,
        schema_prefix,
        first_name,
        last_name,
        account_status,
        created_at,
        last_login
      FROM ${this.database.tablePrefix}users 
      WHERE username = :username
    `;
    
    const result = await this.database.executeQuery(sql, { username });
    return result.rows.length > 0 ? this.mapToUser(result.rows[0]) : null;
  }

  async findById(userId) {
    const sql = `
      SELECT 
        RAWTOHEX(user_id) as user_id,
        username,
        email,
        schema_prefix,
        first_name,
        last_name,
        account_status,
        created_at,
        last_login
      FROM ${this.database.tablePrefix}users 
      WHERE user_id = HEXTORAW(:userId)
    `;
    
    const result = await this.database.executeQuery(sql, { userId });
    return result.rows.length > 0 ? this.mapToUser(result.rows[0]) : null;
  }

  async create(userData) {
    const schemaPrefix = `${this.database.schemaPrefix}${userData.username.toLowerCase()}`;
    
    const sql = `
      INSERT INTO ${this.database.tablePrefix}users (
        username, email, password_hash, schema_prefix, 
        first_name, last_name, created_at
      ) VALUES (
        :username, :email, :passwordHash, :schemaPrefix,
        :firstName, :lastName, CURRENT_TIMESTAMP
      ) RETURNING RAWTOHEX(user_id) INTO :userId
    `;
    
    const binds = {
      username: userData.username,
      email: userData.email,
      passwordHash: userData.passwordHash,
      schemaPrefix,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      userId: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
    };
    
    const result = await this.database.executeQuery(sql, binds, { autoCommit: true });
    
    return {
      userId: result.outBinds.userId,
      username: userData.username,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      schemaPrefix,
      accountStatus: 'active',
      createdAt: new Date()
    };
  }

  async updateLastLogin(userId) {
    const sql = `
      UPDATE ${this.database.tablePrefix}users 
      SET last_login = SYSTIMESTAMP 
      WHERE user_id = HEXTORAW(:userId)
    `;
    
    await this.database.executeQuery(sql, { userId }, { autoCommit: true });
  }

  async updateAccountStatus(userId, status) {
    const sql = `
      UPDATE ${this.database.tablePrefix}users 
      SET account_status = :status, updated_at = SYSTIMESTAMP 
      WHERE user_id = HEXTORAW(:userId)
    `;
    
    await this.database.executeQuery(sql, { userId, status }, { autoCommit: true });
  }

  async createUserSchema(schemaPrefix) {
    await this.database.createUserSpecificSchema(schemaPrefix);
  }

  async findByEmail(email) {
    const sql = `
      SELECT 
        RAWTOHEX(user_id) as user_id,
        username,
        email,
        password_hash,
        mfa_secret,
        schema_prefix,
        first_name,
        last_name,
        account_status,
        created_at,
        last_login
      FROM ${this.database.tablePrefix}users 
      WHERE email = :email
    `;
    
    const result = await this.database.executeQuery(sql, { email });
    return result.rows.length > 0 ? this.mapToUser(result.rows[0]) : null;
  }

  async updateProfile(userId, updates) {
    const updateFields = [];
    const binds = { userId };

    if (updates.firstName !== undefined) {
      updateFields.push('first_name = :firstName');
      binds.firstName = updates.firstName;
    }
    if (updates.lastName !== undefined) {
      updateFields.push('last_name = :lastName');
      binds.lastName = updates.lastName;
    }
    if (updates.email !== undefined) {
      updateFields.push('email = :email');
      binds.email = updates.email;
    }

    updateFields.push('updated_at = SYSTIMESTAMP');

    const sql = `
      UPDATE ${this.database.tablePrefix}users 
      SET ${updateFields.join(', ')}
      WHERE user_id = HEXTORAW(:userId)
    `;
    
    await this.database.executeQuery(sql, binds, { autoCommit: true });
  }

  async updatePassword(userId, passwordHash) {
    const sql = `
      UPDATE ${this.database.tablePrefix}users 
      SET password_hash = :passwordHash, 
          password_changed_at = SYSTIMESTAMP,
          updated_at = SYSTIMESTAMP
      WHERE user_id = HEXTORAW(:userId)
    `;
    
    await this.database.executeQuery(sql, { userId, passwordHash }, { autoCommit: true });
  }

  mapToUser(row) {
    return {
      userId: row.USER_ID,
      username: row.USERNAME,
      email: row.EMAIL,
      passwordHash: row.PASSWORD_HASH,
      mfaSecret: row.MFA_SECRET,
      schemaPrefix: row.SCHEMA_PREFIX,
      firstName: row.FIRST_NAME,
      lastName: row.LAST_NAME,
      accountStatus: row.ACCOUNT_STATUS,
      createdAt: row.CREATED_AT,
      lastLogin: row.LAST_LOGIN
    };
  }
}

module.exports = UserRepository;