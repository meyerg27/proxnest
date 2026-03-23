/**
 * ProxNest Agent — VM Manager
 * Create, manage, and control user VMs and CTs.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

// VM range: 300-399, user CTs: 400-499
const VM_START = 300;
const VM_END = 399;

function run(cmd: string, timeout = 30000): string {
  return execSync(cmd, { encoding: 'utf-8', timeout }).trim();
}

function runSafe(cmd: string, timeout = 30000): string {
  try { return run(cmd, timeout); } catch { return ''; }
}

/**
 * List available ISO images.
 */
export function listIsos(): Array<{ name: string; size: string; storage: string }> {
  const result = runSafe('pvesm list local --content iso --output-format json 2>/dev/null');
  if (!result) {
    // Fallback: check main storage too
    const isos: Array<{ name: string; size: string; storage: string }> = [];
    for (const storage of ['local', 'main']) {
      const files = runSafe(`pvesm list ${storage} --content iso --output-format json 2>/dev/null`);
      if (files) {
        try {
          for (const f of JSON.parse(files)) {
            isos.push({
              name: f.volid || f.name || '',
              size: humanSize(f.size || 0),
              storage,
            });
          }
        } catch { /* skip */ }
      }
    }
    return isos;
  }

  try {
    return JSON.parse(result).map((f: any) => ({
      name: f.volid || '',
      size: humanSize(f.size || 0),
      storage: 'local',
    }));
  } catch { return []; }
}

/**
 * List available CT templates.
 */
export function listTemplates(): Array<{ name: string; size: string }> {
  const result = runSafe('pveam list local --output-format json 2>/dev/null');
  if (!result) return [];
  try {
    return JSON.parse(result).map((t: any) => ({
      name: t.volid || '',
      size: humanSize(t.size || 0),
    }));
  } catch { return []; }
}

/**
 * Find next available VMID in a range.
 */
function findNextVmid(start: number, end: number): number {
  const used = new Set<number>();
  const resources = runSafe('pvesh get /cluster/resources --type vm --output-format json 2>/dev/null');
  if (resources) {
    try {
      for (const r of JSON.parse(resources)) {
        used.add(r.vmid);
      }
    } catch { /* ignore */ }
  }
  for (let vmid = start; vmid <= end; vmid++) {
    if (!used.has(vmid)) return vmid;
  }
  throw new Error(`No available VMIDs in range ${start}-${end}`);
}

/**
 * Create a virtual machine.
 */
export function createVm(params: {
  name: string;
  iso?: string;
  cores?: number;
  memory?: number; // MB
  disk?: number;   // GB
  storage?: string;
  ostype?: string;
  net?: boolean;
}): { success: boolean; vmid?: number; error?: string } {
  try {
    const vmid = findNextVmid(VM_START, VM_END);
    const name = params.name.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 63);
    const cores = params.cores || 2;
    const memory = params.memory || 2048;
    const diskSize = params.disk || 32;
    const storage = params.storage || runSafe("pvesm status --content images 2>/dev/null | awk 'NR>1{print $1}' | head -1") || 'local-lvm';
    const ostype = params.ostype || 'l26'; // Linux 2.6+

    let cmd = `qm create ${vmid} --name ${name} --cores ${cores} --memory ${memory}`;
    cmd += ` --ostype ${ostype} --machine q35 --bios ovmf`;
    cmd += ` --efidisk0 ${storage}:0,efitype=4m`;
    cmd += ` --scsi0 ${storage}:${diskSize}`;
    cmd += ` --scsihw virtio-scsi-single`;
    cmd += ` --boot order=scsi0`;

    if (params.iso) {
      cmd += ` --ide2 ${params.iso},media=cdrom`;
      cmd += ` --boot order=ide2\\;scsi0`; // Boot from CD first for install
    }

    if (params.net !== false) {
      cmd += ` --net0 virtio,bridge=vmbr0`;
    }

    cmd += ` --onboot 0`; // Don't auto-start user VMs

    run(cmd, 60000);
    return { success: true, vmid };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Create an LXC container (user-managed, not app).
 */
export function createCt(params: {
  name: string;
  template?: string;
  cores?: number;
  memory?: number;
  disk?: number;
  storage?: string;
  password?: string;
  ip?: string;
}): { success: boolean; vmid?: number; error?: string } {
  try {
    const vmid = findNextVmid(400, 499);
    const name = params.name.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 63);
    const cores = params.cores || 1;
    const memory = params.memory || 1024;
    const diskSize = params.disk || 8;
    const storage = params.storage || runSafe("pvesm status --content rootdir 2>/dev/null | awk 'NR>1{print $1}' | head -1") || 'local-lvm';
    const template = params.template || runSafe("pveam list local 2>/dev/null | grep debian-12 | awk '{print $1}'") || 'local:vztmpl/debian-12-standard_12.12-1_amd64.tar.zst';
    const password = params.password || 'proxnest';

    // Determine IP
    const gateway = runSafe("ip -4 route show default | awk '{print $3}' | head -1") || '192.168.1.1';
    const ipConfig = params.ip ? `ip=${params.ip}/24,gw=${gateway}` : 'ip=dhcp';

    let cmd = `pct create ${vmid} ${template}`;
    cmd += ` --hostname ${name}`;
    cmd += ` --cores ${cores} --memory ${memory} --swap 256`;
    cmd += ` --rootfs ${storage}:${diskSize}`;
    cmd += ` --net0 name=eth0,bridge=vmbr0,${ipConfig}`;
    cmd += ` --features nesting=1`;
    cmd += ` --nameserver 8.8.8.8`;
    cmd += ` --password ${password}`;
    cmd += ` --onboot 0`;
    cmd += ` --unprivileged 1`;

    run(cmd, 60000);
    return { success: true, vmid };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * List all VMs and user CTs (not app CTs).
 */
export function listGuests(): Array<{
  vmid: number;
  name: string;
  type: 'qemu' | 'lxc';
  status: string;
  cpu: number;
  memory: { used: number; total: number };
  disk: { used: number; total: number };
  uptime: number;
  isApp: boolean;
}> {
  const result = runSafe('pvesh get /cluster/resources --type vm --output-format json 2>/dev/null');
  if (!result) return [];

  try {
    return JSON.parse(result).map((r: any) => ({
      vmid: r.vmid,
      name: r.name || '',
      type: r.type === 'qemu' ? 'qemu' : 'lxc',
      status: r.status || 'unknown',
      cpu: Math.round((r.cpu || 0) * 100),
      memory: { used: r.mem || 0, total: r.maxmem || 0 },
      disk: { used: r.disk || 0, total: r.maxdisk || 0 },
      uptime: r.uptime || 0,
      isApp: r.vmid >= 200 && r.vmid <= 299, // App CT range
    }));
  } catch { return []; }
}

/**
 * Start/stop/reboot a guest.
 */
export function controlGuest(vmid: number, action: 'start' | 'stop' | 'reboot' | 'shutdown' | 'destroy'): { success: boolean; error?: string } {
  // Determine type
  const isQemu = !!runSafe(`qm status ${vmid} 2>/dev/null`);
  const prefix = isQemu ? 'qm' : 'pct';

  try {
    if (action === 'destroy') {
      runSafe(`${prefix} stop ${vmid} 2>/dev/null`);
      run(`${prefix} destroy ${vmid} --purge 2>&1`, 30000);
    } else {
      run(`${prefix} ${action} ${vmid} 2>&1`, 30000);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get detailed status of a guest.
 */
export function guestStatus(vmid: number): any {
  // Try QEMU first, then LXC
  let result = runSafe(`pvesh get /nodes/$(hostname)/qemu/${vmid}/status/current --output-format json 2>/dev/null`);
  let type = 'qemu';
  if (!result) {
    result = runSafe(`pvesh get /nodes/$(hostname)/lxc/${vmid}/status/current --output-format json 2>/dev/null`);
    type = 'lxc';
  }
  if (!result) return null;

  try {
    const s = JSON.parse(result);
    return {
      vmid,
      type,
      name: s.name || '',
      status: s.status || 'unknown',
      cpu: Math.round((s.cpu || 0) * 100),
      cpus: s.cpus || 0,
      memUsed: s.mem || 0,
      memTotal: s.maxmem || 0,
      diskUsed: s.disk || 0,
      diskTotal: s.maxdisk || 0,
      uptime: s.uptime || 0,
      netin: s.netin || 0,
      netout: s.netout || 0,
      pid: s.pid || 0,
    };
  } catch { return null; }
}

function humanSize(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}
