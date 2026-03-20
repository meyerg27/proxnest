#!/usr/bin/env node
/**
 * ProxNest Agent — Systemd Service Installer
 * Creates and enables the proxnest-agent.service unit file.
 */

import { writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SERVICE_PATH = '/etc/systemd/system/proxnest-agent.service';

// Determine the agent binary path
const agentBin = resolve(__dirname, 'index.js');

const serviceUnit = `[Unit]
Description=ProxNest Agent — Server Management Daemon
Documentation=https://proxnest.com/docs/agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/node ${agentBin}
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal
SyslogIdentifier=proxnest-agent

# Security hardening
NoNewPrivileges=false
ProtectSystem=false
PrivateTmp=true
ReadWritePaths=/etc/proxnest

# Resource limits
MemoryMax=256M
CPUQuota=25%

[Install]
WantedBy=multi-user.target
`;

function install(): void {
  console.log('Installing ProxNest Agent service...');

  if (process.getuid?.() !== 0) {
    console.error('Error: Must run as root. Use: sudo proxnest-agent install-service');
    process.exit(1);
  }

  // Write service file
  writeFileSync(SERVICE_PATH, serviceUnit, { mode: 0o644 });
  console.log(`  ✓ Service file written to ${SERVICE_PATH}`);

  // Reload systemd
  execSync('systemctl daemon-reload');
  console.log('  ✓ systemd daemon reloaded');

  // Enable service
  execSync('systemctl enable proxnest-agent.service');
  console.log('  ✓ Service enabled (will start on boot)');

  // Start service
  execSync('systemctl start proxnest-agent.service');
  console.log('  ✓ Service started');

  console.log('');
  console.log('ProxNest Agent is now running!');
  console.log('');
  console.log('Commands:');
  console.log('  systemctl status proxnest-agent    # Check status');
  console.log('  journalctl -u proxnest-agent -f    # View logs');
  console.log('  proxnest-agent --status             # Agent info');
  console.log('');
}

function uninstall(): void {
  console.log('Uninstalling ProxNest Agent service...');

  if (process.getuid?.() !== 0) {
    console.error('Error: Must run as root.');
    process.exit(1);
  }

  try { execSync('systemctl stop proxnest-agent.service 2>/dev/null'); } catch { /* */ }
  try { execSync('systemctl disable proxnest-agent.service 2>/dev/null'); } catch { /* */ }

  if (existsSync(SERVICE_PATH)) {
    execSync(`rm ${SERVICE_PATH}`);
    execSync('systemctl daemon-reload');
    console.log('  ✓ Service removed');
  }

  console.log('ProxNest Agent service uninstalled.');
  console.log('Config files in /etc/proxnest/ were preserved.');
}

// CLI
const action = process.argv[2];
if (action === 'uninstall' || action === '--uninstall') {
  uninstall();
} else {
  install();
}
