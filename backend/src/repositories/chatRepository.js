/**
 * Chat Repository
 * Handles database operations for chat conversations and messages
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class ChatRepository {
  constructor(database) {
    this.database = database;
    this.tablePrefix = 'cn_';
  }

  /**
   * Create a new conversation
   */
  async createConversation(userId, title = null) {
    const conversationId = uuidv4();
    
    try {
      await this.database.executeQuery(
        `INSERT INTO ${this.tablePrefix}conversations 
         (conversation_id, user_id, title, is_active) 
         VALUES (:conversationId, :userId, :title, 'Y')`,
        {
          conversationId,
          userId,
          title
        }
      );
      
      return conversationId;
    } catch (error) {
      logger.error('Failed to create conversation', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId, userId) {
    try {
      const result = await this.database.executeQuery(
        `SELECT * FROM ${this.tablePrefix}conversations 
         WHERE conversation_id = :conversationId 
         AND user_id = :userId`,
        { conversationId, userId }
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get conversation', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(userId, limit = 50, offset = 0) {
    try {
      const result = await this.database.executeQuery(
        `SELECT conversation_id, title, first_message, last_message_at, 
                message_count, is_active, created_at
         FROM ${this.tablePrefix}conversations 
         WHERE user_id = :userId 
         AND is_active = 'Y'
         ORDER BY last_message_at DESC
         OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { userId, limit, offset }
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get user conversations', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update conversation metadata
   */
  async updateConversation(conversationId, updates) {
    const allowedFields = ['title', 'first_message', 'last_message_at', 'message_count'];
    const updateFields = [];
    const params = { conversationId };
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = :${key}`);
        params[key] = value;
      }
    }
    
    if (updateFields.length === 0) return;
    
    try {
      await this.database.executeQuery(
        `UPDATE ${this.tablePrefix}conversations 
         SET ${updateFields.join(', ')} 
         WHERE conversation_id = :conversationId`,
        params
      );
    } catch (error) {
      logger.error('Failed to update conversation', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(conversationId, userId, role, content, metadata = null) {
    const messageId = uuidv4();
    const tokenCount = this._estimateTokens(content);
    
    try {
      // Insert message
      await this.database.executeQuery(
        `INSERT INTO ${this.tablePrefix}messages 
         (message_id, conversation_id, user_id, role, content, metadata, token_count) 
         VALUES (:messageId, :conversationId, :userId, :role, :content, :metadata, :tokenCount)`,
        {
          messageId,
          conversationId,
          userId,
          role,
          content,
          metadata: metadata ? JSON.stringify(metadata) : null,
          tokenCount
        }
      );
      
      // Update conversation metadata
      const updates = {
        last_message_at: new Date(),
        message_count: this.database.raw(`message_count + 1`)
      };
      
      // Set first message if this is the first one
      if (role === 'user') {
        const conv = await this.getConversation(conversationId, userId);
        if (!conv.first_message) {
          updates.first_message = content.substring(0, 1000);
        }
      }
      
      await this.updateConversation(conversationId, updates);
      
      return {
        id: messageId,
        conversationId,
        role,
        content,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to add message', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId, userId, limit = 100, offset = 0) {
    try {
      // Verify user owns the conversation
      const conv = await this.getConversation(conversationId, userId);
      if (!conv) {
        throw new Error('Conversation not found');
      }
      
      const result = await this.database.executeQuery(
        `SELECT message_id as id, role, content, created_at as timestamp
         FROM ${this.tablePrefix}messages 
         WHERE conversation_id = :conversationId 
         ORDER BY created_at ASC
         OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { conversationId, limit, offset }
      );
      
      return result.rows.map(row => ({
        ...row,
        timestamp: new Date(row.timestamp)
      }));
    } catch (error) {
      logger.error('Failed to get messages', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Delete a conversation (soft delete)
   */
  async deleteConversation(conversationId, userId) {
    try {
      await this.database.executeQuery(
        `UPDATE ${this.tablePrefix}conversations 
         SET is_active = 'N' 
         WHERE conversation_id = :conversationId 
         AND user_id = :userId`,
        { conversationId, userId }
      );
    } catch (error) {
      logger.error('Failed to delete conversation', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Create or update conversation summary
   */
  async saveConversationSummary(conversationId, summary, keyTopics = [], actionItems = []) {
    const summaryId = uuidv4();
    
    try {
      // Check if summary exists
      const existing = await this.database.executeQuery(
        `SELECT summary_id FROM ${this.tablePrefix}conversation_summaries 
         WHERE conversation_id = :conversationId`,
        { conversationId }
      );
      
      if (existing.rows.length > 0) {
        // Update existing
        await this.database.executeQuery(
          `UPDATE ${this.tablePrefix}conversation_summaries 
           SET summary_text = :summary,
               key_topics = :keyTopics,
               action_items = :actionItems,
               generated_at = CURRENT_TIMESTAMP
           WHERE conversation_id = :conversationId`,
          {
            conversationId,
            summary,
            keyTopics: JSON.stringify(keyTopics),
            actionItems: JSON.stringify(actionItems)
          }
        );
      } else {
        // Insert new
        await this.database.executeQuery(
          `INSERT INTO ${this.tablePrefix}conversation_summaries 
           (summary_id, conversation_id, summary_text, key_topics, action_items) 
           VALUES (:summaryId, :conversationId, :summary, :keyTopics, :actionItems)`,
          {
            summaryId,
            conversationId,
            summary,
            keyTopics: JSON.stringify(keyTopics),
            actionItems: JSON.stringify(actionItems)
          }
        );
      }
    } catch (error) {
      logger.error('Failed to save conversation summary', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Search conversations by content
   */
  async searchConversations(userId, searchTerm, limit = 20) {
    try {
      const result = await this.database.executeQuery(
        `SELECT DISTINCT c.conversation_id, c.title, c.first_message, 
                c.last_message_at, c.message_count
         FROM ${this.tablePrefix}conversations c
         JOIN ${this.tablePrefix}messages m ON c.conversation_id = m.conversation_id
         WHERE c.user_id = :userId 
         AND c.is_active = 'Y'
         AND (UPPER(c.title) LIKE UPPER(:searchPattern) 
              OR UPPER(m.content) LIKE UPPER(:searchPattern))
         ORDER BY c.last_message_at DESC
         FETCH FIRST :limit ROWS ONLY`,
        {
          userId,
          searchPattern: `%${searchTerm}%`,
          limit
        }
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to search conversations', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Estimate token count for a message
   * Rough estimate: ~4 characters per token
   */
  _estimateTokens(content) {
    return Math.ceil(content.length / 4);
  }
}

module.exports = ChatRepository;