/**
 * Common types used across the application
 */

// User related types
export interface User {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  isActive: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt?: string
}

export type UserRole = 'admin' | 'user' | 'guest'

// Base entity types
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
  sort?: string
  order?: 'ASC' | 'DESC'
}

export interface PaginationMeta {
  total: number
  page: number
  perPage: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// Filter types
export interface DateRangeFilter {
  startDate?: string
  endDate?: string
}

export interface SearchFilter {
  query?: string
  fields?: string[]
}

// Status types
export type Status = 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

// File types
export interface FileUpload {
  filename: string
  mimetype: string
  size: number
  url?: string
}

// Error types
export interface ApiError {
  message: string
  code?: string
  field?: string
  details?: any
}

// Response types
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data: T
  timestamp: string
  errors?: ApiError[]
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: PaginationMeta
}

// Form types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'radio'
  value?: any
  required?: boolean
  disabled?: boolean
  placeholder?: string
  options?: SelectOption[]
  validation?: ValidationRule[]
}

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface ValidationRule {
  type: 'required' | 'email' | 'min' | 'max' | 'pattern' | 'custom'
  value?: any
  message: string
  validator?: (value: any) => boolean
}

// Navigation types
export interface NavItem {
  id: string
  label: string
  path?: string
  icon?: string
  badge?: number | string
  children?: NavItem[]
  permissions?: string[]
}

export interface Breadcrumb {
  label: string
  path?: string
  active?: boolean
}

// Notification types
export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  timestamp: string
  read?: boolean
  action?: {
    label: string
    url: string
  }
}

// Settings types
export interface Settings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
  dateFormat: string
  notifications: NotificationSettings
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  inApp: boolean
  digest: 'none' | 'daily' | 'weekly'
}