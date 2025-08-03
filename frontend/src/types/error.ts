/**
 * Error types for consistent error handling
 */

export interface ErrorDetails {
  code?: string
  message: string
  field?: string
  details?: Record<string, string>
}

export interface SerializedError {
  name: string
  message: string
  code?: string
  stack?: string
  details?: Record<string, string>
}

export type ErrorHandler = (error: Error | SerializedError) => void