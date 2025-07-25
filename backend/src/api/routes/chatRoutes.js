const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');

function createChatRoutes(container) {
  const router = express.Router();
  const chatController = container.get('chatController');
  const authMiddleware = container.get('authMiddleware');

  // All chat routes require authentication
  router.use(authMiddleware.authenticate());

  // Rate limit chat messages more strictly
  router.post('/message',
    authMiddleware.rateLimitByUser({ windowMs: 60000, max: 20 }),
    ErrorHandler.asyncWrapper((req, res, next) => 
      chatController.sendMessage(req, res, next)
    )
  );

  router.get('/history',
    ErrorHandler.asyncWrapper((req, res, next) => 
      chatController.getChatHistory(req, res, next)
    )
  );

  return router;
}

module.exports = createChatRoutes;