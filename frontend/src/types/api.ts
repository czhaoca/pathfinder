/**
 * Standardized API response types
 */

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data: T | null
  timestamp: string
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, string>
    stack?: string
  }
  timestamp: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type ApiResult<T> = ApiResponse<T> | ApiError

// Type guard to check if response is an error
export function isApiError(response: any): response is ApiError {
  return response && response.success === false && 'error' in response
}

// Type guard to check if response is successful
export function isApiSuccess<T>(response: any): response is ApiResponse<T> {
  return response && response.success === true && 'data' in response
}