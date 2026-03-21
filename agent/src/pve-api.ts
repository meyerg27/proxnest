/**
 * ProxNest — Proxmox VE REST API Client
 * All host-level operations go through this instead of shell commands.
 * Works from inside a CT with API token access.
 */

export class PveApi {
  private host: string;
  private tokenId: string;
  private tokenSecret: string;
  private node: string;

  constructor() {
    this.host = process.env.PROXMOX_HOST || 'https://localhost:8006';
    this.tokenId = process.env.PROXMOX_TOKEN_ID || '';
    this.tokenSecret = process.env.PROXMOX_TOKEN_SECRET || '';
    this.node = process.env.PROXMOX_NODE || 'pve';
  }

  get nodeName(): string {
    return this.node;
  }

  get available(): boolean {
    return !!(this.host && this.tokenId && this.tokenSecret);
  }

  private get authHeader(): string {
    return `PVEAPIToken=${this.tokenId}=${this.tokenSecret}`;
  }

  async get(path: string, timeout = 15000): Promise<any> {
    const res = await fetch(`${this.host}${path}`, {
      headers: { Authorization: this.authHeader },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`PVE API ${res.status}: ${path} — ${body.slice(0, 200)}`);
    }
    return (await res.json() as any).data;
  }

  async post(path: string, body?: Record<string, any>, timeout = 30000): Promise<any> {
    const opts: RequestInit = {
      method: 'POST',
      headers: { Authorization: this.authHeader },
      signal: AbortSignal.timeout(timeout),
    };
    if (body) {
      opts.headers = { ...opts.headers as any, 'Content-Type': 'application/x-www-form-urlencoded' };
      opts.body = new URLSearchParams(
        Object.entries(body).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null) acc[k] = String(v);
          return acc;
        }, {} as Record<string, string>)
      ).toString();
    }
    const res = await fetch(`${this.host}${path}`, opts);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PVE API POST ${res.status}: ${path} — ${text.slice(0, 200)}`);
    }
    return (await res.json() as any).data;
  }

  async delete(path: string, timeout = 15000): Promise<any> {
    const res = await fetch(`${this.host}${path}`, {
      method: 'DELETE',
      headers: { Authorization: this.authHeader },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PVE API DELETE ${res.status}: ${path} — ${text.slice(0, 200)}`);
    }
    return (await res.json() as any).data;
  }

  // ─── Guests ───────────────────────────────────
  async listGuests(): Promise<any[]> {
    const [lxc, qemu] = await Promise.all([
      this.get(`/api2/json/nodes/${this.node}/lxc`),
      this.get(`/api2/json/nodes/${this.node}/qemu`),
    ]);
    return [
      ...(lxc || []).map((ct: any) => ({ ...ct, type: 'lxc' })),
      ...(qemu || []).map((vm: any) => ({ ...vm, type: 'qemu' })),
    ];
  }

  async guestAction(vmid: number, type: 'lxc' | 'qemu', action: string): Promise<string> {
    const endpoint = type === 'qemu' ? 'qemu' : 'lxc';
    return this.post(`/api2/json/nodes/${this.node}/${endpoint}/${vmid}/status/${action}`);
  }

  async guestConfig(vmid: number, type: 'lxc' | 'qemu'): Promise<any> {
    const endpoint = type === 'qemu' ? 'qemu' : 'lxc';
    return this.get(`/api2/json/nodes/${this.node}/${endpoint}/${vmid}/config`);
  }

  async guestStatus(vmid: number, type: 'lxc' | 'qemu'): Promise<any> {
    const endpoint = type === 'qemu' ? 'qemu' : 'lxc';
    return this.get(`/api2/json/nodes/${this.node}/${endpoint}/${vmid}/status/current`);
  }

  // ─── Backups ──────────────────────────────────
  async listBackups(storage?: string): Promise<any[]> {
    const storages = await this.get(`/api2/json/nodes/${this.node}/storage`);
    const backups: any[] = [];
    for (const store of (storages || [])) {
      if (storage && store.storage !== storage) continue;
      if (!store.content?.includes('backup')) continue;
      try {
        const content = await this.get(`/api2/json/nodes/${this.node}/storage/${store.storage}/content?content=backup`);
        for (const item of (content || [])) {
          backups.push({
            volid: item.volid,
            vmid: item.vmid,
            size: item.size,
            format: item.format,
            ctime: item.ctime,
            storage: store.storage,
            notes: item.notes || '',
          });
        }
      } catch { /* storage may not support listing */ }
    }
    return backups;
  }

  async createBackup(vmid: number, opts: { storage?: string; mode?: string; compress?: string; notes?: string } = {}): Promise<string> {
    return this.post(`/api2/json/nodes/${this.node}/vzdump`, {
      vmid,
      storage: opts.storage || 'local',
      mode: opts.mode || 'snapshot',
      compress: opts.compress || 'zstd',
      notes: opts.notes,
    }, 600000); // 10 min timeout for backups
  }

  async restoreBackup(volid: string, vmid?: number): Promise<string> {
    // Determine type from volid (vzdump-lxc-* or vzdump-qemu-*)
    const isQemu = volid.includes('qemu');
    const targetVmid = vmid || await this.nextVmid();

    if (isQemu) {
      return this.post(`/api2/json/nodes/${this.node}/qemu`, {
        vmid: targetVmid,
        archive: volid,
      }, 600000);
    } else {
      return this.post(`/api2/json/nodes/${this.node}/lxc`, {
        vmid: targetVmid,
        ostemplate: volid,
        restore: 1,
      }, 600000);
    }
  }

  async deleteBackup(volid: string): Promise<void> {
    // volid format: storage:backup/filename
    const [storage] = volid.split(':');
    await this.delete(`/api2/json/nodes/${this.node}/storage/${storage}/content/${encodeURIComponent(volid)}`);
  }

  async nextVmid(): Promise<number> {
    return this.get('/api2/json/cluster/nextid');
  }

  // ─── Snapshots ────────────────────────────────
  async listSnapshots(vmid: number, type: 'lxc' | 'qemu'): Promise<any[]> {
    const endpoint = type === 'qemu' ? 'qemu' : 'lxc';
    const snaps = await this.get(`/api2/json/nodes/${this.node}/${endpoint}/${vmid}/snapshot`);
    return (snaps || []).filter((s: any) => s.name !== 'current');
  }

  async createSnapshot(vmid: number, type: 'lxc' | 'qemu', name: string, description?: string, vmstate?: boolean): Promise<string> {
    const endpoint = type === 'qemu' ? 'qemu' : 'lxc';
    const body: any = { snapname: name };
    if (description) body.description = description;
    if (vmstate && type === 'qemu') body.vmstate = 1;
    return this.post(`/api2/json/nodes/${this.node}/${endpoint}/${vmid}/snapshot`, body);
  }

  async deleteSnapshot(vmid: number, type: 'lxc' | 'qemu', name: string): Promise<string> {
    const endpoint = type === 'qemu' ? 'qemu' : 'lxc';
    return this.delete(`/api2/json/nodes/${this.node}/${endpoint}/${vmid}/snapshot/${name}`);
  }

  async rollbackSnapshot(vmid: number, type: 'lxc' | 'qemu', name: string): Promise<string> {
    const endpoint = type === 'qemu' ? 'qemu' : 'lxc';
    return this.post(`/api2/json/nodes/${this.node}/${endpoint}/${vmid}/snapshot/${name}/rollback`);
  }

  // ─── Storage ──────────────────────────────────
  async listStorages(): Promise<any[]> {
    return this.get(`/api2/json/nodes/${this.node}/storage`) || [];
  }

  async listDisks(): Promise<any[]> {
    return this.get(`/api2/json/nodes/${this.node}/disks/list`) || [];
  }

  async getSmartData(disk: string): Promise<any> {
    return this.get(`/api2/json/nodes/${this.node}/disks/smart?disk=${encodeURIComponent(disk)}`);
  }

  async listZfsPools(): Promise<any[]> {
    try {
      return await this.get(`/api2/json/nodes/${this.node}/disks/zfs`) || [];
    } catch { return []; }
  }

  async zfsScrub(pool: string): Promise<string> {
    return this.post(`/api2/json/nodes/${this.node}/disks/zfs/${pool}/scrub`);
  }

  // ─── Network ──────────────────────────────────
  async listNetworks(): Promise<any[]> {
    return this.get(`/api2/json/nodes/${this.node}/network`) || [];
  }

  // ─── System ───────────────────────────────────
  async getNodeStatus(): Promise<any> {
    return this.get(`/api2/json/nodes/${this.node}/status`);
  }

  async getNodeTime(): Promise<any> {
    return this.get(`/api2/json/nodes/${this.node}/time`);
  }

  async setNodeTimezone(timezone: string): Promise<void> {
    await this.post(`/api2/json/nodes/${this.node}/time`, { timezone });
  }

  async getNodeDns(): Promise<any> {
    return this.get(`/api2/json/nodes/${this.node}/dns`);
  }

  async setNodeDns(dns1: string, dns2?: string, search?: string): Promise<void> {
    const body: any = { dns1 };
    if (dns2) body.dns2 = dns2;
    if (search) body.search = search;
    await this.post(`/api2/json/nodes/${this.node}/dns`, body);
  }

  async getNodeSyslog(limit = 50, since?: string): Promise<any[]> {
    let path = `/api2/json/nodes/${this.node}/syslog?limit=${limit}`;
    if (since) path += `&since=${encodeURIComponent(since)}`;
    return this.get(path) || [];
  }

  async listUpdates(): Promise<any[]> {
    try {
      // Trigger apt update first
      await this.post(`/api2/json/nodes/${this.node}/apt/update`, {}, 120000);
    } catch { /* may fail if already running */ }
    return this.get(`/api2/json/nodes/${this.node}/apt/update`) || [];
  }

  async getAptChangelog(name: string): Promise<string> {
    return this.get(`/api2/json/nodes/${this.node}/apt/changelog?name=${encodeURIComponent(name)}`);
  }

  async rebootNode(): Promise<string> {
    return this.post(`/api2/json/nodes/${this.node}/status`, { command: 'reboot' });
  }

  async shutdownNode(): Promise<string> {
    return this.post(`/api2/json/nodes/${this.node}/status`, { command: 'shutdown' });
  }

  // ─── Firewall ─────────────────────────────────
  async listFirewallRules(): Promise<any[]> {
    try {
      return await this.get(`/api2/json/nodes/${this.node}/firewall/rules`) || [];
    } catch { return []; }
  }

  async addFirewallRule(rule: { type: string; action: string; proto?: string; dport?: string; source?: string; comment?: string; pos?: number }): Promise<void> {
    await this.post(`/api2/json/nodes/${this.node}/firewall/rules`, rule);
  }

  async deleteFirewallRule(pos: number): Promise<void> {
    await this.delete(`/api2/json/nodes/${this.node}/firewall/rules/${pos}`);
  }

  async getFirewallOptions(): Promise<any> {
    try {
      return await this.get(`/api2/json/nodes/${this.node}/firewall/options`);
    } catch { return {}; }
  }

  // ─── Helpers ──────────────────────────────────
  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }
}
