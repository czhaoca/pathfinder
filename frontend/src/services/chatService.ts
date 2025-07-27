import api from '@/lib/api';
import { Message, ChatResponse, ConversationSummary } from '@/types/chat';

export interface ChatHistoryResponse {
  conversationId?: string;
  conversations?: ConversationSummary[];
  messages: Message[];
}

export interface SearchConversationsResponse {
  query: string;
  results: ConversationSummary[];
  count: number;
}

class ChatService {
  async sendMessage(message: string, conversationId?: string): Promise<ChatResponse> {
    return api.post('/chat/message', { message, conversationId });
  }

  async getChatHistory(conversationId?: string, limit: number = 50): Promise<ChatHistoryResponse> {
    const params = new URLSearchParams();
    if (conversationId) params.append('conversationId', conversationId);
    params.append('limit', limit.toString());
    
    return api.get(`/chat/history?${params.toString()}`);
  }

  async getConversationSummary(conversationId: string): Promise<ConversationSummary> {
    return api.get(`/chat/conversations/${conversationId}`);
  }

  async deleteConversation(conversationId: string): Promise<{ success: boolean; message: string }> {
    return api.delete(`/chat/conversations/${conversationId}`);
  }

  async searchConversations(query: string): Promise<SearchConversationsResponse> {
    const params = new URLSearchParams({ q: query });
    return api.get(`/chat/conversations/search?${params.toString()}`);
  }

  async generateConversationSummary(conversationId: string): Promise<{
    summary: string;
    keyTopics: string[];
    actionItems: string[];
  }> {
    return api.post(`/chat/conversations/${conversationId}/summary`);
  }
}

export const chatService = new ChatService();