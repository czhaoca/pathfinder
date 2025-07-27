const logger = require('../../utils/logger');

class ChatController {
  constructor(chatService) {
    this.chatService = chatService;
  }

  async sendMessage(req, res, next) {
    try {
      const { message, conversationId } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (message.length > 2000) {
        return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
      }

      const response = await this.chatService.sendMessage(
        req.user.userId,
        message,
        conversationId
      );

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getChatHistory(req, res, next) {
    try {
      const { conversationId } = req.query;
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;

      if (limit < 1 || limit > 200) {
        return res.status(400).json({ error: 'Limit must be between 1 and 200' });
      }

      const history = await this.chatService.getChatHistory(
        req.user.userId,
        conversationId,
        limit
      );

      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  async getConversationSummary(req, res, next) {
    try {
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required' });
      }

      const summary = await this.chatService.getConversationSummary(
        req.user.userId,
        conversationId
      );

      if (!summary) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json(summary);
    } catch (error) {
      next(error);
    }
  }

  async deleteConversation(req, res, next) {
    try {
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required' });
      }

      await this.chatService.deleteConversation(
        req.user.userId,
        conversationId
      );

      res.json({ success: true, message: 'Conversation deleted' });
    } catch (error) {
      next(error);
    }
  }

  async searchConversations(req, res, next) {
    try {
      const { q } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
      }

      const results = await this.chatService.searchConversations(
        req.user.userId,
        q
      );

      res.json({
        query: q,
        results,
        count: results.length
      });
    } catch (error) {
      next(error);
    }
  }

  async generateSummary(req, res, next) {
    try {
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required' });
      }

      const summary = await this.chatService.generateConversationSummary(
        req.user.userId,
        conversationId
      );

      if (!summary) {
        return res.status(400).json({ error: 'Not enough messages to generate summary' });
      }

      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ChatController;