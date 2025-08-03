/**
 * Frontend error handling utilities
 */

import { toast } from 'sonner'
import { isApiError } from '@/types/api'

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, string>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(message, 'VALIDATION_ERROR', fields)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR')
    this.name = 'AuthenticationError'
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network request failed') {
    super(message, 'NETWORK_ERROR')
    this.name = 'NetworkError'
  }
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error: any, showToast = true): AppError {
  let appError: AppError
  
  if (isApiError(error)) {
    appError = new AppError(
      error.error.message,
      error.error.code,
      error.error.details
    )
  } else if (error.response?.data) {
    // Axios error with response
    const data = error.response.data
    appError = new AppError(
      data.error?.message || data.message || 'Request failed',
      data.error?.code || data.code,
      data.error?.details
    )
  } else if (error.request) {
    // Network error
    appError = new NetworkError('Network request failed. Please check your connection.')
  } else if (error instanceof Error) {
    appError = new AppError(error.message)
  } else {
    appError = new AppError('An unexpected error occurred')
  }
  
  if (showToast) {
    toast.error(appError.message)
  }
  
  return appError
}

/**
 * Type-safe error handler for async operations
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options?: {
    showToast?: boolean
    fallbackValue?: T
    onError?: (error: AppError) => void
  }
): Promise<T | undefined> {
  try {
    return await operation()
  } catch (error) {
    const appError = handleApiError(error, options?.showToast ?? true)
    
    if (options?.onError) {
      options.onError(appError)
    }
    
    return options?.fallbackValue
  }
}

/**
 * Validation helper
 */
export function validateRequired<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${fieldName} is required`, {
      [fieldName]: 'This field is required'
    })
  }
  return value
}

export function validateEmail(email: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', {
      email: 'Must be a valid email address'
    })
  }
  return email.toLowerCase().trim()
}

export function validatePassword(password: string): string {
  if (password.length < 8) {
    throw new ValidationError('Password too short', {
      password: 'Must be at least 8 characters'
    })
  }
  return password
}