#!/bin/bash
# ProxNest First Boot — Runs once after Proxmox installation
# Installs the ProxNest agent that connects to cloud.proxnest.com

LOG="/var/log/proxnest-first-boot.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== ProxNest First Boot $(date) ==="

# Wait for network (up to 60s)
echo "[ProxNest] Waiting for network..."
for i in $(seq 1 30); do
  ping -c1 -W2 8.8.8.8 &>/dev/null && break
  sleep 2
done

if ! ping -c1 -W2 8.8.8.8 &>/dev/null; then
  echo "[ProxNest] ERROR: No network connectivity. Agent install deferred."
  exit 1
fi

# Install Node.js 22
if ! command -v node &>/dev/null; then
  echo "[ProxNest] Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y nodejs >/dev/null 2>&1
fi
echo "[ProxNest] Node.js $(node --version)"

# Install git if missing
command -v git &>/dev/null || apt-get install -y git >/dev/null 2>&1

# Clone ProxNest repo
PROXNEST_DIR="/opt/proxnest"
echo "[ProxNest] Cloning ProxNest..."
if [ -d "$PROXNEST_DIR" ]; then
  cd "$PROXNEST_DIR" && git pull --ff-only 2>/dev/null || true
else
  git clone --depth 1 https://github.com/meyerg27/proxnest.git "$PROXNEST_DIR" 2>&1 || {
    mkdir -p "$PROXNEST_DIR"
    curl -fsSL https://github.com/meyerg27/proxnest/archive/refs/heads/main.tar.gz | tar xz -C "$PROXNEST_DIR" --strip-components=1
  }
fi

# Install agent dependencies
echo "[ProxNest] Installing agent dependencies..."
cd "$PROXNEST_DIR/agent" && npm install --production 2>&1

# Create PVE API token for the agent
echo "[ProxNest] Creating PVE API token..."
NODE_NAME=$(hostname)
TOKEN_OUTPUT=$(pvesh create /access/users/root@pam/token/proxnest --privsep 0 2>/dev/null || echo "")
TOKEN_SECRET=""
if echo "$TOKEN_OUTPUT" | grep -q "value"; then
  TOKEN_SECRET=$(echo "$TOKEN_OUTPUT" | grep -oP '"value"\s*:\s*"\K[^"]+' 2>/dev/null || \
                 echo "$TOKEN_OUTPUT" | awk -F'"' '/value/{print $4}' 2>/dev/null)
fi

# If token creation failed (already exists), try to recreate
if [ -z "$TOKEN_SECRET" ]; then
  pvesh delete /access/users/root@pam/token/proxnest 2>/dev/null || true
  TOKEN_OUTPUT=$(pvesh create /access/users/root@pam/token/proxnest --privsep 0 2>&1)
  TOKEN_SECRET=$(echo "$TOKEN_OUTPUT" | grep -oP '"value"\s*:\s*"\K[^"]+' 2>/dev/null || \
                 echo "$TOKEN_OUTPUT" | awk -F'"' '/value/{print $4}' 2>/dev/null || \
                 echo "$TOKEN_OUTPUT" | sed -n 's/.*│ \([a-f0-9-]\{36\}\).*/\1/p' 2>/dev/null)
fi

echo "[ProxNest] Token: root@pam!proxnest = ${TOKEN_SECRET:0:8}..."

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)

# Create agent systemd service
IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')

cat > /etc/systemd/system/proxnest-agent.service << EOF
[Unit]
Description=ProxNest Agent — Cloud Connected Home Server
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

# Wait for agent to start and get claim code
sleep 10
CLAIM_CODE=$(journalctl -u proxnest-agent --no-pager -n 20 2>/dev/null | grep -oP 'Claim Code: \K\w+' || echo "check logs")

# Create welcome MOTD
cat > /etc/motd << EOF

  ╔═══════════════════════════════════════════════════════╗
  ║  🏠 ProxNest — Your Home Server is Ready!            ║
  ║                                                       ║
  ║  Proxmox:    https://${IP}:8006                       ║
  ║  Cloud:      https://cloud.proxnest.com               ║
  ║  Claim Code: ${CLAIM_CODE}                            ║
  ║                                                       ║
  ║  Login: root / proxnest                               ║
  ╚═══════════════════════════════════════════════════════╝

EOF

echo "[ProxNest] Installation complete!"
echo "[ProxNest] Proxmox: https://${IP}:8006"
echo "[ProxNest] Cloud: https://cloud.proxnest.com"
echo "[ProxNest] Claim Code: ${CLAIM_CODE}"

# Disable first-boot from running again
systemctl disable proxnest-first-boot.service 2>/dev/null

echo "=== ProxNest First Boot Complete $(date) ==="
