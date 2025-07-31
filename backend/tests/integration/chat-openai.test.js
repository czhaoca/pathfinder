const request = require('supertest');
const app = require('../../src/api/app');
const jwt = require('jsonwebtoken');

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'This is a helpful career guidance response from OpenAI.'
            }
          }],
          model: 'gpt-4-turbo-preview',
          usage: { total_tokens: 100 }
        })
      }
    }
  }));
});

describe('Chat API with OpenAI Integration', () => {
  let authToken;
  const testUser = {
    userId: 'test123',
    username: 'testuser',
    email: 'test@example.com'
  };

  beforeAll(async () => {
    // Initialize the app
    await app.initialize();
    
    // Create auth token
    authToken = jwt.sign(
      { userId: testUser.userId, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('POST /api/chat/message', () => {
    it('should send a message and receive OpenAI response', async () => {
      const response = await request(app.getExpressApp())
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What career path should I consider with my software engineering background?'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('conversationId');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toHaveProperty('content');
      expect(response.body.message.content).toContain('career guidance');
    });

    it('should handle conversation context', async () => {
      // First message
      const firstResponse = await request(app.getExpressApp())
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'I have 5 years of experience in backend development'
        });

      const conversationId = firstResponse.body.conversationId;

      // Follow-up message
      const secondResponse = await request(app.getExpressApp())
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'What skills should I learn next?',
          conversationId
        });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.conversationId).toBe(conversationId);
    });
  });

  describe('POST /api/chat/message/stream', () => {
    it('should stream responses via SSE', (done) => {
      const req = request(app.getExpressApp())
        .post('/api/chat/message/stream')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Tell me about career transitions'
        });

      let chunks = [];
      
      req.on('response', (res) => {
        expect(res.headers['content-type']).toBe('text/event-stream');
        
        res.on('data', (data) => {
          const lines = data.toString().split('\n');
          lines.forEach(line => {
            if (line.startsWith('data:')) {
              try {
                const parsed = JSON.parse(line.slice(5));
                if (parsed.type === 'chunk') {
                  chunks.push(parsed.content);
                } else if (parsed.type === 'complete') {
                  expect(chunks.join('')).toContain('career');
                  done();
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          });
        });
      });

      req.end();
    });
  });

  describe('GET /api/chat/history', () => {
    it('should retrieve chat history', async () => {
      // Create a conversation first
      const chatResponse = await request(app.getExpressApp())
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Hello, I need career advice'
        });

      const conversationId = chatResponse.body.conversationId;

      // Get history
      const historyResponse = await request(app.getExpressApp())
        .get(`/api/chat/history?conversationId=${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.messages).toBeInstanceOf(Array);
      expect(historyResponse.body.messages.length).toBeGreaterThan(0);
      expect(historyResponse.body.messages[0].content).toBe('Hello, I need career advice');
    });
  });
});