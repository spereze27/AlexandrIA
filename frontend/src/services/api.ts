/** Axios API client for all backend endpoints. */

import axios from 'axios';
import type {
  AgentRequest,
  AgentResponse,
  AuthTokenResponse,
  DashboardData,
  Form,
  FormListItem,
  FormSchema,
  Submission,
} from '../types/form';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  loginWithGoogle: (accessToken: string) =>
    api.post<AuthTokenResponse>('/auth/google', { access_token: accessToken }),

  getMe: () => api.get<AuthTokenResponse['user']>('/auth/me'),
};

// ── Forms ───────────────────────────────────────────────────────────────────

export const formsApi = {
  list: (activeOnly = true) =>
    api.get<FormListItem[]>('/forms/', { params: { active_only: activeOnly } }),

  get: (id: string) => api.get<Form>(`/forms/${id}`),

  create: (data: { name: string; description?: string; schema: FormSchema }) =>
    api.post<Form>('/forms/', data),

  update: (id: string, data: Partial<{ name: string; description: string; schema: FormSchema; is_active: boolean }>) =>
    api.patch<Form>(`/forms/${id}`, data),

  delete: (id: string) => api.delete(`/forms/${id}`),

  getPublic: (id: string) =>
    api.get<{ id: string; name: string; schema: FormSchema }>(`/forms/${id}/public`),
};

// ── Submissions ─────────────────────────────────────────────────────────────

export const submissionsApi = {
  create: (data: {
    form_id: string;
    data: Record<string, unknown>;
    gps_lat?: number;
    gps_lng?: number;
    client_id?: string;
    offline_created_at?: string;
  }) => api.post<Submission>('/submissions/', data),

  batchSync: (submissions: Array<{
    form_id: string;
    data: Record<string, unknown>;
    gps_lat?: number;
    gps_lng?: number;
    client_id?: string;
    offline_created_at?: string;
  }>) => api.post<{ synced: number; duplicates_skipped: number; errors: string[] }>(
    '/submissions/batch',
    { submissions },
  ),

  list: (formId: string, limit = 100, offset = 0) =>
    api.get<Submission[]>(`/submissions/${formId}`, { params: { limit, offset } }),

  uploadMedia: (submissionId: string, fieldKey: string, file: File, gpsLat?: number, gpsLng?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/submissions/${submissionId}/media`, formData, {
      params: { field_key: fieldKey, gps_lat: gpsLat, gps_lng: gpsLng },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Agent ───────────────────────────────────────────────────────────────────

export const agentApi = {
  generate: (data: AgentRequest) => api.post<AgentResponse>('/agent/generate', data),
};

// ── Dashboard ──────────────────────────────────────────────────────────────

export const dashboardApi = {
  get: (formId: string) => api.get<DashboardData>(`/dashboard/${formId}`),
};

export default api;
