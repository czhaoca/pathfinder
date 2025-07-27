const ChatController = require('../../../src/api/controllers/chatController');

describe('ChatController', () => {
  let chatController;
  let mockChatService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Mock chat service
    mockChatService = {
      sendMessage: jest.fn(),
      getChatHistory: jest.fn(),
      getConversationSummary: jest.fn(),
      deleteConversation: jest.fn(),
      searchConversations: jest.fn(),
      generateConversationSummary: jest.fn()
    };

    // Create controller instance
    chatController = new ChatController(mockChatService);

    // Mock request
    mockReq = {
      body: {},
      query: {},
      params: {},
      user: { userId: 'test-user-id' }
    };

    // Mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Mock next
    mockNext = jest.fn();
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      const messageData = {
        message: 'Hello, how can I improve my resume?',
        conversationId: 'conv-123'
      };

      const mockResponse = {
        conversationId: 'conv-123',
        userMessage: {
          id: 'msg-1',
          content: messageData.message,
          role: 'user',
          timestamp: new Date()
        },
        assistantMessage: {
          id: 'msg-2',
          content: 'I can help you improve your resume...',
          role: 'assistant',
          timestamp: new Date()
        }
      };

      mockReq.body = messageData;
      mockChatService.sendMessage.mockResolvedValue(mockResponse);

      await chatController.sendMessage(mockReq, mockRes, mockNext);

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        'test-user-id',
        messageData.message,
        messageData.conversationId
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResponse);
    });

    it('should handle empty message', async () => {
      mockReq.body = { message: '   ' };

      await chatController.sendMessage(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Message is required'
      });
    });

    it('should handle message too long', async () => {
      mockReq.body = { message: 'a'.repeat(2001) };

      await chatController.sendMessage(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Message too long (max 2000 characters)'
      });
    });

    it('should handle service errors', async () => {
      mockReq.body = { message: 'Hello' };
      const error = new Error('Service unavailable');
      mockChatService.sendMessage.mockRejectedValue(error);

      await chatController.sendMessage(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getChatHistory', () => {
    it('should get chat history successfully', async () => {
      mockReq.query = { conversationId: 'conv-123', limit: '50' };

      const mockHistory = {
        conversationId: 'conv-123',
        messages: [
          { id: 'msg-1', content: 'Hello', role: 'user' },
          { id: 'msg-2', content: 'Hi there', role: 'assistant' }
        ]
      };

      mockChatService.getChatHistory.mockResolvedValue(mockHistory);

      await chatController.getChatHistory(mockReq, mockRes, mockNext);

      expect(mockChatService.getChatHistory).toHaveBeenCalledWith(
        'test-user-id',
        'conv-123',
        50
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockHistory);
    });

    it('should handle invalid limit', async () => {
      mockReq.query = { limit: '250' };

      await chatController.getChatHistory(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Limit must be between 1 and 200'
      });
    });
  });

  describe('getConversationSummary', () => {
    it('should get conversation summary successfully', async () => {
      mockReq.params = { conversationId: 'conv-123' };

      const mockSummary = {
        id: 'conv-123',
        title: 'Resume Improvement Discussion',
        lastMessage: 'Thanks for the tips!',
        messageCount: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockChatService.getConversationSummary.mockResolvedValue(mockSummary);

      await chatController.getConversationSummary(mockReq, mockRes, mockNext);

      expect(mockChatService.getConversationSummary).toHaveBeenCalledWith(
        'test-user-id',
        'conv-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockSummary);
    });

    it('should handle conversation not found', async () => {
      mockReq.params = { conversationId: 'conv-123' };
      mockChatService.getConversationSummary.mockResolvedValue(null);

      await chatController.getConversationSummary(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Conversation not found'
      });
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation successfully', async () => {
      mockReq.params = { conversationId: 'conv-123' };

      await chatController.deleteConversation(mockReq, mockRes, mockNext);

      expect(mockChatService.deleteConversation).toHaveBeenCalledWith(
        'test-user-id',
        'conv-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Conversation deleted'
      });
    });
  });

  describe('searchConversations', () => {
    it('should search conversations successfully', async () => {
      mockReq.query = { q: 'resume' };

      const mockResults = [
        { id: 'conv-1', title: 'Resume Tips', snippet: '...improve your resume...' },
        { id: 'conv-2', title: 'Resume Format', snippet: '...best resume format...' }
      ];

      mockChatService.searchConversations.mockResolvedValue(mockResults);

      await chatController.searchConversations(mockReq, mockRes, mockNext);

      expect(mockChatService.searchConversations).toHaveBeenCalledWith(
        'test-user-id',
        'resume'
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        query: 'resume',
        results: mockResults,
        count: 2
      });
    });

    it('should handle short search query', async () => {
      mockReq.query = { q: 'a' };

      await chatController.searchConversations(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Search query must be at least 2 characters'
      });
    });
  });

  describe('generateSummary', () => {
    it('should generate conversation summary successfully', async () => {
      mockReq.params = { conversationId: 'conv-123' };

      const mockSummary = {
        summary: 'Discussed resume improvement strategies',
        keyTopics: ['Resume formatting', 'Skills section', 'Experience descriptions'],
        actionItems: ['Update skills section', 'Quantify achievements']
      };

      mockChatService.generateConversationSummary.mockResolvedValue(mockSummary);

      await chatController.generateSummary(mockReq, mockRes, mockNext);

      expect(mockChatService.generateConversationSummary).toHaveBeenCalledWith(
        'test-user-id',
        'conv-123'
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockSummary);
    });

    it('should handle insufficient messages', async () => {
      mockReq.params = { conversationId: 'conv-123' };
      mockChatService.generateConversationSummary.mockResolvedValue(null);

      await chatController.generateSummary(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not enough messages to generate summary'
      });
    });
  });
});