import { FastifyPluginAsync } from 'fastify';
import { proxmox } from '../proxmox.js';

export const nodeRoutes: FastifyPluginAsync = async (app) => {
  // All node routes require auth
  app.addHook('onRequest', app.authenticate);

  // ─── List Nodes ─────────────────────────────────
  app.get('/nodes', async () => {
    const nodes = await proxmox.getNodes();
    return {
      nodes: nodes.map((n) => ({
        name: n.node,
        status: n.status,
        cpu: { used: n.cpu, total: n.maxcpu, percent: Math.round(n.cpu * 100) },
        memory: {
          used: n.mem,
          total: n.maxmem,
          percent: Math.round((n.mem / n.maxmem) * 100),
          usedGB: +(n.mem / 1073741824).toFixed(1),
          totalGB: +(n.maxmem / 1073741824).toFixed(1),
        },
        disk: {
          used: n.disk,
          total: n.maxdisk,
          percent: Math.round((n.disk / n.maxdisk) * 100),
          usedGB: +(n.disk / 1073741824).toFixed(1),
          totalGB: +(n.maxdisk / 1073741824).toFixed(1),
        },
        uptime: n.uptime,
        uptimeFormatted: formatUptime(n.uptime),
      })),
    };
  });

  // ─── Node Detail ────────────────────────────────
  app.get<{ Params: { node: string } }>('/nodes/:node', async (request) => {
    const { node } = request.params;
    const [status, networks, disks] = await Promise.all([
      proxmox.getNodeStatus(node),
      proxmox.getNodeNetworks(node),
      proxmox.getNodeDisks(node),
    ]);
    return { status, networks, disks };
  });

  // ─── All Resources (VMs + Containers) ──────────
  app.get('/resources', async () => {
    const resources = await proxmox.getClusterResources();
    return {
      resources: resources
        .filter((r) => r.type === 'qemu' || r.type === 'lxc')
        .map((r) => ({
          id: r.id,
          type: r.type,
          vmid: r.vmid,
          name: r.name || `${r.type}-${r.vmid}`,
          node: r.node,
          status: r.status,
          cpu: r.cpu ? Math.round(r.cpu * 100) : 0,
          memoryMB: r.mem ? Math.round(r.mem / 1048576) : 0,
          maxMemoryMB: r.maxmem ? Math.round(r.maxmem / 1048576) : 0,
          diskGB: r.disk ? +(r.disk / 1073741824).toFixed(1) : 0,
          uptime: r.uptime || 0,
          networkIn: r.netin || 0,
          networkOut: r.netout || 0,
        })),
    };
  });

  // ─── Container / VM Actions ─────────────────────
  app.post<{ Params: { node: string; type: string; vmid: string }; Body: { action: string } }>(
    '/nodes/:node/:type/:vmid/action',
    async (request, reply) => {
      const { node, type, vmid } = request.params;
      const { action } = request.body as { action: string };
      const id = parseInt(vmid, 10);

      const actions: Record<string, () => Promise<unknown>> = {
        start: () => (type === 'lxc' ? proxmox.startContainer(node, id) : proxmox.startVM(node, id)),
        stop: () => (type === 'lxc' ? proxmox.stopContainer(node, id) : proxmox.stopVM(node, id)),
      };

      const fn = actions[action];
      if (!fn) {
        return reply.status(400).send({ error: `Unknown action: ${action}. Valid: ${Object.keys(actions).join(', ')}` });
      }

      const result = await fn();
      return { ok: true, action, vmid: id, result };
    },
  );

  // ─── Container / VM Status ─────────────────────
  app.get<{ Params: { node: string; type: string; vmid: string } }>(
    '/nodes/:node/:type/:vmid',
    async (request) => {
      const { node, type, vmid } = request.params;
      const id = parseInt(vmid, 10);
      const status =
        type === 'lxc'
          ? await proxmox.getContainerStatus(node, id)
          : await proxmox.getVMStatus(node, id);
      return { status };
    },
  );

  // ─── Tasks ──────────────────────────────────────
  app.get<{ Params: { node: string }; Querystring: { limit?: string } }>(
    '/nodes/:node/tasks',
    async (request) => {
      const { node } = request.params;
      const limit = parseInt(request.query.limit || '20', 10);
      const tasks = await proxmox.getNodeTasks(node, limit);
      return { tasks };
    },
  );
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
