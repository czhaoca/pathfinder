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

      res.json({
        conversationId,
        messages: history,
        count: history.length
      });
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
}

module.exports = ChatController;