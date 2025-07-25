const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class ChatService {
  constructor(userRepository, auditService, mcpClient = null) {
    this.userRepository = userRepository;
    this.auditService = auditService;
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
        conversationId = uuidv4();
      }

      // Get conversation history
      const history = this.getConversationHistory(conversationId);
      
      // Add user message to history
      const userMessage = {
        id: uuidv4(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      history.push(userMessage);

      // Process message through MCP if available
      let response;
      if (this.mcpClient) {
        response = await this.processWithMCP(user, message, history);
      } else {
        // Fallback response when MCP is not available
        response = await this.generateFallbackResponse(message, user);
      }

      // Add assistant response to history
      const assistantMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.content,
        metadata: response.metadata,
        timestamp: new Date()
      };
      history.push(assistantMessage);

      // Update conversation cache
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

  async generateFallbackResponse(message, user) {
    // Simple rule-based responses when MCP is unavailable
    const lowerMessage = message.toLowerCase();
    
    let content = '';
    const metadata = { type: 'fallback' };

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      content = `Hello ${user.firstName || 'there'}! I'm your Career Navigator assistant. While I'm currently operating in limited mode, I can help you manage your experiences and career profile. What would you like to know about?`;
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

      if (conversationId && this.conversationCache.has(conversationId)) {
        const history = this.conversationCache.get(conversationId);
        return history.slice(-limit);
      }

      // Return empty history for new conversations
      return [];
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
      const history = await this.getChatHistory(userId, conversationId);
      
      if (history.length === 0) {
        return null;
      }

      const firstMessage = history[0];
      const lastMessage = history[history.length - 1];
      const messageCount = history.length;
      const userMessageCount = history.filter(m => m.role === 'user').length;

      return {
        conversationId,
        firstMessage: {
          content: firstMessage.content.substring(0, 100) + '...',
          timestamp: firstMessage.timestamp
        },
        lastMessage: {
          content: lastMessage.content.substring(0, 100) + '...',
          timestamp: lastMessage.timestamp
        },
        messageCount,
        userMessageCount,
        duration: lastMessage.timestamp - firstMessage.timestamp
      };
    } catch (error) {
      logger.error('Failed to get conversation summary', { userId, conversationId, error: error.message });
      throw error;
    }
  }
}

module.exports = ChatService;