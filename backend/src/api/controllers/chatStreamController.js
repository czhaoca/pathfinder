const logger = require('../../utils/logger');

class ChatStreamController {
  constructor(chatService) {
    this.chatService = chatService;
  }

  async streamMessage(req, res, next) {
    try {
      const { message, conversationId } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (message.length > 2000) {
        return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
      }

      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // Send initial connection event
      res.write('event: connected\ndata: {"status": "connected"}\n\n');

      // Handle client disconnect
      req.on('close', () => {
        logger.info('Client disconnected from stream');
        res.end();
      });

      // Process message with streaming
      try {
        await this.chatService.sendStreamingMessage(
          req.user.userId,
          message,
          conversationId,
          {
            onChunk: (chunk) => {
              res.write(`event: message\ndata: ${JSON.stringify({ 
                type: 'chunk', 
                content: chunk 
              })}\n\n`);
            },
            onComplete: (response) => {
              res.write(`event: complete\ndata: ${JSON.stringify({ 
                type: 'complete',
                conversationId: response.conversationId,
                messageId: response.message.id,
                fullContent: response.message.content
              })}\n\n`);
              res.end();
            },
            onError: (error) => {
              res.write(`event: error\ndata: ${JSON.stringify({ 
                type: 'error', 
                error: error.message 
              })}\n\n`);
              res.end();
            }
          }
        );
      } catch (error) {
        logger.error('Stream processing error', { error: error.message });
        res.write(`event: error\ndata: ${JSON.stringify({ 
          type: 'error', 
          error: 'Failed to process message' 
        })}\n\n`);
        res.end();
      }
    } catch (error) {
      // For non-streaming errors, return regular JSON response
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to initialize stream' });
      }
      next(error);
    }
  }
}

module.exports = ChatStreamController;