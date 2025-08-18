/**
 * SSO Service
 * Manages Single Sign-On accounts and tokens for multiple providers
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { DatabaseError } = require('../utils/errors');

class SSOService {
  constructor(database) {
    this.database = database;
  }

  /**
   * Find SSO account by provider and provider user ID
   */
  async findByProvider(provider, providerUserId, connection = null) {
    const conn = connection || this.database;
    
    try {
      const result = await conn.execute(
        `SELECT * FROM pf_sso_accounts 
         WHERE provider = :provider AND provider_user_id = :providerUserId`,
        { provider, providerUserId }
      );

      if (result.rows && result.rows.length > 0) {
        return this.mapRowToSSOAccount(result.rows[0]);
      }

      return null;
    } catch (error) {
      logger.error('Error finding SSO account by provider', { error, provider, providerUserId });
      throw new DatabaseError('Failed to find SSO account');
    }
  }

  /**
   * Find SSO account by user ID and provider
   */
  async findByUserAndProvider(userId, provider, connection = null) {
    const conn = connection || this.database;
    
    try {
      const result = await conn.execute(
        `SELECT * FROM pf_sso_accounts 
         WHERE user_id = :userId AND provider = :provider`,
        { userId, provider }
      );

      if (result.rows && result.rows.length > 0) {
        return this.mapRowToSSOAccount(result.rows[0]);
      }

      return null;
    } catch (error) {
      logger.error('Error finding SSO account by user and provider', { error, userId, provider });
      throw new DatabaseError('Failed to find SSO account');
    }
  }

  /**
   * Get all SSO accounts for a user
   */
  async getUserProviders(userId, connection = null) {
    const conn = connection || this.database;
    
    try {
      const result = await conn.execute(
        `SELECT * FROM pf_sso_accounts 
         WHERE user_id = :userId 
         ORDER BY linked_at DESC`,
        { userId }
      );

      return result.rows.map(row => this.mapRowToSSOAccount(row));
    } catch (error) {
      logger.error('Error getting user providers', { error, userId });
      throw new DatabaseError('Failed to get user providers');
    }
  }

  /**
   * Get other providers for a user (excluding specified provider)
   */
  async getOtherProviders(userId, excludeProvider, connection = null) {
    const conn = connection || this.database;
    
    try {
      const result = await conn.execute(
        `SELECT * FROM pf_sso_accounts 
         WHERE user_id = :userId AND provider != :excludeProvider
         ORDER BY linked_at DESC`,
        { userId, excludeProvider }
      );

      return result.rows.map(row => this.mapRowToSSOAccount(row));
    } catch (error) {
      logger.error('Error getting other providers', { error, userId, excludeProvider });
      throw new DatabaseError('Failed to get other providers');
    }
  }

  /**
   * Create new SSO account
   */
  async create(ssoData, connection = null) {
    const conn = connection || this.database;
    const ssoAccountId = uuidv4();
    
    try {
      await conn.execute(
        `INSERT INTO pf_sso_accounts (
          sso_account_id, user_id, provider, provider_user_id,
          email, display_name, avatar_url,
          access_token, refresh_token, token_expires_at,
          profile_data, is_primary
        ) VALUES (
          :ssoAccountId, :userId, :provider, :providerUserId,
          :email, :displayName, :avatarUrl,
          :accessToken, :refreshToken, :tokenExpiresAt,
          :profileData, :isPrimary
        )`,
        {
          ssoAccountId,
          userId: ssoData.userId,
          provider: ssoData.provider,
          providerUserId: ssoData.providerUserId,
          email: ssoData.email,
          displayName: ssoData.displayName,
          avatarUrl: ssoData.avatarUrl,
          accessToken: ssoData.accessToken,
          refreshToken: ssoData.refreshToken,
          tokenExpiresAt: ssoData.tokenExpiresAt,
          profileData: JSON.stringify(ssoData.profileData || {}),
          isPrimary: ssoData.isPrimary ? 'Y' : 'N'
        }
      );

      return {
        id: ssoAccountId,
        ...ssoData
      };
    } catch (error) {
      logger.error('Error creating SSO account', { error, provider: ssoData.provider });
      throw new DatabaseError('Failed to create SSO account');
    }
  }

  /**
   * Update SSO tokens
   */
  async updateTokens(ssoAccountId, accessToken, refreshToken, expiresAt, connection = null) {
    const conn = connection || this.database;
    
    try {
      await conn.execute(
        `UPDATE pf_sso_accounts 
         SET access_token = :accessToken,
             refresh_token = :refreshToken,
             token_expires_at = :tokenExpiresAt,
             last_sync_at = CURRENT_TIMESTAMP
         WHERE sso_account_id = :ssoAccountId`,
        {
          ssoAccountId,
          accessToken,
          refreshToken,
          tokenExpiresAt: expiresAt ? new Date(expiresAt) : null
        }
      );

      return true;
    } catch (error) {
      logger.error('Error updating SSO tokens', { error, ssoAccountId });
      throw new DatabaseError('Failed to update SSO tokens');
    }
  }

  /**
   * Update user tokens by user ID and provider
   */
  async updateUserTokens(userId, provider, tokens, connection = null) {
    const conn = connection || this.database;
    
    try {
      await conn.execute(
        `UPDATE pf_sso_accounts 
         SET access_token = :accessToken,
             refresh_token = :refreshToken,
             last_sync_at = CURRENT_TIMESTAMP
         WHERE user_id = :userId AND provider = :provider`,
        {
          userId,
          provider,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token
        }
      );

      return true;
    } catch (error) {
      logger.error('Error updating user tokens', { error, userId, provider });
      throw new DatabaseError('Failed to update user tokens');
    }
  }

  /**
   * Update profile data from provider
   */
  async updateProfileData(ssoAccountId, profileData, connection = null) {
    const conn = connection || this.database;
    
    try {
      await conn.execute(
        `UPDATE pf_sso_accounts 
         SET profile_data = :profileData,
             last_sync_at = CURRENT_TIMESTAMP
         WHERE sso_account_id = :ssoAccountId`,
        {
          ssoAccountId,
          profileData: JSON.stringify(profileData)
        }
      );

      return true;
    } catch (error) {
      logger.error('Error updating profile data', { error, ssoAccountId });
      throw new DatabaseError('Failed to update profile data');
    }
  }

  /**
   * Remove provider from user
   */
  async removeProvider(userId, provider, connection = null) {
    const conn = connection || this.database;
    
    try {
      const result = await conn.execute(
        `DELETE FROM pf_sso_accounts 
         WHERE user_id = :userId AND provider = :provider`,
        { userId, provider }
      );

      return result.rowsAffected > 0;
    } catch (error) {
      logger.error('Error removing provider', { error, userId, provider });
      throw new DatabaseError('Failed to remove provider');
    }
  }

  /**
   * Set primary provider for user
   */
  async setPrimaryProvider(userId, provider, connection = null) {
    const conn = connection || this.database;
    
    try {
      // First, unset all primary flags
      await conn.execute(
        `UPDATE pf_sso_accounts 
         SET is_primary = 'N' 
         WHERE user_id = :userId`,
        { userId }
      );

      // Then set the specified provider as primary
      await conn.execute(
        `UPDATE pf_sso_accounts 
         SET is_primary = 'Y' 
         WHERE user_id = :userId AND provider = :provider`,
        { userId, provider }
      );

      return true;
    } catch (error) {
      logger.error('Error setting primary provider', { error, userId, provider });
      throw new DatabaseError('Failed to set primary provider');
    }
  }

  /**
   * Check if user has any SSO accounts
   */
  async hasSSO(userId, connection = null) {
    const conn = connection || this.database;
    
    try {
      const result = await conn.execute(
        `SELECT COUNT(*) as count FROM pf_sso_accounts 
         WHERE user_id = :userId`,
        { userId }
      );

      return result.rows[0].COUNT > 0;
    } catch (error) {
      logger.error('Error checking SSO accounts', { error, userId });
      throw new DatabaseError('Failed to check SSO accounts');
    }
  }

  /**
   * Get expired tokens that need refresh
   */
  async getExpiredTokens(connection = null) {
    const conn = connection || this.database;
    
    try {
      const result = await conn.execute(
        `SELECT * FROM pf_sso_accounts 
         WHERE token_expires_at < CURRENT_TIMESTAMP 
           AND refresh_token IS NOT NULL
         ORDER BY token_expires_at ASC`
      );

      return result.rows.map(row => this.mapRowToSSOAccount(row));
    } catch (error) {
      logger.error('Error getting expired tokens', { error });
      throw new DatabaseError('Failed to get expired tokens');
    }
  }

  /**
   * Clean up orphaned SSO accounts
   */
  async cleanupOrphanedAccounts(connection = null) {
    const conn = connection || this.database;
    
    try {
      const result = await conn.execute(
        `DELETE FROM pf_sso_accounts 
         WHERE user_id NOT IN (SELECT user_id FROM pf_users)`
      );

      if (result.rowsAffected > 0) {
        logger.info('Cleaned up orphaned SSO accounts', { count: result.rowsAffected });
      }

      return result.rowsAffected;
    } catch (error) {
      logger.error('Error cleaning up orphaned accounts', { error });
      throw new DatabaseError('Failed to cleanup orphaned accounts');
    }
  }

  /**
   * Map database row to SSO account object
   */
  mapRowToSSOAccount(row) {
    if (!row) return null;

    return {
      id: row.SSO_ACCOUNT_ID,
      userId: row.USER_ID,
      provider: row.PROVIDER,
      providerUserId: row.PROVIDER_USER_ID,
      email: row.EMAIL,
      displayName: row.DISPLAY_NAME,
      avatarUrl: row.AVATAR_URL,
      accessToken: row.ACCESS_TOKEN,
      refreshToken: row.REFRESH_TOKEN,
      tokenExpiresAt: row.TOKEN_EXPIRES_AT,
      profileData: row.PROFILE_DATA ? JSON.parse(row.PROFILE_DATA) : null,
      linkedAt: row.LINKED_AT,
      lastSyncAt: row.LAST_SYNC_AT,
      isPrimary: row.IS_PRIMARY === 'Y'
    };
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(connection = null) {
    const conn = connection || this.database;
    
    try {
      const result = await conn.execute(
        `SELECT 
          provider,
          COUNT(*) as user_count,
          COUNT(DISTINCT user_id) as unique_users,
          MIN(linked_at) as first_linked,
          MAX(linked_at) as last_linked
         FROM pf_sso_accounts
         GROUP BY provider
         ORDER BY user_count DESC`
      );

      return result.rows.map(row => ({
        provider: row.PROVIDER,
        userCount: row.USER_COUNT,
        uniqueUsers: row.UNIQUE_USERS,
        firstLinked: row.FIRST_LINKED,
        lastLinked: row.LAST_LINKED
      }));
    } catch (error) {
      logger.error('Error getting provider stats', { error });
      throw new DatabaseError('Failed to get provider statistics');
    }
  }
}

module.exports = SSOService;