const ChatService = require('../../../src/services/chatService');

describe('ChatService', () => {
  let chatService;
  let mockChatRepository;
  let mockLlmService;
  let mockLogger;

  beforeEach(() => {
    // Mock dependencies
    mockChatRepository = {
      createConversation: jest.fn(),
      getConversation: jest.fn(),
      saveMessage: jest.fn(),
      getMessages: jest.fn(),
      updateConversation: jest.fn(),
      deleteConversation: jest.fn(),
      searchConversations: jest.fn(),
      getConversationCount: jest.fn()
    };

    mockLlmService = {
      generateResponse: jest.fn(),
      generateSummary: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    // Create service instance
    chatService = new ChatService(mockChatRepository, mockLlmService, mockLogger);
  });

  describe('sendMessage', () => {
    const userId = 'user-123';
    const message = 'How do I improve my resume?';

    it('should create new conversation and send message', async () => {
      const newConversationId = 'conv-new-123';
      const userMessageId = 'msg-user-1';
      const assistantMessageId = 'msg-assistant-1';
      const assistantResponse = 'Here are some tips to improve your resume...';

      mockChatRepository.createConversation.mockResolvedValue({
        id: newConversationId,
        userId,
        title: 'New Conversation',
        createdAt: new Date()
      });

      mockChatRepository.saveMessage
        .mockResolvedValueOnce({ id: userMessageId, content: message, role: 'user' })
        .mockResolvedValueOnce({ id: assistantMessageId, content: assistantResponse, role: 'assistant' });

      mockLlmService.generateResponse.mockResolvedValue(assistantResponse);

      const result = await chatService.sendMessage(userId, message);

      expect(mockChatRepository.createConversation).toHaveBeenCalledWith(userId);
      expect(mockChatRepository.saveMessage).toHaveBeenCalledTimes(2);
      expect(mockLlmService.generateResponse).toHaveBeenCalledWith([
        { role: 'user', content: message }
      ]);
      expect(result).toEqual({
        conversationId: newConversationId,
        userMessage: expect.objectContaining({
          id: userMessageId,
          content: message,
          role: 'user'
        }),
        assistantMessage: expect.objectContaining({
          id: assistantMessageId,
          content: assistantResponse,
          role: 'assistant'
        })
      });
    });

    it('should use existing conversation', async () => {
      const conversationId = 'conv-existing-123';
      const previousMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      mockChatRepository.getConversation.mockResolvedValue({
        id: conversationId,
        userId,
        title: 'Existing Conversation'
      });

      mockChatRepository.getMessages.mockResolvedValue(previousMessages);
      mockLlmService.generateResponse.mockResolvedValue('To improve your resume...');

      await chatService.sendMessage(userId, message, conversationId);

      expect(mockChatRepository.createConversation).not.toHaveBeenCalled();
      expect(mockChatRepository.getMessages).toHaveBeenCalledWith(conversationId, 20);
      expect(mockLlmService.generateResponse).toHaveBeenCalledWith([
        ...previousMessages,
        { role: 'user', content: message }
      ]);
    });

    it('should handle unauthorized access', async () => {
      const conversationId = 'conv-123';
      
      mockChatRepository.getConversation.mockResolvedValue({
        id: conversationId,
        userId: 'different-user',
        title: 'Someone else conversation'
      });

      await expect(
        chatService.sendMessage(userId, message, conversationId)
      ).rejects.toThrow('Unauthorized access to conversation');
    });

    it('should update conversation title for new conversations', async () => {
      const newConversationId = 'conv-new-123';
      
      mockChatRepository.createConversation.mockResolvedValue({
        id: newConversationId,
        userId,
        title: 'New Conversation'
      });

      mockChatRepository.getConversationCount.mockResolvedValue(0);
      mockLlmService.generateResponse.mockResolvedValue('Resume tips...');

      await chatService.sendMessage(userId, message);

      expect(mockChatRepository.updateConversation).toHaveBeenCalledWith(
        newConversationId,
        { title: expect.stringContaining('Resume') }
      );
    });
  });

  describe('getChatHistory', () => {
    const userId = 'user-123';

    it('should get all conversations when no conversationId provided', async () => {
      const conversations = [
        { id: 'conv-1', title: 'Resume Help', lastMessage: 'Thanks!' },
        { id: 'conv-2', title: 'Interview Tips', lastMessage: 'Great advice' }
      ];

      mockChatRepository.searchConversations.mockResolvedValue(conversations);

      const result = await chatService.getChatHistory(userId);

      expect(mockChatRepository.searchConversations).toHaveBeenCalledWith(userId, '', 50);
      expect(result).toEqual({
        conversations,
        messages: []
      });
    });

    it('should get specific conversation messages', async () => {
      const conversationId = 'conv-123';
      const messages = [
        { id: 'msg-1', content: 'Hello', role: 'user' },
        { id: 'msg-2', content: 'Hi!', role: 'assistant' }
      ];

      mockChatRepository.getConversation.mockResolvedValue({
        id: conversationId,
        userId,
        title: 'Test Conversation'
      });

      mockChatRepository.getMessages.mockResolvedValue(messages);

      const result = await chatService.getChatHistory(userId, conversationId, 10);

      expect(mockChatRepository.getMessages).toHaveBeenCalledWith(conversationId, 10);
      expect(result).toEqual({
        conversationId,
        messages
      });
    });
  });

  describe('generateConversationSummary', () => {
    const userId = 'user-123';
    const conversationId = 'conv-123';

    it('should generate summary successfully', async () => {
      const messages = [
        { role: 'user', content: 'How do I format my resume?' },
        { role: 'assistant', content: 'Use clear sections...' },
        { role: 'user', content: 'What about skills?' },
        { role: 'assistant', content: 'List relevant skills...' },
        { role: 'user', content: 'Should I include hobbies?' },
        { role: 'assistant', content: 'Only if relevant...' }
      ];

      const expectedSummary = {
        summary: 'Discussion about resume formatting and content',
        keyTopics: ['Resume formatting', 'Skills section', 'Hobbies'],
        actionItems: ['Format resume with clear sections', 'Add relevant skills']
      };

      mockChatRepository.getConversation.mockResolvedValue({
        id: conversationId,
        userId,
        title: 'Resume Help'
      });

      mockChatRepository.getMessages.mockResolvedValue(messages);
      mockLlmService.generateSummary.mockResolvedValue(expectedSummary);

      const result = await chatService.generateConversationSummary(userId, conversationId);

      expect(result).toEqual(expectedSummary);
    });

    it('should return null for conversations with few messages', async () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ];

      mockChatRepository.getConversation.mockResolvedValue({
        id: conversationId,
        userId,
        title: 'Short Chat'
      });

      mockChatRepository.getMessages.mockResolvedValue(messages);

      const result = await chatService.generateConversationSummary(userId, conversationId);

      expect(result).toBeNull();
      expect(mockLlmService.generateSummary).not.toHaveBeenCalled();
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation successfully', async () => {
      const userId = 'user-123';
      const conversationId = 'conv-123';

      mockChatRepository.getConversation.mockResolvedValue({
        id: conversationId,
        userId,
        title: 'To Delete'
      });

      await chatService.deleteConversation(userId, conversationId);

      expect(mockChatRepository.deleteConversation).toHaveBeenCalledWith(conversationId);
    });

    it('should prevent unauthorized deletion', async () => {
      const userId = 'user-123';
      const conversationId = 'conv-123';

      mockChatRepository.getConversation.mockResolvedValue({
        id: conversationId,
        userId: 'different-user',
        title: 'Someone else conversation'
      });

      await expect(
        chatService.deleteConversation(userId, conversationId)
      ).rejects.toThrow('Unauthorized access to conversation');
    });
  });

  describe('searchConversations', () => {
    it('should search conversations', async () => {
      const userId = 'user-123';
      const query = 'resume';
      const results = [
        { id: 'conv-1', title: 'Resume Tips', snippet: '...format your resume...' }
      ];

      mockChatRepository.searchConversations.mockResolvedValue(results);

      const result = await chatService.searchConversations(userId, query);

      expect(mockChatRepository.searchConversations).toHaveBeenCalledWith(userId, query, 20);
      expect(result).toEqual(results);
    });
  });
});