/**
 * Common type definitions
 */

export type ID = string

export interface Metadata {
  [key: string]: string | number | boolean | null
}

export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface TimeRange {
  start: Date | string
  end: Date | string
}

export interface KeyValue<T = string> {
  key: string
  value: T
}

export type AsyncFunction<T = void> = () => Promise<T>

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export type FormErrors = Record<string, string | undefined>

export interface LoadingState {
  isLoading: boolean
  error?: Error | null
}

export interface ChartDataPoint {
  x: string | number
  y: number
  label?: string
  [key: string]: string | number | undefined
}