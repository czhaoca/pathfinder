// User types
export interface User {
  id: string
  username: string
  email: string
  firstName?: string
  lastName?: string
  createdAt: string
  lastLogin?: string
  accountStatus: 'active' | 'inactive' | 'suspended'
}

// Authentication types
export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
  firstName?: string
  lastName?: string
}

export interface AuthResponse {
  token: string
  refreshToken: string
  user: User
}

// Experience types
export interface Experience {
  id: string
  userId: string
  role: string
  organization: string
  startDate: string
  endDate?: string
  current: boolean
  description: string
  achievements: string[]
  skills: string[]
  location?: string
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship' | 'volunteer'
  createdAt: string
  updatedAt: string
}

export interface ExperienceInput {
  role: string
  organization: string
  startDate: string
  endDate?: string
  current: boolean
  description: string
  achievements: string[]
  skills: string[]
  location?: string
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship' | 'volunteer'
}

// Profile types
export interface ProfileSummary {
  id: string
  userId: string
  professionalSummary: string
  yearsOfExperience: number
  currentRole?: string
  currentOrganization?: string
  topSkills: Skill[]
  careerHighlights: string[]
  industries: string[]
  updatedAt: string
}

export interface Skill {
  name: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  yearsOfExperience: number
  endorsements?: number
}

// Chat types
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: {
    tools?: string[]
    context?: any
  }
}

export interface ChatSession {
  id: string
  userId: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

// Quick context types
export interface QuickContext {
  userId: string
  fullName?: string
  currentRole?: string
  yearsExperience: number
  topSkills: string[]
  careerGoal?: string
  lastUpdated: string
}

// Career analysis types
export interface CareerPath {
  currentStage: string
  nextSteps: CareerStep[]
  timeline: string
  requiredSkills: Skill[]
  recommendedActions: string[]
}

export interface CareerStep {
  role: string
  description: string
  requiredSkills: string[]
  estimatedTimeframe: string
  salaryRange?: {
    min: number
    max: number
    currency: string
  }
}

// Filter types
export interface ExperienceFilters {
  search?: string
  skills?: string[]
  organizations?: string[]
  dateRange?: {
    start: string
    end: string
  }
  employmentType?: string[]
}

// API Response types
export interface ApiResponse<T> {
  data: T
  message?: string
  status: 'success' | 'error'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface ErrorResponse {
  error: string
  message: string
  statusCode: number
  timestamp: string
}