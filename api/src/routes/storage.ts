import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { proxmox } from '../proxmox.js';
import { pveGet, pvePost } from '../proxmox.js';

export const storageRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // ─── List Storage ───────────────────────────────
  app.get<{ Params: { node: string } }>('/nodes/:node/storage', async (request) => {
    const { node } = request.params;
    const storages = await proxmox.getStorage(node);

    return {
      storages: storages.map((s) => ({
        name: s.storage,
        type: s.type,
        content: s.content.split(','),
        total: s.total,
        used: s.used,
        available: s.avail,
        percentUsed: s.total > 0 ? Math.round((s.used / s.total) * 100) : 0,
        totalGB: +(s.total / 1073741824).toFixed(1),
        usedGB: +(s.used / 1073741824).toFixed(1),
        availableGB: +(s.avail / 1073741824).toFixed(1),
        active: !!s.active,
        enabled: !!s.enabled,
        shared: !!s.shared,
        // Visual health indicator
        health: s.total > 0
          ? (s.used / s.total) > 0.9 ? 'critical'
          : (s.used / s.total) > 0.75 ? 'warning'
          : 'healthy'
          : 'unknown',
      })),
    };
  });

  // ─── Storage Content (ISOs, backups, etc.) ─────
  app.get<{ Params: { node: string; storage: string } }>(
    '/nodes/:node/storage/:storage/content',
    async (request) => {
      const { node, storage } = request.params;
      const content = await proxmox.getStorageContent(node, storage);
      return { content };
    },
  );

  // ─── Disks ──────────────────────────────────────
  app.get<{ Params: { node: string } }>('/nodes/:node/disks', async (request) => {
    const { node } = request.params;
    const disks = await proxmox.getNodeDisks(node) as Array<{
      devpath: string;
      model: string;
      serial: string;
      size: number;
      type: string;
      used?: string;
      vendor?: string;
      rpm?: number;
      wearout?: number;
      health?: string;
    }>;

    return {
      disks: Array.isArray(disks) ? disks.map((d) => ({
        path: d.devpath,
        model: d.model || 'Unknown',
        serial: d.serial || '',
        size: d.size,
        sizeGB: +(d.size / 1073741824).toFixed(1),
        sizeTB: +(d.size / 1099511627776).toFixed(2),
        type: d.type,
        used: d.used || 'unused',
        vendor: d.vendor || '',
        rpm: d.rpm || 0,
        isSSD: d.rpm === 0,
        wearout: d.wearout,
        health: d.health || 'unknown',
      })) : [],
    };
  });

  // ─── Storage Summary (all nodes) ───────────────
  app.get('/storage/summary', async () => {
    const nodes = await proxmox.getNodes();
    const summary = await Promise.all(
      nodes.map(async (n) => {
        const storages = await proxmox.getStorage(n.node);
        return {
          node: n.node,
          storages: storages.map((s) => ({
            name: s.storage,
            type: s.type,
            totalGB: +(s.total / 1073741824).toFixed(1),
            usedGB: +(s.used / 1073741824).toFixed(1),
            availableGB: +(s.avail / 1073741824).toFixed(1),
            percentUsed: s.total > 0 ? Math.round((s.used / s.total) * 100) : 0,
          })),
        };
      }),
    );
    return { summary };
  });

  // ─── ZFS Pools ──────────────────────────────────
  app.get<{ Params: { node: string } }>('/nodes/:node/disks/zfs', async (request) => {
    const { node } = request.params;
    try {
      const pools = await pveGet<Array<{
        name: string;
        size: number;
        alloc: number;
        free: number;
        frag: number;
        dedup: number;
        health: string;
        children?: unknown[];
      }>>(`/nodes/${node}/disks/zfs`);

      return {
        pools: Array.isArray(pools) ? pools.map((p) => ({
          name: p.name,
          size: p.size,
          sizeGB: +(p.size / 1073741824).toFixed(1),
          sizeTB: +(p.size / 1099511627776).toFixed(2),
          alloc: p.alloc,
          allocGB: +(p.alloc / 1073741824).toFixed(1),
          free: p.free,
          freeGB: +(p.free / 1073741824).toFixed(1),
          frag: p.frag,
          dedup: p.dedup,
          health: p.health,
          percentUsed: p.size > 0 ? Math.round((p.alloc / p.size) * 100) : 0,
          children: p.children,
        })) : [],
      };
    } catch {
      return { pools: [] };
    }
  });

  // ─── Create ZFS Pool ───────────────────────────
  const createZfsSchema = z.object({
    name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    raidlevel: z.enum(['single', 'mirror', 'raidz', 'raidz2', 'raidz3']),
    devices: z.array(z.string()).min(1),
    ashift: z.number().default(12),
    compression: z.enum(['on', 'off', 'lz4', 'gzip', 'zstd']).default('lz4'),
    add_storage: z.boolean().default(true),
  });

  app.post<{ Params: { node: string } }>('/nodes/:node/disks/zfs', async (request, reply) => {
    const user = request.user as { id: number; role: string };
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const { node } = request.params;
    const body = createZfsSchema.parse(request.body);

    try {
      const result = await pvePost(`/nodes/${node}/disks/zfs`, {
        name: body.name,
        raidlevel: body.raidlevel,
        devices: body.devices.join(','),
        ashift: body.ashift,
        compression: body.compression,
        add_storage: body.add_storage ? 1 : 0,
      });

      return reply.status(202).send({
        ok: true,
        message: `Creating ZFS pool "${body.name}" with ${body.raidlevel}...`,
        task: result,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: `Failed to create ZFS pool: ${msg}` });
    }
  });

  // ─── Smart/Health Data ──────────────────────────
  app.get<{ Params: { node: string; disk: string } }>(
    '/nodes/:node/disks/:disk/smart',
    async (request) => {
      const { node, disk } = request.params;
      try {
        const smart = await pveGet(`/nodes/${node}/disks/smart?disk=${encodeURIComponent(disk)}`);
        return { smart };
      } catch {
        return { smart: null };
      }
    },
  );

  // ─── Init GPT on disk ─────────────────────────
  app.post<{ Params: { node: string } }>('/nodes/:node/disks/initgpt', async (request, reply) => {
    const user = request.user as { id: number; role: string };
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const { node } = request.params;
    const { disk, uuid } = request.body as { disk: string; uuid?: string };

    try {
      const result = await pvePost(`/nodes/${node}/disks/initgpt`, {
        disk,
        ...(uuid ? { uuid } : {}),
      });
      return { ok: true, message: `Initialized GPT on ${disk}`, task: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: `Failed to init GPT: ${msg}` });
    }
  });
};
