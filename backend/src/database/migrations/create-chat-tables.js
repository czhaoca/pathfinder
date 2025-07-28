/**
 * Migration: Create Chat Tables
 * Creates tables for storing chat conversations and messages
 */

const logger = require('../../utils/logger');

async function up(database, tablePrefix = 'pf_') {
  try {
    // Create conversations table
    await database.executeQuery(`
      CREATE TABLE IF NOT EXISTS ${tablePrefix}conversations (
        conversation_id VARCHAR2(100) PRIMARY KEY,
        user_id VARCHAR2(100) NOT NULL,
        title VARCHAR2(500),
        first_message VARCHAR2(1000),
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_count NUMBER DEFAULT 0,
        is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_conv_user FOREIGN KEY (user_id) 
          REFERENCES ${tablePrefix}users(user_id) ON DELETE CASCADE
      )
    `);

    // Create messages table
    await database.executeQuery(`
      CREATE TABLE IF NOT EXISTS ${tablePrefix}messages (
        message_id VARCHAR2(100) PRIMARY KEY,
        conversation_id VARCHAR2(100) NOT NULL,
        user_id VARCHAR2(100) NOT NULL,
        role VARCHAR2(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content CLOB NOT NULL,
        metadata CLOB,
        token_count NUMBER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) 
          REFERENCES ${tablePrefix}conversations(conversation_id) ON DELETE CASCADE,
        CONSTRAINT fk_msg_user FOREIGN KEY (user_id) 
          REFERENCES ${tablePrefix}users(user_id) ON DELETE CASCADE
      )
    `);

    // Create conversation summaries table
    await database.executeQuery(`
      CREATE TABLE IF NOT EXISTS ${tablePrefix}conversation_summaries (
        summary_id VARCHAR2(100) PRIMARY KEY,
        conversation_id VARCHAR2(100) NOT NULL,
        summary_text CLOB,
        key_topics CLOB,
        action_items CLOB,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sum_conv FOREIGN KEY (conversation_id) 
          REFERENCES ${tablePrefix}conversations(conversation_id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await database.executeQuery(`
      CREATE INDEX idx_conv_user ON ${tablePrefix}conversations(user_id)
    `);

    await database.executeQuery(`
      CREATE INDEX idx_conv_active ON ${tablePrefix}conversations(is_active, last_message_at)
    `);

    await database.executeQuery(`
      CREATE INDEX idx_msg_conv ON ${tablePrefix}messages(conversation_id, created_at)
    `);

    await database.executeQuery(`
      CREATE INDEX idx_msg_user ON ${tablePrefix}messages(user_id)
    `);

    // Create triggers for updated_at
    await database.executeQuery(`
      CREATE OR REPLACE TRIGGER trg_conv_updated
      BEFORE UPDATE ON ${tablePrefix}conversations
      FOR EACH ROW
      BEGIN
        :NEW.updated_at := CURRENT_TIMESTAMP;
      END;
    `);

    logger.info('Chat tables created successfully');
  } catch (error) {
    logger.error('Failed to create chat tables', { error: error.message });
    throw error;
  }
}

async function down(database, tablePrefix = 'pf_') {
  try {
    // Drop triggers
    await database.executeQuery(`DROP TRIGGER IF EXISTS trg_conv_updated`);

    // Drop tables
    await database.executeQuery(`DROP TABLE IF EXISTS ${tablePrefix}conversation_summaries CASCADE CONSTRAINTS`);
    await database.executeQuery(`DROP TABLE IF EXISTS ${tablePrefix}messages CASCADE CONSTRAINTS`);
    await database.executeQuery(`DROP TABLE IF EXISTS ${tablePrefix}conversations CASCADE CONSTRAINTS`);

    logger.info('Chat tables dropped successfully');
  } catch (error) {
    logger.error('Failed to drop chat tables', { error: error.message });
    throw error;
  }
}

module.exports = { up, down };