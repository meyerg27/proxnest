/**
 * ProxNest Cloud — API Client
 */

const API_BASE = '/api/v1';

class CloudApi {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem('proxnest_cloud_token', token);
    } else {
      localStorage.removeItem('proxnest_cloud_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('proxnest_cloud_token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      this.setToken(null);
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data as T;
  }

  // ─── Auth ─────────────────────────────────────

  async register(email: string, password: string, displayName?: string) {
    return this.request<{ token: string; user: CloudUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ token: string; user: CloudUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getProfile() {
    return this.request<{ user: CloudUser }>('/auth/me');
  }

  async updateProfile(data: { display_name?: string; avatar_url?: string }) {
    return this.request<{ user: CloudUser }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }

  async logout() {
    return this.request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  }

  async getSessions() {
    return this.request<{ sessions: CloudSession[] }>('/auth/sessions');
  }

  async revokeSession(sessionId: number) {
    return this.request<{ ok: boolean }>(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
  }

  // ─── Servers ──────────────────────────────────

  async getServers() {
    return this.request<{ servers: CloudServer[] }>('/servers');
  }

  async getServer(id: number) {
    return this.request<{ server: CloudServer & { metrics?: ServerMetrics } }>(`/servers/${id}`);
  }

  async claimServer(claimToken: string, name?: string) {
    return this.request<{ server: CloudServer }>('/servers/claim', {
      method: 'POST',
      body: JSON.stringify({ claim_token: claimToken, name }),
    });
  }

  async updateServer(id: number, data: { name?: string }) {
    return this.request<{ server: CloudServer }>(`/servers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async removeServer(id: number) {
    return this.request<{ ok: boolean }>(`/servers/${id}`, { method: 'DELETE' });
  }

  async sendCommand(serverId: number, action: string, params?: Record<string, unknown>) {
    return this.request<{ success: boolean; data?: unknown; error?: string }>(
      `/servers/${serverId}/command`,
      { method: 'POST', body: JSON.stringify({ action, params }) },
    );
  }

  // ─── Proxy ────────────────────────────────────

  async proxyGet<T>(serverId: number, path: string) {
    return this.request<T>(`/proxy/${serverId}${path}`);
  }

  async proxyPost<T>(serverId: number, path: string, body?: unknown) {
    return this.request<T>(`/proxy/${serverId}${path}`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  getProxyStatus(serverId: number) {
    return this.request<{ server_id: number; name: string; online: boolean; metrics?: ServerMetrics }>(
      `/proxy-status/${serverId}`,
    );
  }
}

// ─── Types ──────────────────────────────────────

export interface CloudUser {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: 'free' | 'pro';
  max_servers: number;
  created_at: string;
}

export interface CloudServer {
  id: number;
  agent_id: string;
  name: string;
  hostname: string | null;
  os: string | null;
  cpu_model: string | null;
  cpu_cores: number | null;
  ram_total_mb: number | null;
  proxmox_version: string | null;
  agent_version: string | null;
  is_online: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface ServerMetrics {
  cpu_usage: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  uptime_seconds: number;
  load_average: number[];
  containers_running: number;
  containers_total: number;
}

export interface CloudSession {
  id: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  revoked: number;
}

export const api = new CloudApi();
