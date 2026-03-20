/**
 * ProxNest API Client
 * Handles all HTTP communication with the backend.
 */

const API_BASE = '/api/v1';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  return localStorage.getItem('proxnest_token');
}

export function setToken(token: string): void {
  localStorage.setItem('proxnest_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('proxnest_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (resp.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new ApiError(401, 'Unauthorized');
  }

  const data = await resp.json();

  if (!resp.ok) {
    throw new ApiError(resp.status, data.error || 'Request failed', data.details);
  }

  return data as T;
}

// ─── Auth ────────────────────────────────────────
import type {
  AuthResponse,
  User,
  DashboardData,
  NodeInfo,
  Resource,
  StorageInfo,
  DiskInfo,
  AppTemplate,
  AppCategory,
  InstalledApp,
  Notification,
  HealthStatus,
} from '@/types/api';

export const auth = {
  login: (username: string, password: string) =>
    request<AuthResponse>('POST', '/auth/login', { username, password }),

  register: (username: string, email: string, password: string, display_name?: string) =>
    request<AuthResponse>('POST', '/auth/register', { username, email, password, display_name }),

  me: () => request<{ user: User }>('GET', '/auth/me'),

  setupRequired: () => request<{ setupRequired: boolean }>('GET', '/auth/setup-required'),
};

// ─── Dashboard ───────────────────────────────────
export const dashboard = {
  summary: () => request<DashboardData>('GET', '/dashboard'),
};

// ─── Nodes ───────────────────────────────────────
export const nodes = {
  list: () => request<{ nodes: NodeInfo[] }>('GET', '/nodes'),
  detail: (node: string) => request<{ status: unknown; networks: unknown; disks: unknown }>('GET', `/nodes/${node}`),
  resources: () => request<{ resources: Resource[] }>('GET', '/resources'),
  action: (node: string, type: string, vmid: number, action: string) =>
    request<{ ok: boolean }>('POST', `/nodes/${node}/${type}/${vmid}/action`, { action }),
  tasks: (node: string, limit = 20) => request<{ tasks: unknown[] }>('GET', `/nodes/${node}/tasks?limit=${limit}`),
};

// ─── Storage ─────────────────────────────────────
export const storage = {
  list: (node: string) => request<{ storages: StorageInfo[] }>('GET', `/nodes/${node}/storage`),
  content: (node: string, storageName: string) =>
    request<{ content: unknown[] }>('GET', `/nodes/${node}/storage/${storageName}/content`),
  disks: (node: string) => request<{ disks: DiskInfo[] }>('GET', `/nodes/${node}/disks`),
  summary: () => request<{ summary: unknown[] }>('GET', '/storage/summary'),
};

// ─── Apps ────────────────────────────────────────
export interface ComposeStackSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  apps: string[];
  webPorts: Record<string, number>;
}

export const apps = {
  store: (params?: { category?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return request<{ templates: AppTemplate[]; categories: AppCategory[]; total: number }>(
      'GET',
      `/apps/store${qs ? `?${qs}` : ''}`,
    );
  },
  templateDetail: (id: string) => request<{ template: AppTemplate }>('GET', `/apps/store/${id}`),
  installed: () => request<{ apps: InstalledApp[] }>('GET', '/apps/installed'),
  install: (template_id: string, name?: string, node = 'pve') =>
    request<{ message: string; app: { id: number } }>('POST', '/apps/install', { template_id, name, node }),
  uninstall: (id: number) => request<{ ok: boolean }>('DELETE', `/apps/installed/${id}`),
  featured: () => request<{ templates: AppTemplate[] }>('GET', '/apps/featured'),
  stacks: () => request<{ stacks: ComposeStackSummary[] }>('GET', '/apps/stacks'),
  stackDetail: (id: string) => request<{ stack: ComposeStackSummary & { compose: string } }>('GET', `/apps/stacks/${id}`),
  installStack: (id: string) => request<{ message: string }>('POST', `/apps/stacks/${id}/install`),
};

// ─── Users ───────────────────────────────────────
export const users = {
  list: () => request<{ users: User[] }>('GET', '/users'),
  update: (id: number, data: Partial<User>) => request<{ user: User }>('PATCH', `/users/${id}`, data),
  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean }>('POST', '/users/change-password', { current_password, new_password }),
  remove: (id: number) => request<{ ok: boolean }>('DELETE', `/users/${id}`),
};

// ─── System ──────────────────────────────────────
export const system = {
  health: () => request<HealthStatus>('GET', '/health'),
  notifications: () => request<{ notifications: Notification[]; unread: number }>('GET', '/notifications'),
  readAllNotifications: () => request<{ ok: boolean }>('POST', '/notifications/read-all'),
  settings: () => request<{ settings: Record<string, unknown> }>('GET', '/settings'),
  updateSettings: (data: Record<string, unknown>) => request<{ ok: boolean }>('PUT', '/settings', data),
  auditLog: (limit = 100) => request<{ logs: unknown[] }>('GET', `/audit-log?limit=${limit}`),
};
