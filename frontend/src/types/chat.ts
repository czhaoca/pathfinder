import { Metadata } from './common'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: Metadata
}

export interface ChatResponse {
  conversationId: string
  message: Message
}

export interface ConversationSummary {
  conversationId: string
  title: string
  firstMessage: string
  lastMessageAt: Date
  messageCount: number
  createdAt: Date
}