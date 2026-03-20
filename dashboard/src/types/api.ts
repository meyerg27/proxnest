// ─── Auth ─────────────────────────────────────
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_login: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ─── Dashboard ────────────────────────────────
export interface DashboardData {
  cluster: {
    nodes: number;
    cpu: { total: number; used: number; percent: number };
    memory: { totalGB: number; usedGB: number; percent: number };
    disk: { totalGB: number; usedGB: number; percent: number };
  };
  guests: {
    vms: number;
    containers: number;
    running: number;
    stopped: number;
  };
  apps: number;
  users: number;
}

// ─── Nodes ────────────────────────────────────
export interface NodeInfo {
  name: string;
  status: string;
  cpu: { used: number; total: number; percent: number };
  memory: { used: number; total: number; percent: number; usedGB: number; totalGB: number };
  disk: { used: number; total: number; percent: number; usedGB: number; totalGB: number };
  uptime: number;
  uptimeFormatted: string;
}

// ─── Resources (VMs/Containers) ───────────────
export interface Resource {
  id: string;
  type: 'qemu' | 'lxc';
  vmid: number;
  name: string;
  node: string;
  status: string;
  cpu: number;
  memoryMB: number;
  maxMemoryMB: number;
  diskGB: number;
  uptime: number;
  networkIn: number;
  networkOut: number;
}

// ─── Storage ──────────────────────────────────
export interface StorageInfo {
  name: string;
  type: string;
  content: string[];
  total: number;
  used: number;
  available: number;
  percentUsed: number;
  totalGB: number;
  usedGB: number;
  availableGB: number;
  active: boolean;
  enabled: boolean;
  shared: boolean;
  health: 'healthy' | 'warning' | 'critical' | 'unknown';
}

export interface DiskInfo {
  path: string;
  model: string;
  serial: string;
  size: number;
  sizeGB: number;
  sizeTB: number;
  type: string;
  used: string;
  vendor: string;
  rpm: number;
  isSSD: boolean;
  wearout?: number;
  health: string;
}

// ─── App Store ────────────────────────────────
export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  type: 'lxc' | 'docker';
  tags: string[];
  website: string;
  webPort: number;
}

export interface InstalledApp {
  id: number;
  templateId: string;
  name: string;
  vmid: number | null;
  type: string;
  status: string;
  node: string;
  port: number | null;
  ipAddress: string | null;
  webUrl: string | null;
  icon: string;
  category: string;
  createdAt: string;
}

export interface AppCategory {
  id: string;
  name: string;
  count: number;
}

// ─── Notifications ────────────────────────────
export interface Notification {
  id: number;
  user_id: number;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: number;
  created_at: string;
}

// ─── ZFS ──────────────────────────────────────
export interface ZFSPool {
  name: string;
  size: number;
  sizeGB: number;
  sizeTB: number;
  alloc: number;
  allocGB: number;
  free: number;
  freeGB: number;
  frag: number;
  dedup: number;
  health: string;
  percentUsed: number;
}

export interface CreateZFSParams {
  name: string;
  raidlevel: 'single' | 'mirror' | 'raidz' | 'raidz2' | 'raidz3';
  devices: string[];
  ashift?: number;
  compression?: 'on' | 'off' | 'lz4' | 'gzip' | 'zstd';
  add_storage?: boolean;
}

// ─── RRD Metrics ──────────────────────────────
export interface RRDMetric {
  time: number;
  cpu: number | null;
  memUsed: number | null;
  memTotal: number | null;
  netIn: number | null;
  netOut: number | null;
  diskRead: number | null;
  diskWrite: number | null;
  loadAvg: number | null;
  iowait: number | null;
  swapUsed: number | null;
  swapTotal: number | null;
  rootUsed: number | null;
  rootTotal: number | null;
}

// ─── System ───────────────────────────────────
export interface HealthStatus {
  status: string;
  version: string;
  uptime: number;
  proxmox: { connected: boolean; error: string | null };
  database: string;
  appTemplates: number;
}
