const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const { createWriteStream } = require('fs');

class ExportService {
  constructor(db) {
    this.db = db;
    this.exportPath = process.env.EXPORT_PATH || '/tmp/exports';
  }

  async exportUserData(userId) {
    try {
      console.log(`Starting data export for user ${userId}`);
      
      // Create export directory if it doesn't exist
      await fs.mkdir(this.exportPath, { recursive: true });

      // Generate unique export ID
      const exportId = crypto.randomUUID();
      const exportDir = path.join(this.exportPath, exportId);
      await fs.mkdir(exportDir, { recursive: true });

      // Collect all user data
      const userData = await this.collectUserData(userId);

      // Write data to JSON files
      await this.writeDataFiles(exportDir, userData);

      // Create archive
      const archivePath = await this.createArchive(exportDir, exportId);

      // Generate secure download URL
      const downloadUrl = await this.generateDownloadUrl(exportId, archivePath);

      // Update deletion queue with export info
      await this.db.execute(`
        UPDATE pf_user_deletion_queue 
        SET data_export_completed = 1,
            export_url = :url,
            export_expires_at = CURRENT_TIMESTAMP + INTERVAL '30' DAY
        WHERE user_id = :userId
      `, { url: downloadUrl, userId });

      // Clean up temporary directory
      await this.cleanupDirectory(exportDir);

      console.log(`Data export completed for user ${userId}`);
      return {
        exportId,
        downloadUrl,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };
    } catch (error) {
      console.error(`Failed to export data for user ${userId}:`, error);
      throw error;
    }
  }

  async collectUserData(userId) {
    const data = {
      metadata: {
        exportId: crypto.randomUUID(),
        userId: userId,
        exportDate: new Date().toISOString(),
        format: 'JSON',
        version: '1.0'
      },
      user: {},
      profile: {},
      sessions: [],
      roles: [],
      preferences: {},
      experiences: [],
      auditLog: [],
      customTables: {}
    };

    // Get user data
    const userResult = await this.db.execute(
      'SELECT * FROM pf_users WHERE id = :userId',
      { userId }
    );
    data.user = this.sanitizeUserData(userResult.rows[0]);

    // Get profile data
    const profileResult = await this.db.execute(
      'SELECT * FROM pf_user_profiles WHERE user_id = :userId',
      { userId }
    );
    data.profile = profileResult.rows[0] || {};

    // Get sessions
    const sessionsResult = await this.db.execute(
      'SELECT * FROM pf_user_sessions WHERE user_id = :userId ORDER BY created_at DESC',
      { userId }
    );
    data.sessions = sessionsResult.rows;

    // Get roles
    const rolesResult = await this.db.execute(`
      SELECT ur.*, r.role_name, r.description 
      FROM pf_user_roles ur
      JOIN pf_roles r ON ur.role_id = r.id
      WHERE ur.user_id = :userId
    `, { userId });
    data.roles = rolesResult.rows;

    // Get preferences
    const prefsResult = await this.db.execute(
      'SELECT * FROM pf_user_preferences WHERE user_id = :userId',
      { userId }
    );
    data.preferences = prefsResult.rows[0] || {};

    // Get audit log entries
    const auditResult = await this.db.execute(
      `SELECT * FROM pf_audit_log 
       WHERE user_id = :userId 
       ORDER BY created_at DESC
       FETCH FIRST 1000 ROWS ONLY`,
      { userId }
    );
    data.auditLog = auditResult.rows;

    // Get user-specific tables
    const userTables = await this.getUserTables(userId);
    for (const tableName of userTables) {
      const tableResult = await this.db.execute(`SELECT * FROM ${tableName}`);
      data.customTables[tableName] = tableResult.rows;
    }

    return data;
  }

  sanitizeUserData(user) {
    if (!user) return null;
    
    // Remove sensitive fields
    const sanitized = { ...user };
    delete sanitized.PASSWORD_HASH;
    delete sanitized.SALT;
    delete sanitized.MFA_SECRET;
    delete sanitized.RESET_TOKEN;
    delete sanitized.VERIFICATION_TOKEN;
    
    return sanitized;
  }

  async getUserTables(userId) {
    // Get username for table prefix
    const userResult = await this.db.execute(
      'SELECT username FROM pf_users WHERE id = :userId',
      { userId }
    );
    
    if (!userResult.rows || userResult.rows.length === 0) {
      return [];
    }

    const username = userResult.rows[0].USERNAME;
    const tablePrefix = `career_nav_${username.toLowerCase()}_`;

    // Get all tables with user prefix
    const tablesResult = await this.db.execute(`
      SELECT table_name 
      FROM user_tables 
      WHERE table_name LIKE :prefix
    `, { prefix: `${tablePrefix.toUpperCase()}%` });

    return tablesResult.rows.map(row => row.TABLE_NAME);
  }

  async writeDataFiles(exportDir, userData) {
    // Write main user data
    await fs.writeFile(
      path.join(exportDir, 'user.json'),
      JSON.stringify(userData.user, null, 2)
    );

    // Write profile data
    await fs.writeFile(
      path.join(exportDir, 'profile.json'),
      JSON.stringify(userData.profile, null, 2)
    );

    // Write sessions
    await fs.writeFile(
      path.join(exportDir, 'sessions.json'),
      JSON.stringify(userData.sessions, null, 2)
    );

    // Write roles
    await fs.writeFile(
      path.join(exportDir, 'roles.json'),
      JSON.stringify(userData.roles, null, 2)
    );

    // Write preferences
    await fs.writeFile(
      path.join(exportDir, 'preferences.json'),
      JSON.stringify(userData.preferences, null, 2)
    );

    // Write audit log
    await fs.writeFile(
      path.join(exportDir, 'audit_log.json'),
      JSON.stringify(userData.auditLog, null, 2)
    );

    // Write custom tables
    if (Object.keys(userData.customTables).length > 0) {
      const customTablesDir = path.join(exportDir, 'custom_tables');
      await fs.mkdir(customTablesDir, { recursive: true });
      
      for (const [tableName, tableData] of Object.entries(userData.customTables)) {
        await fs.writeFile(
          path.join(customTablesDir, `${tableName}.json`),
          JSON.stringify(tableData, null, 2)
        );
      }
    }

    // Write metadata
    await fs.writeFile(
      path.join(exportDir, 'metadata.json'),
      JSON.stringify(userData.metadata, null, 2)
    );

    // Create README
    const readme = `
# User Data Export

This archive contains all your personal data exported from Pathfinder.

## Contents

- **user.json**: Your basic user account information
- **profile.json**: Your profile details
- **sessions.json**: Your login session history
- **roles.json**: Your assigned roles and permissions
- **preferences.json**: Your application preferences
- **audit_log.json**: Activity log for your account
- **custom_tables/**: Your experience and career data
- **metadata.json**: Export information and metadata

## Data Format

All data is exported in JSON format for easy processing.

## Privacy Notice

This export contains your personal information. Please store it securely.

## Questions?

If you have questions about your data, please contact support.

---
Export Date: ${new Date().toISOString()}
Export ID: ${userData.metadata.exportId}
`;

    await fs.writeFile(
      path.join(exportDir, 'README.md'),
      readme
    );
  }

  async createArchive(exportDir, exportId) {
    const archivePath = path.join(this.exportPath, `${exportId}.zip`);
    const output = createWriteStream(archivePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`Archive created: ${archive.pointer()} bytes`);
        resolve(archivePath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(exportDir, false);
      archive.finalize();
    });
  }

  async generateDownloadUrl(exportId, archivePath) {
    // Generate secure token for download
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store download token in database
    await this.db.execute(`
      INSERT INTO pf_export_downloads (
        export_id, token, file_path, 
        created_at, expires_at, download_count
      ) VALUES (
        :exportId, :token, :filePath,
        CURRENT_TIMESTAMP, 
        CURRENT_TIMESTAMP + INTERVAL '30' DAY,
        0
      )
    `, {
      exportId,
      token,
      filePath: archivePath
    });

    // Return download URL
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/exports/download/${exportId}?token=${token}`;
  }

  async cleanupDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          await this.cleanupDirectory(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }
      await fs.rmdir(dirPath);
    } catch (error) {
      console.error(`Failed to cleanup directory ${dirPath}:`, error);
    }
  }

  async cleanupOldExports() {
    // Clean exports older than 30 days
    const expiredExports = await this.db.execute(`
      SELECT * FROM pf_export_downloads 
      WHERE expires_at < CURRENT_TIMESTAMP
    `);

    for (const exp of expiredExports.rows) {
      try {
        // Delete file
        await fs.unlink(exp.FILE_PATH);
        
        // Remove from database
        await this.db.execute(
          'DELETE FROM pf_export_downloads WHERE export_id = :exportId',
          { exportId: exp.EXPORT_ID }
        );
        
        console.log(`Cleaned up expired export: ${exp.EXPORT_ID}`);
      } catch (error) {
        console.error(`Failed to cleanup export ${exp.EXPORT_ID}:`, error);
      }
    }
  }

  async downloadExport(exportId, token) {
    // Verify token
    const result = await this.db.execute(`
      SELECT * FROM pf_export_downloads 
      WHERE export_id = :exportId 
      AND token = :token
      AND expires_at > CURRENT_TIMESTAMP
    `, { exportId, token });

    if (!result.rows || result.rows.length === 0) {
      throw new Error('Invalid or expired download link');
    }

    const exportRecord = result.rows[0];

    // Update download count
    await this.db.execute(`
      UPDATE pf_export_downloads 
      SET download_count = download_count + 1,
          last_downloaded_at = CURRENT_TIMESTAMP
      WHERE export_id = :exportId
    `, { exportId });

    // Return file path for streaming
    return exportRecord.FILE_PATH;
  }
}

module.exports = ExportService;