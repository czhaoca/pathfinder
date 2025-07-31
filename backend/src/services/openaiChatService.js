const OpenAI = require('openai');
const logger = require('../utils/logger');

class OpenAIChatService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.systemPrompt = `You are Pathfinder, an AI-powered career guidance assistant. Your role is to help users with:
    
1. Career planning and exploration
2. Skill development and gap analysis
3. Experience optimization and storytelling
4. Professional growth strategies
5. Job search and networking advice

Key capabilities:
- Analyze professional experiences to identify transferable skills
- Provide personalized career path recommendations
- Suggest skill development priorities based on career goals
- Help craft compelling professional narratives
- Offer industry insights and market trends

Always be:
- Encouraging and supportive
- Practical and actionable in your advice
- Aware of the user's experience level and context
- Focused on long-term career growth
- Professional yet approachable

Remember to ask clarifying questions when needed and provide specific, tailored advice rather than generic suggestions.`;
  }

  async generateResponse(message, conversationHistory = [], userContext = {}) {
    try {
      // Build conversation messages
      const messages = [
        { role: 'system', content: this.systemPrompt }
      ];

      // Add user context if available
      if (userContext.name || userContext.experiences) {
        let contextContent = 'User Context:\n';
        if (userContext.name) {
          contextContent += `- Name: ${userContext.name}\n`;
        }
        if (userContext.experienceCount) {
          contextContent += `- Has ${userContext.experienceCount} professional experiences logged\n`;
        }
        if (userContext.primarySkills) {
          contextContent += `- Key skills: ${userContext.primarySkills.join(', ')}\n`;
        }
        messages.push({ role: 'system', content: contextContent });
      }

      // Add conversation history (last 10 messages for context)
      const recentHistory = conversationHistory.slice(-10);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });

      // Add current message
      messages.push({ role: 'user', content: message });

      // Generate response
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 800,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const responseContent = completion.choices[0].message.content;
      
      return {
        content: responseContent,
        metadata: {
          model: completion.model,
          tokensUsed: completion.usage?.total_tokens || 0,
          type: 'openai'
        }
      };
    } catch (error) {
      logger.error('OpenAI API error', { error: error.message });
      throw new Error('Failed to generate AI response');
    }
  }

  async generateStreamingResponse(message, conversationHistory = [], userContext = {}, callbacks) {
    try {
      // Build conversation messages (same as above)
      const messages = [
        { role: 'system', content: this.systemPrompt }
      ];

      if (userContext.name || userContext.experiences) {
        let contextContent = 'User Context:\n';
        if (userContext.name) {
          contextContent += `- Name: ${userContext.name}\n`;
        }
        if (userContext.experienceCount) {
          contextContent += `- Has ${userContext.experienceCount} professional experiences logged\n`;
        }
        if (userContext.primarySkills) {
          contextContent += `- Key skills: ${userContext.primarySkills.join(', ')}\n`;
        }
        messages.push({ role: 'system', content: contextContent });
      }

      const recentHistory = conversationHistory.slice(-10);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });

      messages.push({ role: 'user', content: message });

      // Create streaming completion
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 800,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        stream: true
      });

      let fullResponse = '';
      
      // Process stream
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          callbacks.onChunk(content);
        }
      }

      callbacks.onComplete({
        content: fullResponse,
        metadata: {
          model: 'gpt-4-turbo-preview',
          type: 'openai-stream'
        }
      });
    } catch (error) {
      logger.error('OpenAI streaming error', { error: error.message });
      callbacks.onError(new Error('Failed to generate streaming response'));
    }
  }

  async generateCareerPrompts(userContext) {
    // Generate specialized career guidance prompts based on user context
    const prompts = [];

    if (!userContext.experienceCount || userContext.experienceCount === 0) {
      prompts.push(
        "Tell me about your educational background and career interests",
        "What type of work excites you the most?",
        "What are your key strengths and skills?"
      );
    } else if (userContext.experienceCount < 3) {
      prompts.push(
        "What are your career goals for the next 2-3 years?",
        "What skills would you like to develop further?",
        "Are you considering a career transition?"
      );
    } else {
      prompts.push(
        "What's your ideal next career move?",
        "Which of your experiences has been most impactful?",
        "What leadership opportunities are you seeking?"
      );
    }

    // Add skill-based prompts
    if (userContext.primarySkills && userContext.primarySkills.length > 0) {
      prompts.push(
        `How can I leverage my ${userContext.primarySkills[0]} skills for career growth?`,
        "What emerging skills should I add to complement my current expertise?"
      );
    }

    return prompts;
  }

  async analyzeSentiment(message) {
    // Simple sentiment analysis for conversation insights
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Analyze the sentiment and intent of the user message. Respond with a JSON object containing: sentiment (positive/neutral/negative), intent (career_advice/skill_development/job_search/general_chat), and confidence (0-1).'
          },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 100
      });

      try {
        return JSON.parse(completion.choices[0].message.content);
      } catch {
        return { sentiment: 'neutral', intent: 'general_chat', confidence: 0.5 };
      }
    } catch (error) {
      logger.error('Sentiment analysis failed', { error: error.message });
      return { sentiment: 'neutral', intent: 'general_chat', confidence: 0 };
    }
  }
}

module.exports = OpenAIChatService;