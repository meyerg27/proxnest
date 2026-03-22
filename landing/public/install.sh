#!/bin/bash
# ProxNest Quick Install — Run on any Proxmox VE server
# curl -sSL https://proxnest.com/install.sh | bash

set -e
echo ""
echo "  🏠 ProxNest Agent Installer"
echo "  ════════════════════════════"
echo ""

# Fix enterprise repos (no subscription = 401 errors)
if [ -f /etc/apt/sources.list.d/pve-enterprise.list ]; then
  sed -i "s/^deb/#deb/" /etc/apt/sources.list.d/pve-enterprise.list 2>/dev/null || true
  sed -i "s/^deb/#deb/" /etc/apt/sources.list.d/ceph.list 2>/dev/null || true
  echo "📋 Disabled enterprise repos (no subscription needed)"
fi

# Check if running on Proxmox
if [ ! -f /etc/pve/local/pve-ssl.pem ] && ! command -v pvesh &>/dev/null; then
  echo "⚠️  Warning: This doesn't look like a Proxmox VE server."
  echo "   ProxNest is designed for Proxmox. Continue anyway? (y/N)"
  read -r answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ] || exit 1
fi

# Check if already installed
if systemctl is-active proxnest-agent &>/dev/null; then
  echo "✅ ProxNest agent is already running!"
  CLAIM=$(journalctl -u proxnest-agent --no-pager -n 30 2>/dev/null | grep -oP 'Claim Code: \K\w+' | tail -1)
  [ -n "$CLAIM" ] && echo "   Claim Code: $CLAIM"
  echo "   To reinstall: systemctl stop proxnest-agent && rm -rf /opt/proxnest"
  exit 0
fi

# Install Node.js 22 if needed
if ! command -v node &>/dev/null; then
  echo "📦 Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y nodejs >/dev/null 2>&1
fi
echo "   Node.js $(node --version)"

# Install git if needed
command -v git &>/dev/null || apt-get install -y git >/dev/null 2>&1

# Clone ProxNest
echo "📥 Downloading ProxNest..."
PROXNEST_DIR="/opt/proxnest"
rm -rf "$PROXNEST_DIR"
git clone --depth 1 https://github.com/meyerg27/proxnest.git "$PROXNEST_DIR" 2>/dev/null || {
  mkdir -p "$PROXNEST_DIR"
  curl -fsSL https://github.com/meyerg27/proxnest/archive/refs/heads/main.tar.gz | tar xz -C "$PROXNEST_DIR" --strip-components=1
}

# Install agent deps
echo "📦 Installing dependencies..."
cd "$PROXNEST_DIR/agent" && npm install --production 2>&1 | tail -1

# Create PVE API token
echo "🔑 Creating API token..."
NODE_NAME=$(hostname)
pvesh delete /access/users/root@pam/token/proxnest 2>/dev/null || true
TOKEN_OUTPUT=$(pvesh create /access/users/root@pam/token/proxnest --privsep 0 2>&1)
TOKEN_SECRET=$(echo "$TOKEN_OUTPUT" | grep -oP '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)

if [ -z "$TOKEN_SECRET" ]; then
  echo "⚠️  Could not auto-create PVE API token."
  echo "   Create manually: pvesh create /access/users/root@pam/token/proxnest --privsep 0"
  echo "   Then set PROXMOX_TOKEN_SECRET in /etc/systemd/system/proxnest-agent.service"
  TOKEN_SECRET="REPLACE_ME"
fi

# Create systemd service
IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')

cat > /etc/systemd/system/proxnest-agent.service << EOF
[Unit]
Description=ProxNest Agent
After=network-online.target pveproxy.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${PROXNEST_DIR}/agent
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PROXNEST_PORTAL_URL=wss://cloud-api.proxnest.com/ws/agent
Environment=PROXMOX_HOST=https://127.0.0.1:8006
Environment=PROXMOX_TOKEN_ID=root@pam!proxnest
Environment=PROXMOX_TOKEN_SECRET=${TOKEN_SECRET}
Environment=PROXMOX_NODE=${NODE_NAME}
Environment=NODE_TLS_REJECT_UNAUTHORIZED=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable proxnest-agent
systemctl start proxnest-agent

# Wait for claim code
echo ""
echo "⏳ Starting agent..."
sleep 15
CLAIM=$(journalctl -u proxnest-agent --no-pager -n 30 2>/dev/null | grep -oP 'Claim Code: \K\w+' | tail -1)

echo ""
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║  🏠 ProxNest Agent Installed!                        ║"
echo "  ║                                                       ║"
echo "  ║  Cloud Dashboard: https://cloud.proxnest.com          ║"
if [ -n "$CLAIM" ] && [ "$CLAIM" != "" ]; then
echo "  ║  Claim Code:      ${CLAIM}                            ║"
fi
echo "  ║                                                       ║"
echo "  ║  Your server will auto-appear in the dashboard        ║"
echo "  ║  if you're on the same network. Otherwise use         ║"
echo "  ║  the claim code above.                                ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo ""
