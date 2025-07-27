export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface ChatResponse {
  conversationId: string
  message: Message
}

export interface ConversationSummary {
  conversation_id: string
  title: string
  first_message: string
  last_message_at: Date
  message_count: number
  created_at: Date
}