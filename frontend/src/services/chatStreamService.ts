import { authStore } from '@/stores/authStore';

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (data: any) => void;
  onError: (error: Error) => void;
}

class ChatStreamService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  }

  async sendStreamingMessage(
    message: string, 
    conversationId?: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const { token } = authStore.getState();
    
    if (!token) {
      throw new Error('No authentication token');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/message/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message, conversationId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            // Event type line
            continue;
          }
          
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            
            if (!data) continue;
            
            try {
              const parsed = JSON.parse(data);
              
              switch (parsed.type) {
                case 'chunk':
                  callbacks.onChunk(parsed.content);
                  break;
                case 'complete':
                  callbacks.onComplete(parsed);
                  break;
                case 'error':
                  callbacks.onError(new Error(parsed.error));
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error: any) {
      callbacks.onError(error);
      throw error;
    }
  }
}

export const chatStreamService = new ChatStreamService();