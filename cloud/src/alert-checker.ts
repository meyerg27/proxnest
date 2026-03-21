/**
 * ProxNest Cloud — Alert Checker
 * Periodically evaluates notification rules against server metrics.
 * Fires webhook/email alerts when thresholds are breached.
 */

import { db } from './db.js';
import { agentPool } from './agent-pool.js';

interface NotificationRule {
  id: number;
  server_id: number;
  user_id: number;
  name: string;
  condition: 'server_offline' | 'cpu_high' | 'ram_high' | 'disk_high';
  threshold: number;
  duration_seconds: number;
  channel: 'webhook' | 'email';
  target: string;
  cooldown_minutes: number;
  enabled: number;
  last_fired_at: string | null;
}

// Track how long a condition has been true (in-memory, resets on restart)
const conditionTimers = new Map<number, number>(); // ruleId → first-breach-timestamp

class AlertChecker {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    // Check every 30 seconds
    this.timer = setInterval(() => this.evaluate(), 30_000);
    // Also run once after 60s startup delay
    setTimeout(() => this.evaluate(), 60_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async evaluate(): Promise<void> {
    try {
      const rules = db.prepare(
        `SELECT nr.*, s.agent_id, s.name as server_name
         FROM notification_rules nr
         JOIN servers s ON nr.server_id = s.id
         WHERE nr.enabled = 1`,
      ).all() as (NotificationRule & { agent_id: string; server_name: string })[];

      const now = Date.now();

      for (const rule of rules) {
        try {
          const { breached, value } = this.checkCondition(rule);

          if (breached) {
            // Track duration
            if (!conditionTimers.has(rule.id)) {
              conditionTimers.set(rule.id, now);
            }

            const breachStart = conditionTimers.get(rule.id)!;
            const breachDuration = (now - breachStart) / 1000;

            // Only fire if duration threshold met
            if (breachDuration >= rule.duration_seconds) {
              // Check cooldown
              if (rule.last_fired_at) {
                const lastFired = new Date(rule.last_fired_at).getTime();
                const cooldownMs = rule.cooldown_minutes * 60_000;
                if (now - lastFired < cooldownMs) continue; // still in cooldown
              }

              await this.fireAlert(rule, value);
            }
          } else {
            // Condition cleared — reset timer
            conditionTimers.delete(rule.id);
          }
        } catch {
          // Skip individual rule errors
        }
      }
    } catch {
      // Silently handle DB errors during evaluation
    }
  }

  private checkCondition(rule: NotificationRule & { agent_id: string }): { breached: boolean; value: number } {
    const metrics = agentPool.getMetrics(rule.agent_id) as any;
    const online = agentPool.isOnline(rule.agent_id);

    switch (rule.condition) {
      case 'server_offline':
        return { breached: !online, value: online ? 1 : 0 };

      case 'cpu_high': {
        if (!metrics || !online) return { breached: false, value: 0 };
        const cpu = metrics.cpu?.usagePercent ?? metrics.cpu_usage ?? 0;
        return { breached: cpu >= rule.threshold, value: cpu };
      }

      case 'ram_high': {
        if (!metrics || !online) return { breached: false, value: 0 };
        const usedMB = metrics.memory?.usedMB ?? metrics.ram_used_mb ?? 0;
        const totalMB = metrics.memory?.totalMB ?? metrics.ram_total_mb ?? 1;
        const ramPct = totalMB > 0 ? (usedMB / totalMB) * 100 : 0;
        return { breached: ramPct >= rule.threshold, value: Math.round(ramPct) };
      }

      case 'disk_high': {
        if (!metrics || !online) return { breached: false, value: 0 };
        const usedGB = metrics.disk?.usedGB ?? metrics.disk_used_gb ?? 0;
        const totalGB = metrics.disk?.totalGB ?? metrics.disk_total_gb ?? 1;
        const diskPct = totalGB > 0 ? (usedGB / totalGB) * 100 : 0;
        return { breached: diskPct >= rule.threshold, value: Math.round(diskPct) };
      }

      default:
        return { breached: false, value: 0 };
    }
  }

  private async fireAlert(
    rule: NotificationRule & { server_name?: string },
    value: number,
  ): Promise<void> {
    const serverName = rule.server_name || `Server #${rule.server_id}`;
    const message = this.buildMessage(rule, serverName, value);

    let status = 'sent';
    let error: string | undefined;

    try {
      if (rule.channel === 'webhook') {
        const resp = await fetch(rule.target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: rule.condition,
            server: serverName,
            server_id: rule.server_id,
            rule_name: rule.name,
            value,
            threshold: rule.threshold,
            message,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!resp.ok) {
          status = 'failed';
          error = `Webhook returned HTTP ${resp.status}`;
        }
      } else if (rule.channel === 'email') {
        // Email not yet implemented — log as failed
        status = 'failed';
        error = 'Email delivery not configured';
      }
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : 'Delivery failed';
    }

    // Record in history
    db.prepare(
      `INSERT INTO notification_history (rule_id, message, value, status, error) VALUES (?, ?, ?, ?, ?)`,
    ).run(rule.id, message, value, status, error || null);

    // Update last_fired_at
    db.prepare(
      `UPDATE notification_rules SET last_fired_at = datetime('now') WHERE id = ?`,
    ).run(rule.id);

    // Reset the condition timer so it doesn't re-fire immediately (cooldown handles it)
    conditionTimers.delete(rule.id);
  }

  private buildMessage(rule: NotificationRule, serverName: string, value: number): string {
    switch (rule.condition) {
      case 'server_offline':
        return `🔴 ${serverName} is OFFLINE — agent connection lost`;
      case 'cpu_high':
        return `🔥 ${serverName} CPU at ${value}% (threshold: ${rule.threshold}%)`;
      case 'ram_high':
        return `💾 ${serverName} RAM at ${value}% (threshold: ${rule.threshold}%)`;
      case 'disk_high':
        return `💿 ${serverName} disk at ${value}% (threshold: ${rule.threshold}%)`;
      default:
        return `⚠️ ${serverName} alert: ${rule.name}`;
    }
  }
}

export const alertChecker = new AlertChecker();
