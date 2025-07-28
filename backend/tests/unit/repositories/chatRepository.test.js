const ChatRepository = require('../../../src/repositories/chatRepository');

describe('ChatRepository', () => {
  let chatRepository;
  let mockDatabase;

  beforeEach(() => {
    // Mock database
    mockDatabase = {
      executeQuery: jest.fn(),
      raw: jest.fn(value => value)
    };
    
    chatRepository = new ChatRepository(mockDatabase);
  });

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const userId = 'test-user-id';
      const title = 'Test Conversation';
      
      mockDatabase.executeQuery.mockResolvedValue({ rows: [] });
      
      const conversationId = await chatRepository.createConversation(userId, title);
      
      expect(conversationId).toBeTruthy();
      expect(mockDatabase.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_conversations'),
        expect.objectContaining({
          userId,
          title
        })
      );
    });
  });

  describe('addMessage', () => {
    it('should add a message to conversation', async () => {
      const conversationId = 'test-conv-id';
      const userId = 'test-user-id';
      const role = 'user';
      const content = 'Test message';
      
      mockDatabase.executeQuery
        .mockResolvedValueOnce({ rows: [] }) // Insert message
        .mockResolvedValueOnce({ rows: [{ first_message: null }] }) // Get conversation
        .mockResolvedValueOnce({ rows: [] }); // Update conversation
      
      const message = await chatRepository.addMessage(conversationId, userId, role, content);
      
      expect(message).toMatchObject({
        conversationId,
        role,
        content
      });
      expect(message.id).toBeTruthy();
      expect(message.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getMessages', () => {
    it('should retrieve messages for a conversation', async () => {
      const conversationId = 'test-conv-id';
      const userId = 'test-user-id';
      
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date().toISOString()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date().toISOString()
        }
      ];
      
      mockDatabase.executeQuery
        .mockResolvedValueOnce({ rows: [{ conversation_id: conversationId }] }) // Verify conversation
        .mockResolvedValueOnce({ rows: mockMessages }); // Get messages
      
      const messages = await chatRepository.getMessages(conversationId, userId);
      
      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({
        id: 'msg-1',
        role: 'user',
        content: 'Hello'
      });
      expect(messages[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getUserConversations', () => {
    it('should get user conversations list', async () => {
      const userId = 'test-user-id';
      
      const mockConversations = [
        {
          conversation_id: 'conv-1',
          title: 'Career advice',
          first_message: 'I need help with...',
          last_message_at: new Date(),
          message_count: 10
        }
      ];
      
      mockDatabase.executeQuery.mockResolvedValue({ rows: mockConversations });
      
      const conversations = await chatRepository.getUserConversations(userId);
      
      expect(conversations).toEqual(mockConversations);
      expect(mockDatabase.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT conversation_id'),
        expect.objectContaining({ userId })
      );
    });
  });

  describe('searchConversations', () => {
    it('should search conversations by content', async () => {
      const userId = 'test-user-id';
      const searchTerm = 'career';
      
      const mockResults = [
        {
          conversation_id: 'conv-1',
          title: 'Career guidance',
          first_message: 'Looking for career advice'
        }
      ];
      
      mockDatabase.executeQuery.mockResolvedValue({ rows: mockResults });
      
      const results = await chatRepository.searchConversations(userId, searchTerm);
      
      expect(results).toEqual(mockResults);
      expect(mockDatabase.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIKE UPPER(:searchPattern)'),
        expect.objectContaining({
          userId,
          searchPattern: '%career%'
        })
      );
    });
  });

  describe('deleteConversation', () => {
    it('should soft delete a conversation', async () => {
      const conversationId = 'test-conv-id';
      const userId = 'test-user-id';
      
      mockDatabase.executeQuery.mockResolvedValue({ rows: [] });
      
      await chatRepository.deleteConversation(conversationId, userId);
      
      expect(mockDatabase.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET is_active = 'N'"),
        expect.objectContaining({
          conversationId,
          userId
        })
      );
    });
  });

  describe('_estimateTokens', () => {
    it('should estimate token count', () => {
      const content = 'This is a test message';
      const tokens = chatRepository._estimateTokens(content);
      
      // Rough estimate: ~4 characters per token
      expect(tokens).toBe(Math.ceil(content.length / 4));
    });
  });
});