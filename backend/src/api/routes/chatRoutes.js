const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');
const ChatStreamController = require('../controllers/chatStreamController');

function createChatRoutes(container) {
  const router = express.Router();
  const chatController = container.get('chatController');
  const authMiddleware = container.get('authMiddleware');
  
  // Create streaming controller
  const chatStreamController = new ChatStreamController(container.get('chatService'));

  // All chat routes require authentication
  router.use(authMiddleware.authenticate());

  // Rate limit chat messages more strictly
  router.post('/message',
    authMiddleware.rateLimitByUser({ windowMs: 60000, max: 20 }),
    ErrorHandler.asyncWrapper((req, res, next) => 
      chatController.sendMessage(req, res, next)
    )
  );

  // Streaming endpoint for chat messages
  router.post('/message/stream',
    authMiddleware.rateLimitByUser({ windowMs: 60000, max: 20 }),
    (req, res, next) => chatStreamController.streamMessage(req, res, next)
  );

  router.get('/history',
    ErrorHandler.asyncWrapper((req, res, next) => 
      chatController.getChatHistory(req, res, next)
    )
  );

  // Conversation management routes
  router.get('/conversations/:conversationId',
    ErrorHandler.asyncWrapper((req, res, next) => 
      chatController.getConversationSummary(req, res, next)
    )
  );

  router.delete('/conversations/:conversationId',
    ErrorHandler.asyncWrapper((req, res, next) => 
      chatController.deleteConversation(req, res, next)
    )
  );

  router.get('/conversations/search',
    ErrorHandler.asyncWrapper((req, res, next) => 
      chatController.searchConversations(req, res, next)
    )
  );

  router.post('/conversations/:conversationId/summary',
    ErrorHandler.asyncWrapper((req, res, next) => 
      chatController.generateSummary(req, res, next)
    )
  );

  return router;
}

module.exports = createChatRoutes;