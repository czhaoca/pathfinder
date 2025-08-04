/**
 * Chat and Conversation Tables
 */

async function createChatTables(db, prefix = 'pf_') {
  // Chat conversations table
  await db.execute(`
    CREATE TABLE ${prefix}chats (
      chat_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      title VARCHAR2(200),
      context VARCHAR2(50) DEFAULT 'general',
      metadata CLOB CHECK (metadata IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      CONSTRAINT ${prefix}fk_chat_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Chat messages table
  await db.execute(`
    CREATE TABLE ${prefix}chat_messages (
      message_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      chat_id VARCHAR2(26) NOT NULL,
      role VARCHAR2(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content CLOB NOT NULL,
      metadata CLOB CHECK (metadata IS JSON),
      tokens_used NUMBER(10),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_message_chat FOREIGN KEY (chat_id) 
        REFERENCES ${prefix}chats(chat_id) ON DELETE CASCADE
    )
  `);

  // Chat context attachments
  await db.execute(`
    CREATE TABLE ${prefix}chat_attachments (
      attachment_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      chat_id VARCHAR2(26) NOT NULL,
      attachment_type VARCHAR2(50) NOT NULL,
      reference_id VARCHAR2(26),
      metadata CLOB CHECK (metadata IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_attach_chat FOREIGN KEY (chat_id) 
        REFERENCES ${prefix}chats(chat_id) ON DELETE CASCADE
    )
  `);

  // AI tool usage tracking
  await db.execute(`
    CREATE TABLE ${prefix}ai_tool_usage (
      usage_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      message_id VARCHAR2(26),
      tool_name VARCHAR2(100) NOT NULL,
      parameters CLOB CHECK (parameters IS JSON),
      result CLOB CHECK (result IS JSON),
      tokens_used NUMBER(10),
      execution_time_ms NUMBER(10),
      status VARCHAR2(20) DEFAULT 'success',
      error_message VARCHAR2(1000),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_tool_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_tool_message FOREIGN KEY (message_id) 
        REFERENCES ${prefix}chat_messages(message_id) ON DELETE SET NULL
    )
  `);
}

module.exports = createChatTables;