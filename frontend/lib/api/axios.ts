/**
 * Axios configuration for API requests
 *
 * In development, requests are proxied through Next.js rewrites:
 *   Browser → localhost:3000/api/v1/* → localhost:8000/api/v1/*
 * This avoids CORS preflight overhead since same-origin requests don't
 * need OPTIONS pre-flight.
 *
 * Auth tokens are obtained from the Supabase session (cookie-based).
 * No manual localStorage management is needed.
 */
import { createClient } from '@/lib/supabase/client';
import axios from 'axios';

const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';

// Use relative URL so requests route through Next.js rewrites (same-origin)
// In production, set NEXT_PUBLIC_API_URL to the actual backend if not proxied
const isServer = typeof window === 'undefined';
const baseURL = isServer
  ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/${API_VERSION}`
  : `/api/${API_VERSION}`;

// Create axios instance with default configuration
export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach Supabase access token for backend calls
apiClient.interceptors.request.use(
  async (config) => {
    // Attach Supabase access token if available (browser only)
    if (typeof window !== 'undefined') {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`;
        }
      } catch {
        // Silent — unauthenticated requests are fine for public endpoints
      }
    }

    // Log requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`,
        response.status
      );
    }
    return response;
  },
  (error) => {
    // Log errors
    console.error('❌ API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });

    return Promise.reject(error);
  }
);

export default apiClient;
