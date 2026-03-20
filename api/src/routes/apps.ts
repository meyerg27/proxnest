import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';
import { proxmox } from '../proxmox.js';
import { APP_TEMPLATES, COMPOSE_STACKS, getTemplateById, getTemplatesByCategory, searchTemplates, getFeaturedTemplates, getCategories, getStackById } from '../app-templates.js';

interface InstalledAppRow {
  id: number;
  template_id: string;
  name: string;
  vmid: number | null;
  type: string;
  status: string;
  config: string;
  node: string;
  ip_address: string | null;
  port: number | null;
  web_url: string | null;
  installed_by: number | null;
  created_at: string;
  updated_at: string;
}

const installSchema = z.object({
  template_id: z.string(),
  name: z.string().min(1).max(64).optional(),
  node: z.string().default('pve'),
  config: z.record(z.string()).optional(),
});

export const appRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // ─── Browse App Store ───────────────────────────
  app.get('/apps/store', async (request) => {
    const { category, search } = request.query as { category?: string; search?: string };

    let templates = APP_TEMPLATES;
    if (search) {
      templates = searchTemplates(search);
    } else if (category) {
      templates = getTemplatesByCategory(category);
    }

    const categories = getCategories();

    return {
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        category: t.category,
        type: t.type,
        tags: t.tags,
        website: t.website,
        webPort: t.webPort,
      })),
      categories,
      total: templates.length,
    };
  });

  // ─── App Template Detail ────────────────────────
  app.get<{ Params: { id: string } }>('/apps/store/:id', async (request, reply) => {
    const template = getTemplateById(request.params.id);
    if (!template) {
      return reply.status(404).send({ error: 'Template not found' });
    }
    return { template };
  });

  // ─── Install App ───────────────────────────────
  app.post('/apps/install', async (request, reply) => {
    const body = installSchema.parse(request.body);
    const user = request.user as { id: number; role: string };

    // Only admin can install
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Only admins can install apps' });
    }

    const template = getTemplateById(body.template_id);
    if (!template) {
      return reply.status(404).send({ error: 'Unknown template' });
    }

    const appName = body.name || template.name.toLowerCase().replace(/\s+/g, '-');

    if (template.type === 'lxc' && template.lxc) {
      // Create LXC container via Proxmox API
      const vmid = await proxmox.getNextId();

      const result = db.prepare(
        `INSERT INTO installed_apps (template_id, name, vmid, type, status, config, node, port, installed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        template.id,
        appName,
        vmid,
        'lxc',
        'installing',
        JSON.stringify({ ...body.config }),
        body.node,
        template.webPort,
        user.id,
      );

      // Kick off async creation
      proxmox.createContainer(body.node, {
        vmid,
        hostname: appName,
        ostemplate: template.lxc.ostemplate,
        cores: template.lxc.cores,
        memory: template.lxc.memory,
        swap: template.lxc.swap,
        rootfs: `local-lvm:${template.lxc.rootfs}`,
        net0: 'name=eth0,bridge=vmbr0,ip=dhcp',
        unprivileged: template.lxc.unprivileged ? 1 : 0,
        start: 1,
      }).then(() => {
        db.prepare('UPDATE installed_apps SET status = ? WHERE id = ?').run('running', result.lastInsertRowid);
      }).catch((err) => {
        db.prepare('UPDATE installed_apps SET status = ?, config = ? WHERE id = ?').run(
          'error',
          JSON.stringify({ error: String(err) }),
          result.lastInsertRowid,
        );
      });

      return reply.status(202).send({
        message: `Installing ${template.name}...`,
        app: { id: result.lastInsertRowid, vmid, name: appName, status: 'installing' },
      });
    }

    if (template.type === 'docker' && template.docker) {
      // Docker apps: store the record, actual deployment via agent
      const result = db.prepare(
        `INSERT INTO installed_apps (template_id, name, type, status, config, node, port, installed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        template.id,
        appName,
        'docker',
        'installing',
        JSON.stringify({
          image: template.docker.image,
          ports: template.docker.ports,
          volumes: template.docker.volumes,
          environment: { ...template.docker.environment, ...body.config },
          compose: template.docker.compose,
        }),
        body.node,
        template.webPort,
        user.id,
      );

      return reply.status(202).send({
        message: `Installing ${template.name} (Docker)...`,
        app: { id: result.lastInsertRowid, name: appName, status: 'installing' },
      });
    }

    return reply.status(400).send({ error: 'Template has no installation config' });
  });

  // ─── List Installed Apps ────────────────────────
  app.get('/apps/installed', async () => {
    const apps = db.prepare('SELECT * FROM installed_apps ORDER BY created_at DESC').all() as InstalledAppRow[];

    return {
      apps: apps.map((a) => {
        const template = getTemplateById(a.template_id);
        return {
          id: a.id,
          templateId: a.template_id,
          name: a.name,
          vmid: a.vmid,
          type: a.type,
          status: a.status,
          node: a.node,
          port: a.port,
          ipAddress: a.ip_address,
          webUrl: a.web_url || (a.ip_address && a.port ? `http://${a.ip_address}:${a.port}` : null),
          icon: template?.icon || '📦',
          category: template?.category || 'unknown',
          createdAt: a.created_at,
        };
      }),
    };
  });

  // ─── Uninstall App ──────────────────────────────
  app.delete<{ Params: { id: string } }>('/apps/installed/:id', async (request, reply) => {
    const user = request.user as { id: number; role: string };
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Only admins can uninstall apps' });
    }

    const appId = parseInt(request.params.id, 10);
    const appRow = db.prepare('SELECT * FROM installed_apps WHERE id = ?').get(appId) as InstalledAppRow | undefined;

    if (!appRow) {
      return reply.status(404).send({ error: 'App not found' });
    }

    db.prepare('UPDATE installed_apps SET status = ? WHERE id = ?').run('removing', appId);

    // If it's an LXC with a vmid, destroy it
    if (appRow.type === 'lxc' && appRow.vmid) {
      proxmox.stopContainer(appRow.node, appRow.vmid).catch(() => {});
      setTimeout(async () => {
        try {
          await proxmox.deleteContainer(appRow.node, appRow.vmid!);
          db.prepare('DELETE FROM installed_apps WHERE id = ?').run(appId);
        } catch {
          db.prepare('UPDATE installed_apps SET status = ? WHERE id = ?').run('error', appId);
        }
      }, 5000);
    } else {
      // Docker: mark for agent to handle
      db.prepare('DELETE FROM installed_apps WHERE id = ?').run(appId);
    }

    return { ok: true, message: `Removing ${appRow.name}...` };
  });

  // ─── Featured Apps ──────────────────────────────
  app.get('/apps/featured', async () => {
    const featured = getFeaturedTemplates();
    return {
      templates: featured.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        category: t.category,
        type: t.type,
        tags: t.tags,
        website: t.website,
        webPort: t.webPort,
        minResources: t.minResources,
      })),
    };
  });

  // ─── Compose Stacks ─────────────────────────────
  app.get('/apps/stacks', async () => {
    return {
      stacks: COMPOSE_STACKS.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: s.icon,
        category: s.category,
        tags: s.tags,
        apps: s.apps,
        webPorts: s.webPorts,
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/apps/stacks/:id', async (request, reply) => {
    const stack = getStackById(request.params.id);
    if (!stack) {
      return reply.status(404).send({ error: 'Stack not found' });
    }
    return {
      stack: {
        ...stack,
        apps: stack.apps.map((appId) => {
          const t = getTemplateById(appId);
          return t
            ? { id: t.id, name: t.name, icon: t.icon, description: t.description, webPort: t.webPort }
            : { id: appId, name: appId, icon: '📦', description: '', webPort: 0 };
        }),
      },
    };
  });

  app.post<{ Params: { id: string } }>('/apps/stacks/:id/install', async (request, reply) => {
    const user = request.user as { id: number; role: string };
    if (user.role !== 'admin') {
      return reply.status(403).send({ error: 'Only admins can install stacks' });
    }

    const stack = getStackById(request.params.id);
    if (!stack) {
      return reply.status(404).send({ error: 'Stack not found' });
    }

    // Record each app from the stack
    const result = db.prepare(
      `INSERT INTO installed_apps (template_id, name, type, status, config, node, port, installed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      stack.id,
      stack.name.toLowerCase().replace(/\s+/g, '-'),
      'docker',
      'installing',
      JSON.stringify({ compose: stack.compose, webPorts: stack.webPorts }),
      'pve',
      0,
      user.id,
    );

    return reply.status(202).send({
      message: `Installing ${stack.name} stack...`,
      stack: { id: result.lastInsertRowid, name: stack.name, status: 'installing', apps: stack.apps },
    });
  });
};
