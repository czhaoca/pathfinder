import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { chatService } from '@/services/chatService';
import { chatStreamService } from '@/services/chatStreamService';
import { Message } from '@/types/chat';

export function useChatStream(initialConversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [currentStreamMessage, setCurrentStreamMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadHistory = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      setLoading(true);
      const response = await chatService.getChatHistory(conversationId);
      setMessages(response.messages);
    } catch (err: any) {
      toast.error('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const sendMessage = useCallback(async (content: string, useStreaming: boolean = true) => {
    if (!content.trim() || streaming) return;

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, tempMessage]);

    if (useStreaming) {
      // Streaming response
      setStreaming(true);
      setCurrentStreamMessage('');
      
      // Add placeholder for assistant message
      const assistantTempId = `assistant-temp-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantTempId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }]);

      try {
        await chatStreamService.sendStreamingMessage(
          content,
          conversationId,
          {
            onChunk: (chunk) => {
              setCurrentStreamMessage(prev => prev + chunk);
              setMessages(prev => prev.map(msg => 
                msg.id === assistantTempId 
                  ? { ...msg, content: prev + chunk }
                  : msg
              ));
            },
            onComplete: (data) => {
              // Update conversation ID if new
              if (!conversationId) {
                setConversationId(data.conversationId);
              }
              
              // Replace temp messages with actual ones
              setMessages(prev => {
                const filtered = prev.filter(m => 
                  m.id !== tempMessage.id && m.id !== assistantTempId
                );
                return [...filtered, 
                  { ...tempMessage, id: data.messageId || tempMessage.id },
                  {
                    id: data.messageId || assistantTempId,
                    role: 'assistant',
                    content: data.fullContent,
                    timestamp: new Date()
                  }
                ];
              });
              
              setCurrentStreamMessage('');
              setStreaming(false);
            },
            onError: (error) => {
              setMessages(prev => prev.filter(m => 
                m.id !== tempMessage.id && m.id !== assistantTempId
              ));
              setCurrentStreamMessage('');
              setStreaming(false);
              toast.error(error.message || 'Failed to send message');
            }
          }
        );
      } catch (err: any) {
        setStreaming(false);
        throw err;
      }
    } else {
      // Standard non-streaming response
      try {
        const response = await chatService.sendMessage(content, conversationId);
        
        if (!conversationId) {
          setConversationId(response.conversationId);
        }

        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempMessage.id);
          return [...filtered, response.message];
        });

        return response;
      } catch (err: any) {
        setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        toast.error(err.response?.data?.error || 'Failed to send message');
        throw err;
      }
    }
  }, [conversationId, streaming]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setCurrentStreamMessage('');
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamMessage, scrollToBottom]);

  // Load history on mount if conversation ID is provided
  useEffect(() => {
    if (initialConversationId) {
      loadHistory();
    }
  }, [initialConversationId, loadHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    messages,
    conversationId,
    loading,
    streaming,
    currentStreamMessage,
    sendMessage,
    stopStreaming,
    clearMessages,
    loadHistory,
    messagesEndRef
  };
}