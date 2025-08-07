import api from '@/lib/api'

// Contact Types
export interface Contact {
  contact_id: string
  user_id: string
  first_name: string
  last_name: string
  preferred_name?: string
  email?: string
  phone?: string
  linkedin_url?: string
  current_title?: string
  current_company?: string
  location?: string
  bio?: string
  contact_source?: 'manual' | 'linkedin' | 'event' | 'referral'
  relationship_type?: 'mentor' | 'peer' | 'report' | 'recruiter' | 'friend'
  relationship_strength?: number
  personal_interests?: string[]
  professional_context?: {
    industry?: string
    skills?: string[]
    years_experience?: number
  }
  tags?: string[]
  last_interaction?: string
  total_interactions?: number
  created_at: string
  updated_at?: string
}

export interface ContactFilters {
  search?: string
  relationshipType?: 'mentor' | 'peer' | 'report' | 'recruiter' | 'friend'
  minStrength?: number
  company?: string
  sortBy?: 'first_name' | 'last_name' | 'company' | 'last_interaction' | 'relationship_strength'
  sortOrder?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export interface ContactAnalytics {
  total_contacts: number
  contacts_by_relationship: Record<string, number>
  average_relationship_strength: number
  contacts_by_source: Record<string, number>
  recent_interactions: number
  overdue_followups: number
  network_growth: {
    month: string
    contacts_added: number
  }[]
}

// Interaction Types
export interface Interaction {
  interaction_id: string
  user_id: string
  contact_id: string
  interaction_type: 'meeting' | 'email' | 'call' | 'message' | 'event'
  interaction_date: string
  subject: string
  notes?: string
  location?: string
  duration_minutes?: number
  sentiment?: 'positive' | 'neutral' | 'negative'
  follow_up_required?: boolean
  follow_up_date?: string
  follow_up_notes?: string
  value_exchanged?: {
    given?: string[]
    received?: string[]
  }
  meeting_notes?: MeetingNotes
  created_at: string
  updated_at?: string
}

export interface InteractionFilters {
  contactId?: string
  interactionType?: 'meeting' | 'email' | 'call' | 'message' | 'event'
  startDate?: string
  endDate?: string
  sentiment?: 'positive' | 'neutral' | 'negative'
  followUpRequired?: boolean
  limit?: number
  offset?: number
}

// Meeting Notes Types
export interface MeetingNotes {
  meeting_id?: string
  interaction_id: string
  meeting_purpose?: string
  key_topics?: string[]
  action_items?: {
    item: string
    owner?: string
    due_date?: string
    completed?: boolean
  }[]
  decisions_made?: string[]
  next_steps?: string
  personal_notes?: string
  professional_insights?: string
}

export interface MeetingInsights {
  total_meetings: number
  average_duration: number
  meetings_by_type: Record<string, number>
  top_discussion_topics: { topic: string; count: number }[]
  action_items_completion_rate: number
  sentiment_distribution: {
    positive: number
    neutral: number
    negative: number
  }
}

// Reminder Types
export interface Reminder {
  reminder_id: string
  user_id: string
  contact_id: string
  reminder_type: 'follow_up' | 'birthday' | 'milestone' | 'check_in'
  reminder_date: string
  reminder_time?: string
  subject: string
  notes?: string
  status: 'pending' | 'sent' | 'completed' | 'snoozed' | 'cancelled'
  is_recurring?: boolean
  recurrence_pattern?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  created_at: string
  updated_at?: string
}

export interface ReminderFilters {
  status?: 'pending' | 'sent' | 'completed' | 'snoozed' | 'cancelled'
  contactId?: string
  reminderType?: 'follow_up' | 'birthday' | 'milestone' | 'check_in'
  startDate?: string
  endDate?: string
  includeCompleted?: boolean
  limit?: number
  offset?: number
}

// Recommendation Types
export interface NetworkingRecommendation {
  recommendation_id: string
  type: 'reconnect' | 'introduce' | 'follow_up' | 'expand'
  contact_id?: string
  reason: string
  action_suggested: string
  priority: 'high' | 'medium' | 'low'
  created_at: string
}

export interface NetworkingInsights {
  network_size: number
  network_diversity_score: number
  interaction_frequency: {
    daily_average: number
    weekly_average: number
    monthly_average: number
  }
  relationship_health: {
    strong: number
    moderate: number
    weak: number
    dormant: number
  }
  top_connectors: Contact[]
  network_gaps: string[]
  growth_opportunities: string[]
}

// Service Methods
export const networkingService = {
  // Contact Management
  listContacts: async (filters?: ContactFilters) => {
    const response = await api.get('/api/networking/contacts', { params: filters })
    return response.data
  },

  searchContacts: async (query: string) => {
    const response = await api.get('/api/networking/contacts/search', { params: { q: query } })
    return response.data
  },

  getContactAnalytics: async () => {
    const response = await api.get('/api/networking/contacts/analytics')
    return response.data
  },

  getContact: async (contactId: string) => {
    const response = await api.get(`/api/networking/contacts/${contactId}`)
    return response.data
  },

  createContact: async (contact: Omit<Contact, 'contact_id' | 'user_id' | 'created_at'>) => {
    const response = await api.post('/api/networking/contacts', contact)
    return response.data
  },

  updateContact: async (contactId: string, updates: Partial<Contact>) => {
    const response = await api.put(`/api/networking/contacts/${contactId}`, updates)
    return response.data
  },

  deleteContact: async (contactId: string) => {
    const response = await api.delete(`/api/networking/contacts/${contactId}`)
    return response.data
  },

  addContactTags: async (contactId: string, tags: string[]) => {
    const response = await api.post(`/api/networking/contacts/${contactId}/tags`, { tags })
    return response.data
  },

  // Interactions
  listInteractions: async (filters?: InteractionFilters) => {
    const response = await api.get('/api/networking/interactions', { params: filters })
    return response.data
  },

  logInteraction: async (interaction: Omit<Interaction, 'interaction_id' | 'user_id' | 'created_at'>) => {
    const response = await api.post('/api/networking/interactions', interaction)
    return response.data
  },

  getInteraction: async (interactionId: string) => {
    const response = await api.get(`/api/networking/interactions/${interactionId}`)
    return response.data
  },

  updateInteraction: async (interactionId: string, updates: Partial<Interaction>) => {
    const response = await api.put(`/api/networking/interactions/${interactionId}`, updates)
    return response.data
  },

  // Meeting Notes
  createMeetingNotes: async (notes: MeetingNotes) => {
    const response = await api.post('/api/networking/meetings', notes)
    return response.data
  },

  updateMeetingNotes: async (meetingId: string, updates: Partial<MeetingNotes>) => {
    const response = await api.put(`/api/networking/meetings/${meetingId}`, updates)
    return response.data
  },

  getMeetingInsights: async (timeframeDays?: number) => {
    const response = await api.get('/api/networking/meetings/insights', {
      params: { timeframe: timeframeDays }
    })
    return response.data
  },

  // Reminders
  listReminders: async (filters?: ReminderFilters) => {
    const response = await api.get('/api/networking/reminders', { params: filters })
    return response.data
  },

  createReminder: async (reminder: Omit<Reminder, 'reminder_id' | 'user_id' | 'created_at'>) => {
    const response = await api.post('/api/networking/reminders', reminder)
    return response.data
  },

  updateReminder: async (reminderId: string, updates: Partial<Reminder>) => {
    const response = await api.put(`/api/networking/reminders/${reminderId}`, updates)
    return response.data
  },

  completeReminder: async (reminderId: string) => {
    const response = await api.post(`/api/networking/reminders/${reminderId}/complete`)
    return response.data
  },

  getUpcomingReminders: async (days?: number) => {
    const response = await api.get('/api/networking/reminders/upcoming', {
      params: { days: days || 7 }
    })
    return response.data
  },

  // Recommendations
  getRecommendations: async () => {
    const response = await api.get('/api/networking/networking/recommendations')
    return response.data
  },

  dismissRecommendation: async (recommendationId: string) => {
    const response = await api.post(`/api/networking/networking/recommendations/${recommendationId}/dismiss`)
    return response.data
  },

  getNetworkingInsights: async () => {
    const response = await api.get('/api/networking/networking/insights')
    return response.data
  }
}

export default networkingService