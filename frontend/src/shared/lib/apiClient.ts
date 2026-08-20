/**
 * Ujrat Centralized Python Backend API Client
 * Dispatches all operational and business logic requests to the FastAPI operations backend.
 */
import { supabase } from '@/shared/lib/supabaseClient';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // Session retrieval error or running in zero-auth / test mode
  }
  return {};
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | undefined;
  body?: any;
  headers?: Record<string, string> | undefined;
  params?: Record<string, any> | undefined;
}

export async function apiRequest<T = any>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const authHeaders = await getAuthHeader();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  let url = `${API_BASE_URL}${normalizedPath}`;
  if (options.params) {
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null) {
        query.append(key, String(val));
      }
    }
    const qStr = query.toString();
    if (qStr) {
      url += (url.includes('?') ? '&' : '?') + qStr;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...(options.headers || {}),
  };

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    let errorDetail = response.statusText;
    let errorData = null;
    try {
      errorData = await response.json();
      if (errorData?.detail) {
        errorDetail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // Body not JSON
    }
    throw new ApiError(response.status, errorDetail, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const apiClient = {
  get: <T = any>(path: string, params?: Record<string, any>, headers?: Record<string, string>) =>
    apiRequest<T>(path, { method: 'GET', params, headers }),
  post: <T = any>(path: string, body?: any, params?: Record<string, any>, headers?: Record<string, string>) =>
    apiRequest<T>(path, { method: 'POST', body, params, headers }),
  put: <T = any>(path: string, body?: any, params?: Record<string, any>, headers?: Record<string, string>) =>
    apiRequest<T>(path, { method: 'PUT', body, params, headers }),
  delete: <T = any>(path: string, params?: Record<string, any>, headers?: Record<string, string>) =>
    apiRequest<T>(path, { method: 'DELETE', params, headers }),
};
