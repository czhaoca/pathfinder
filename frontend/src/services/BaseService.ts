import api from './api'

/**
 * Generic API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data: T
  timestamp: string
  errors?: any
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    total: number
    page: number
    perPage: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Common query parameters
 */
export interface QueryParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'ASC' | 'DESC'
  q?: string
  [key: string]: any
}

/**
 * Base Service Class
 * Provides common API operations for all services
 */
export class BaseService<T = any> {
  protected endpoint: string

  constructor(endpoint: string) {
    this.endpoint = endpoint
  }

  /**
   * Get all resources with pagination
   */
  async getAll(params?: QueryParams): Promise<PaginatedResponse<T>> {
    const response = await api.get<ApiResponse<PaginatedResponse<T>>>(this.endpoint, { params })
    return response.data.data
  }

  /**
   * Get resource by ID
   */
  async getById(id: string | number): Promise<T> {
    const response = await api.get<ApiResponse<T>>(`${this.endpoint}/${id}`)
    return response.data.data
  }

  /**
   * Create new resource
   */
  async create(data: Partial<T>): Promise<T> {
    const response = await api.post<ApiResponse<T>>(this.endpoint, data)
    return response.data.data
  }

  /**
   * Update resource
   */
  async update(id: string | number, data: Partial<T>): Promise<T> {
    const response = await api.put<ApiResponse<T>>(`${this.endpoint}/${id}`, data)
    return response.data.data
  }

  /**
   * Delete resource
   */
  async delete(id: string | number): Promise<void> {
    await api.delete(`${this.endpoint}/${id}`)
  }

  /**
   * Bulk create resources
   */
  async bulkCreate(items: Partial<T>[]): Promise<T[]> {
    const response = await api.post<ApiResponse<T[]>>(`${this.endpoint}/bulk`, { items })
    return response.data.data
  }

  /**
   * Bulk update resources
   */
  async bulkUpdate(ids: (string | number)[], data: Partial<T>): Promise<any> {
    const response = await api.put<ApiResponse<any>>(`${this.endpoint}/bulk`, { ids, data })
    return response.data.data
  }

  /**
   * Bulk delete resources
   */
  async bulkDelete(ids: (string | number)[]): Promise<void> {
    await api.delete(`${this.endpoint}/bulk`, { data: { ids } })
  }

  /**
   * Search resources
   */
  async search(query: string, params?: Omit<QueryParams, 'q'>): Promise<PaginatedResponse<T>> {
    const response = await api.get<ApiResponse<PaginatedResponse<T>>>(`${this.endpoint}/search`, {
      params: { q: query, ...params }
    })
    return response.data.data
  }

  /**
   * Count resources
   */
  async count(filters?: Record<string, any>): Promise<number> {
    const response = await api.get<ApiResponse<{ count: number }>>(`${this.endpoint}/count`, {
      params: filters
    })
    return response.data.data.count
  }

  /**
   * Check if resource exists
   */
  async exists(filters: Record<string, any>): Promise<boolean> {
    const response = await api.get<ApiResponse<{ exists: boolean }>>(`${this.endpoint}/exists`, {
      params: filters
    })
    return response.data.data.exists
  }

  /**
   * Upload file
   */
  async uploadFile(file: File, additionalData?: Record<string, any>): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value)
      })
    }

    const response = await api.post<ApiResponse<any>>(`${this.endpoint}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data.data
  }

  /**
   * Download file
   */
  async downloadFile(id: string | number, filename?: string): Promise<Blob> {
    const response = await api.get(`${this.endpoint}/${id}/download`, {
      responseType: 'blob'
    })
    
    // Create download link if filename provided
    if (filename) {
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
    
    return response.data
  }

  /**
   * Export data
   */
  async export(format: 'csv' | 'xlsx' | 'json' | 'pdf', filters?: Record<string, any>): Promise<Blob> {
    const response = await api.get(`${this.endpoint}/export`, {
      params: { format, ...filters },
      responseType: 'blob'
    })
    return response.data
  }

  /**
   * Import data
   */
  async import(file: File, options?: Record<string, any>): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, value)
      })
    }

    const response = await api.post<ApiResponse<any>>(`${this.endpoint}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data.data
  }

  /**
   * Get metadata
   */
  async getMetadata(): Promise<any> {
    const response = await api.get<ApiResponse<any>>(`${this.endpoint}/metadata`)
    return response.data.data
  }

  /**
   * Custom GET request
   */
  async get<R = any>(path: string, params?: any): Promise<R> {
    const response = await api.get<ApiResponse<R>>(`${this.endpoint}${path}`, { params })
    return response.data.data
  }

  /**
   * Custom POST request
   */
  async post<R = any>(path: string, data?: any): Promise<R> {
    const response = await api.post<ApiResponse<R>>(`${this.endpoint}${path}`, data)
    return response.data.data
  }

  /**
   * Custom PUT request
   */
  async put<R = any>(path: string, data?: any): Promise<R> {
    const response = await api.put<ApiResponse<R>>(`${this.endpoint}${path}`, data)
    return response.data.data
  }

  /**
   * Custom DELETE request
   */
  async deleteCustom<R = any>(path: string, data?: any): Promise<R> {
    const response = await api.delete<ApiResponse<R>>(`${this.endpoint}${path}`, { data })
    return response.data.data
  }
}