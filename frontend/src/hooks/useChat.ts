import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { chatService } from '@/services/chatService';
import { Message } from '@/types/chat';

export function useChat(initialConversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || sending) return;

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, tempMessage]);
    setSending(true);

    try {
      const response = await chatService.sendMessage(content, conversationId);
      
      // Update conversation ID if this is a new conversation
      if (!conversationId) {
        setConversationId(response.conversationId);
      }

      // Replace temp message with actual message and add assistant response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempMessage.id);
        return [...filtered, response.message];
      });

      return response;
    } catch (err: any) {
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      toast.error(err.response?.data?.error || 'Failed to send message');
      throw err;
    } finally {
      setSending(false);
    }
  }, [conversationId, sending]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load history on mount if conversation ID is provided
  useEffect(() => {
    if (initialConversationId) {
      loadHistory();
    }
  }, [initialConversationId, loadHistory]);

  return {
    messages,
    conversationId,
    loading,
    sending,
    sendMessage,
    clearMessages,
    loadHistory,
    messagesEndRef
  };
}