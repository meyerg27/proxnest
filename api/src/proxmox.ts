/**
 * Proxmox VE API Client
 * Wraps the PVE REST API with typed methods.
 * Supports both API token and ticket-based auth.
 */

import { config } from './config.js';
import { Agent, fetch } from 'undici';

const agent = new Agent({
  connect: {
    rejectUnauthorized: config.PROXMOX_VERIFY_SSL,
  },
});

interface PveResponse<T = unknown> {
  data: T;
}

type AuthHeaders = Record<string, string>;

let ticketCache: { ticket: string; csrf: string; expires: number } | null = null;

async function getAuthHeaders(): Promise<AuthHeaders> {
  // Prefer API token auth
  if (config.PROXMOX_TOKEN_ID && config.PROXMOX_TOKEN_SECRET) {
    return {
      Authorization: `PVEAPIToken=${config.PROXMOX_TOKEN_ID}=${config.PROXMOX_TOKEN_SECRET}`,
    };
  }

  // Fall back to ticket auth
  if (config.PROXMOX_USERNAME && config.PROXMOX_PASSWORD) {
    if (ticketCache && Date.now() < ticketCache.expires) {
      return {
        Cookie: `PVEAuthCookie=${ticketCache.ticket}`,
        CSRFPreventionToken: ticketCache.csrf,
      };
    }

    const resp = await fetch(`${config.PROXMOX_HOST}/api2/json/access/ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: config.PROXMOX_USERNAME,
        password: config.PROXMOX_PASSWORD,
      }),
      dispatcher: agent,
    });

    const body = (await resp.json()) as PveResponse<{
      ticket: string;
      CSRFPreventionToken: string;
    }>;

    ticketCache = {
      ticket: body.data.ticket,
      csrf: body.data.CSRFPreventionToken,
      expires: Date.now() + 7000 * 1000, // ~2 hours, refresh early
    };

    return {
      Cookie: `PVEAuthCookie=${ticketCache.ticket}`,
      CSRFPreventionToken: ticketCache.csrf,
    };
  }

  throw new Error('No Proxmox credentials configured. Set PROXMOX_TOKEN_ID/SECRET or USERNAME/PASSWORD.');
}

export async function pveGet<T = unknown>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${config.PROXMOX_HOST}/api2/json${path}`, {
    headers,
    dispatcher: agent,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PVE GET ${path} failed (${resp.status}): ${text}`);
  }

  const body = (await resp.json()) as PveResponse<T>;
  return body.data;
}

export async function pvePost<T = unknown>(
  path: string,
  data?: Record<string, string | number | boolean>,
): Promise<T> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${config.PROXMOX_HOST}/api2/json${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: data ? new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
    dispatcher: agent,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PVE POST ${path} failed (${resp.status}): ${text}`);
  }

  const body = (await resp.json()) as PveResponse<T>;
  return body.data;
}

export async function pvePut<T = unknown>(
  path: string,
  data?: Record<string, string | number | boolean>,
): Promise<T> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${config.PROXMOX_HOST}/api2/json${path}`, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: data ? new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
    dispatcher: agent,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PVE PUT ${path} failed (${resp.status}): ${text}`);
  }

  const body = (await resp.json()) as PveResponse<T>;
  return body.data;
}

export async function pveDelete<T = unknown>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${config.PROXMOX_HOST}/api2/json${path}`, {
    method: 'DELETE',
    headers,
    dispatcher: agent,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PVE DELETE ${path} failed (${resp.status}): ${text}`);
  }

  const body = (await resp.json()) as PveResponse<T>;
  return body.data;
}

// ─── Typed API Methods ──────────────────────────────────────────

export interface PveNode {
  node: string;
  status: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
  type: string;
}

export interface PveResource {
  id: string;
  type: string;
  node: string;
  vmid?: number;
  name?: string;
  status: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  template?: number;
  netin?: number;
  netout?: number;
}

export interface PveStorage {
  storage: string;
  type: string;
  content: string;
  total: number;
  used: number;
  avail: number;
  active: number;
  enabled: number;
  shared: number;
}

export interface PveTask {
  upid: string;
  node: string;
  type: string;
  status: string;
  starttime: number;
  endtime?: number;
  user: string;
  id?: string;
}

export const proxmox = {
  // Cluster
  async getNodes(): Promise<PveNode[]> {
    return pveGet<PveNode[]>('/nodes');
  },

  async getClusterResources(type?: string): Promise<PveResource[]> {
    const query = type ? `?type=${type}` : '';
    return pveGet<PveResource[]>(`/cluster/resources${query}`);
  },

  // Node
  async getNodeStatus(node: string) {
    return pveGet(`/nodes/${node}/status`);
  },

  async getNodeNetworks(node: string) {
    return pveGet(`/nodes/${node}/network`);
  },

  async getNodeDisks(node: string) {
    return pveGet(`/nodes/${node}/disks/list`);
  },

  // Storage
  async getStorage(node: string): Promise<PveStorage[]> {
    return pveGet<PveStorage[]>(`/nodes/${node}/storage`);
  },

  async getStorageContent(node: string, storage: string) {
    return pveGet(`/nodes/${node}/storage/${storage}/content`);
  },

  // VMs / Containers
  async getContainers(node: string) {
    return pveGet(`/nodes/${node}/lxc`);
  },

  async getVMs(node: string) {
    return pveGet(`/nodes/${node}/qemu`);
  },

  async getContainerStatus(node: string, vmid: number) {
    return pveGet(`/nodes/${node}/lxc/${vmid}/status/current`);
  },

  async getVMStatus(node: string, vmid: number) {
    return pveGet(`/nodes/${node}/qemu/${vmid}/status/current`);
  },

  async startContainer(node: string, vmid: number) {
    return pvePost(`/nodes/${node}/lxc/${vmid}/status/start`);
  },

  async stopContainer(node: string, vmid: number) {
    return pvePost(`/nodes/${node}/lxc/${vmid}/status/stop`);
  },

  async startVM(node: string, vmid: number) {
    return pvePost(`/nodes/${node}/qemu/${vmid}/status/start`);
  },

  async stopVM(node: string, vmid: number) {
    return pvePost(`/nodes/${node}/qemu/${vmid}/status/stop`);
  },

  async createContainer(
    node: string,
    params: Record<string, string | number | boolean>,
  ) {
    return pvePost(`/nodes/${node}/lxc`, params);
  },

  async deleteContainer(node: string, vmid: number) {
    return pveDelete(`/nodes/${node}/lxc/${vmid}`);
  },

  async deleteVM(node: string, vmid: number) {
    return pveDelete(`/nodes/${node}/qemu/${vmid}`);
  },

  // Tasks
  async getNodeTasks(node: string, limit = 50): Promise<PveTask[]> {
    return pveGet<PveTask[]>(`/nodes/${node}/tasks?limit=${limit}`);
  },

  async getTaskStatus(node: string, upid: string) {
    return pveGet(`/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`);
  },

  async getTaskLog(node: string, upid: string, start = 0, limit = 50) {
    return pveGet(`/nodes/${node}/tasks/${encodeURIComponent(upid)}/log?start=${start}&limit=${limit}`);
  },

  // Container/VM logs (syslog)
  async getContainerLog(node: string, vmid: number, limit = 100) {
    try {
      return await pveGet<Array<{ t: number; n: number; d: string }>>(
        `/nodes/${node}/lxc/${vmid}/status/current`,
      ).then(async () => {
        // LXC doesn't have a direct log endpoint, use task log for recent operations
        const tasks = await pveGet<PveTask[]>(`/nodes/${node}/tasks?vmid=${vmid}&limit=5`);
        if (tasks.length === 0) return [{ t: Date.now() / 1000, n: 1, d: 'No recent task logs available' }];
        const latestUpid = tasks[0].upid;
        const log = await pveGet<Array<{ n: number; t: string }>>(
          `/nodes/${node}/tasks/${encodeURIComponent(latestUpid)}/log?start=0&limit=${limit}`,
        );
        return log.map((entry, i) => ({ t: tasks[0].starttime + i, n: entry.n, d: entry.t }));
      });
    } catch {
      return [{ t: Date.now() / 1000, n: 1, d: 'Unable to retrieve logs' }];
    }
  },

  // RRD data for time-series graphs
  async getNodeRRD(node: string, timeframe: 'hour' | 'day' | 'week' | 'month' | 'year' = 'hour') {
    return pveGet<Array<Record<string, number>>>(
      `/nodes/${node}/rrddata?timeframe=${timeframe}`,
    );
  },

  async getContainerRRD(node: string, vmid: number, timeframe: 'hour' | 'day' | 'week' | 'month' | 'year' = 'hour') {
    return pveGet<Array<Record<string, number>>>(
      `/nodes/${node}/lxc/${vmid}/rrddata?timeframe=${timeframe}`,
    );
  },

  async getVMRRD(node: string, vmid: number, timeframe: 'hour' | 'day' | 'week' | 'month' | 'year' = 'hour') {
    return pveGet<Array<Record<string, number>>>(
      `/nodes/${node}/qemu/${vmid}/rrddata?timeframe=${timeframe}`,
    );
  },

  // ZFS operations
  async listZFSPools(node: string) {
    return pveGet<Array<{
      name: string;
      size: number;
      alloc: number;
      free: number;
      frag: number;
      dedup: number;
      health: string;
    }>>(`/nodes/${node}/disks/zfs`);
  },

  async getZFSPool(node: string, name: string) {
    return pveGet(`/nodes/${node}/disks/zfs/${name}`);
  },

  async createZFSPool(
    node: string,
    params: { name: string; raidlevel: string; devices: string; ashift?: number; compression?: string; add_storage?: boolean },
  ) {
    return pvePost(`/nodes/${node}/disks/zfs`, {
      name: params.name,
      raidlevel: params.raidlevel,
      devices: params.devices,
      ...(params.ashift !== undefined && { ashift: params.ashift }),
      ...(params.compression && { compression: params.compression }),
      ...(params.add_storage !== undefined && { add_storage: params.add_storage ? 1 : 0 }),
    });
  },

  async listSmartData(node: string, disk: string) {
    return pveGet(`/nodes/${node}/disks/smart?disk=${encodeURIComponent(disk)}`);
  },

  // Next available VMID
  async getNextId(): Promise<number> {
    const data = await pveGet<string>('/cluster/nextid');
    return parseInt(data, 10);
  },
};
