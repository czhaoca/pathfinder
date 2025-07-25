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
  conversationId: string
  firstMessage: {
    content: string
    timestamp: Date
  }
  lastMessage: {
    content: string
    timestamp: Date
  }
  messageCount: number
  userMessageCount: number
  duration: number
}