import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { authStore } from '@/stores/authStore';

class ApiService {
  private instance: AxiosInstance;
  
  constructor() {
    this.instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL || '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Request interceptor to add auth token
    this.instance.interceptors.request.use(
      (config) => {
        const token = authStore.getState().token || localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    
    // Response interceptor to handle auth errors
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          authStore.getState().logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }
  
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.get<T>(url, config);
  }
  
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.post<T>(url, data, config);
  }
  
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.put<T>(url, data, config);
  }
  
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.patch<T>(url, data, config);
  }
  
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.delete<T>(url, config);
  }
}

export const api = new ApiService();