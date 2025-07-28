const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class ChatService {
  constructor(userRepository, auditService, chatRepository, mcpClient = null) {
    this.userRepository = userRepository;
    this.auditService = auditService;
    this.chatRepository = chatRepository;
    this.mcpClient = mcpClient;
    this.conversationCache = new Map();
  }

  async sendMessage(userId, message, conversationId = null) {
    try {
      // Get user context
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create or get conversation
      if (!conversationId) {
        conversationId = await this.chatRepository.createConversation(userId, message.substring(0, 100));
      } else {
        // Verify user owns the conversation
        const conv = await this.chatRepository.getConversation(conversationId, userId);
        if (!conv) {
          throw new Error('Conversation not found or access denied');
        }
      }

      // Get conversation history from database
      const history = await this.chatRepository.getMessages(conversationId, userId, 50);
      
      // Add user message to database and history
      const userMessage = await this.chatRepository.addMessage(
        conversationId,
        userId,
        'user',
        message
      );
      history.push(userMessage);

      // Process message through MCP if available
      let response;
      if (this.mcpClient) {
        response = await this.processWithMCP(user, message, history);
      } else {
        // Fallback response when MCP is not available
        response = await this.generateFallbackResponse(message, user);
      }

      // Add assistant response to database
      const assistantMessage = await this.chatRepository.addMessage(
        conversationId,
        userId,
        'assistant',
        response.content,
        response.metadata
      );
      history.push(assistantMessage);

      // Update conversation cache with latest messages
      this.updateConversationCache(conversationId, history);

      // Log chat interaction
      await this.auditService.logDataAccess({
        userId,
        action: 'CHAT_MESSAGE_SENT',
        resourceType: 'chat',
        resourceId: conversationId,
        operation: 'create',
        success: true
      });

      return {
        conversationId,
        message: assistantMessage
      };
    } catch (error) {
      logger.error('Failed to process chat message', { userId, error: error.message });
      throw error;
    }
  }

  async processWithMCP(user, message, history) {
    try {
      // Prepare context for MCP
      const context = {
        user: {
          id: user.userId,
          schemaPrefix: user.schemaPrefix,
          name: `${user.firstName} ${user.lastName}`.trim()
        },
        conversation: history.slice(-10) // Last 10 messages for context
      };

      // Call MCP server
      const response = await this.mcpClient.processMessage({
        message,
        context,
        tools: ['get_quick_context', 'search_experiences', 'get_career_suggestions']
      });

      return {
        content: response.content,
        metadata: {
          toolsUsed: response.toolsUsed,
          processingTime: response.processingTime
        }
      };
    } catch (error) {
      logger.error('MCP processing failed', { error: error.message });
      // Fallback to basic response
      return this.generateFallbackResponse(message, user);
    }
  }

  async sendStreamingMessage(userId, message, conversationId = null, callbacks) {
    try {
      // Get user context
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create or get conversation
      if (!conversationId) {
        conversationId = await this.chatRepository.createConversation(userId, message.substring(0, 100));
      } else {
        // Verify user owns the conversation
        const conv = await this.chatRepository.getConversation(conversationId, userId);
        if (!conv) {
          throw new Error('Conversation not found or access denied');
        }
      }

      // Get conversation history from database
      const history = await this.chatRepository.getMessages(conversationId, userId, 50);
      
      // Add user message to database
      const userMessage = await this.chatRepository.addMessage(
        conversationId,
        userId,
        'user',
        message
      );
      history.push(userMessage);

      // Process message with streaming
      let fullResponse = '';
      
      if (this.mcpClient && this.mcpClient.supportsStreaming) {
        // Stream from MCP
        await this.streamFromMCP(user, message, history, {
          onChunk: (chunk) => {
            fullResponse += chunk;
            callbacks.onChunk(chunk);
          },
          onComplete: () => {
            this.completeStreamingResponse(
              conversationId, 
              fullResponse, 
              history, 
              userId, 
              callbacks
            ).catch(err => callbacks.onError(err));
          },
          onError: callbacks.onError
        });
      } else {
        // Simulate streaming for fallback response
        const response = await this.generateFallbackResponse(message, user);
        await this.simulateStreaming(response.content, callbacks.onChunk);
        this.completeStreamingResponse(
          conversationId, 
          response.content, 
          history, 
          userId, 
          callbacks
        );
      }
    } catch (error) {
      logger.error('Failed to process streaming message', { userId, error: error.message });
      callbacks.onError(error);
    }
  }

  async simulateStreaming(content, onChunk) {
    // Simulate streaming by sending chunks of text
    const words = content.split(' ');
    const chunkSize = 3; // Send 3 words at a time
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ') + ' ';
      onChunk(chunk);
      // Add small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  async streamFromMCP(user, message, history, callbacks) {
    try {
      const context = {
        user: {
          id: user.userId,
          schemaPrefix: user.schemaPrefix,
          name: `${user.firstName} ${user.lastName}`.trim()
        },
        conversation: history.slice(-10)
      };

      await this.mcpClient.streamMessage({
        message,
        context,
        tools: ['get_quick_context', 'search_experiences', 'get_career_suggestions'],
        onChunk: callbacks.onChunk,
        onComplete: callbacks.onComplete,
        onError: callbacks.onError
      });
    } catch (error) {
      logger.error('MCP streaming failed', { error: error.message });
      throw error;
    }
  }

  async completeStreamingResponse(conversationId, fullResponse, history, userId, callbacks) {
    // Add assistant response to database
    const assistantMessage = await this.chatRepository.addMessage(
      conversationId,
      userId,
      'assistant',
      fullResponse
    );
    history.push(assistantMessage);

    // Update conversation cache
    this.updateConversationCache(conversationId, history);

    // Log chat interaction
    this.auditService.logDataAccess({
      userId,
      action: 'CHAT_MESSAGE_SENT',
      resourceType: 'chat',
      resourceId: conversationId,
      operation: 'create',
      success: true
    }).catch(err => logger.error('Failed to log audit', { err }));

    callbacks.onComplete({
      conversationId,
      message: assistantMessage
    });
  }

  async generateFallbackResponse(message, user) {
    // Simple rule-based responses when MCP is unavailable
    const lowerMessage = message.toLowerCase();
    
    let content = '';
    const metadata = { type: 'fallback' };

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      content = `Hello ${user.firstName || 'there'}! I'm your Pathfinder assistant. While I'm currently operating in limited mode, I can help you manage your experiences and career profile. What would you like to know about?`;
    } else if (lowerMessage.includes('experience')) {
      content = "I can help you manage your professional experiences. You can add new experiences, update existing ones, or search through your experience history. Use the Experiences section in the navigation to get started.";
    } else if (lowerMessage.includes('career') || lowerMessage.includes('job')) {
      content = "Career planning is one of my core features. Once fully integrated, I'll be able to provide personalized career guidance, skill gap analysis, and job market insights based on your experience profile.";
    } else if (lowerMessage.includes('skill')) {
      content = "Skills are automatically extracted from your experiences. The system identifies technical skills, soft skills, and domain expertise from your experience descriptions to build a comprehensive skill profile.";
    } else if (lowerMessage.includes('help')) {
      content = `Here's what I can help you with:
• Managing your professional experiences
• Building your career profile
• Tracking your skills and achievements
• Planning your career progression

Feel free to ask me about any of these topics!`;
    } else {
      content = "I understand you're interested in that topic. While I'm currently in limited mode, I can help you manage your experiences and career profile. For more advanced career guidance, the full MCP integration will be available soon.";
    }

    return { content, metadata };
  }

  async getChatHistory(userId, conversationId = null, limit = 50) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!conversationId) {
        // Get user's conversations list
        const conversations = await this.chatRepository.getUserConversations(userId, 10);
        return {
          conversations,
          messages: []
        };
      }

      // Get messages from database
      const messages = await this.chatRepository.getMessages(conversationId, userId, limit);
      
      // Update cache with database messages
      if (messages.length > 0) {
        this.updateConversationCache(conversationId, messages);
      }

      return {
        conversationId,
        messages
      };
    } catch (error) {
      logger.error('Failed to get chat history', { userId, conversationId, error: error.message });
      throw error;
    }
  }

  getConversationHistory(conversationId) {
    if (!this.conversationCache.has(conversationId)) {
      this.conversationCache.set(conversationId, []);
    }
    return this.conversationCache.get(conversationId);
  }

  updateConversationCache(conversationId, history) {
    // Keep only last 100 messages per conversation
    if (history.length > 100) {
      history = history.slice(-100);
    }
    this.conversationCache.set(conversationId, history);

    // Clean up old conversations if cache gets too large
    if (this.conversationCache.size > 1000) {
      const sortedEntries = Array.from(this.conversationCache.entries())
        .sort((a, b) => {
          const lastMessageA = a[1][a[1].length - 1]?.timestamp || 0;
          const lastMessageB = b[1][b[1].length - 1]?.timestamp || 0;
          return lastMessageB - lastMessageA;
        });

      // Keep only 500 most recent conversations
      this.conversationCache = new Map(sortedEntries.slice(0, 500));
    }
  }

  async getConversationSummary(userId, conversationId) {
    try {
      const conv = await this.chatRepository.getConversation(conversationId, userId);
      if (!conv) {
        throw new Error('Conversation not found');
      }
      
      return {
        conversationId: conv.conversation_id,
        title: conv.title,
        firstMessage: conv.first_message,
        lastMessageAt: conv.last_message_at,
        messageCount: conv.message_count,
        createdAt: conv.created_at
      };
    } catch (error) {
      logger.error('Failed to get conversation summary', { userId, conversationId, error: error.message });
      throw error;
    }
  }

  async deleteConversation(userId, conversationId) {
    try {
      await this.chatRepository.deleteConversation(conversationId, userId);
      
      // Remove from cache
      if (this.conversationCache.has(conversationId)) {
        this.conversationCache.delete(conversationId);
      }
      
      // Log deletion
      await this.auditService.logDataAccess({
        userId,
        action: 'CHAT_CONVERSATION_DELETED',
        resourceType: 'chat',
        resourceId: conversationId,
        operation: 'delete',
        success: true
      });
    } catch (error) {
      logger.error('Failed to delete conversation', { userId, conversationId, error: error.message });
      throw error;
    }
  }

  async searchConversations(userId, searchTerm) {
    try {
      const results = await this.chatRepository.searchConversations(userId, searchTerm, 20);
      return results;
    } catch (error) {
      logger.error('Failed to search conversations', { userId, searchTerm, error: error.message });
      throw error;
    }
  }

  async generateConversationSummary(userId, conversationId) {
    try {
      const messages = await this.chatRepository.getMessages(conversationId, userId, 100);
      
      if (messages.length < 5) {
        return null; // Not enough messages to summarize
      }

      // Generate summary using MCP or fallback
      let summary, keyTopics = [], actionItems = [];
      
      if (this.mcpClient) {
        const result = await this.mcpClient.processMessage({
          message: `Please provide a brief summary of this conversation, identify key topics discussed, and list any action items mentioned:
          
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`,
          context: { task: 'summarize' }
        });
        
        // Parse the response
        const lines = result.content.split('\n');
        summary = lines[0];
        // Extract topics and action items from response
        // This is simplified - in production, use structured parsing
      } else {
        // Simple fallback summary
        summary = `Conversation with ${messages.length} messages discussing career topics`;
        keyTopics = ['Career guidance'];
      }
      
      await this.chatRepository.saveConversationSummary(
        conversationId,
        summary,
        keyTopics,
        actionItems
      );
      
      return { summary, keyTopics, actionItems };
    } catch (error) {
      logger.error('Failed to generate conversation summary', { userId, conversationId, error: error.message });
      throw error;
    }
  }
}

module.exports = ChatService;