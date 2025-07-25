import api from '@/lib/api';
import { Message, ChatResponse, ConversationSummary } from '@/types/chat';

class ChatService {
  async sendMessage(message: string, conversationId?: string): Promise<ChatResponse> {
    return api.post('/chat/message', { message, conversationId });
  }

  async getChatHistory(conversationId?: string, limit: number = 50): Promise<{
    conversationId: string;
    messages: Message[];
    count: number;
  }> {
    const params = new URLSearchParams();
    if (conversationId) params.append('conversationId', conversationId);
    params.append('limit', limit.toString());
    
    return api.get(`/chat/history?${params.toString()}`);
  }

  async getConversationSummary(conversationId: string): Promise<ConversationSummary> {
    return api.get(`/chat/conversations/${conversationId}/summary`);
  }
}

export const chatService = new ChatService();