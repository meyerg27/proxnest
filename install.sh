#!/bin/bash
# ProxNest Installer — Run on your Proxmox host
# curl -fsSL https://proxnest.com/install.sh | bash

set -e

PROXNEST_DIR="/opt/proxnest"
PROXNEST_VERSION="0.1.0"
REPO="https://github.com/meyerg27/proxnest"
NODE_MIN="18"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

banner() {
  echo -e "${CYAN}${BOLD}"
  echo "  ╔═══════════════════════════════════════╗"
  echo "  ║         🏠 ProxNest Installer         ║"
  echo "  ║     Home Server OS for Proxmox VE     ║"
  echo "  ╚═══════════════════════════════════════╝"
  echo -e "${NC}"
  echo -e "  Version: ${GREEN}${PROXNEST_VERSION}${NC}"
  echo ""
}

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${BLUE}[i]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

check_root() {
  [ "$(id -u)" -eq 0 ] || fail "Must run as root. Try: sudo bash install.sh"
}

check_proxmox() {
  if ! command -v pveversion &>/dev/null; then
    fail "Proxmox VE not detected. ProxNest requires Proxmox VE 7.x or 8.x"
  fi
  PVE_VER=$(pveversion --verbose | head -1 | awk '{print $2}')
  log "Proxmox VE detected: ${PVE_VER}"
}

check_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge "$NODE_MIN" ]; then
      log "Node.js $(node -v) found"
      return
    fi
  fi
  warn "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y nodejs >/dev/null 2>&1
  log "Node.js $(node -v) installed"
}

install_proxnest() {
  warn "Installing ProxNest to ${PROXNEST_DIR}..."

  # Clone or update
  if [ -d "${PROXNEST_DIR}" ]; then
    warn "Existing installation found, updating..."
    cd "${PROXNEST_DIR}"
    git pull --quiet origin main 2>/dev/null || true
  else
    git clone --depth 1 "${REPO}.git" "${PROXNEST_DIR}" 2>/dev/null || {
      # Fallback: download tarball
      warn "Git clone failed, downloading release..."
      mkdir -p "${PROXNEST_DIR}"
      curl -fsSL "${REPO}/archive/refs/heads/main.tar.gz" | tar xz -C "${PROXNEST_DIR}" --strip-components=1
    }
  fi

  cd "${PROXNEST_DIR}"

  # Install API dependencies
  log "Installing API dependencies..."
  cd "${PROXNEST_DIR}/api"
  npm install --production --silent 2>/dev/null
  npx tsc --skipLibCheck 2>/dev/null || true

  # Build dashboard
  log "Building dashboard..."
  cd "${PROXNEST_DIR}/dashboard"
  npm install --silent 2>/dev/null
  npm run build 2>/dev/null
  
  log "ProxNest installed successfully"
}

setup_config() {
  CONFIG="${PROXNEST_DIR}/config.json"
  if [ ! -f "${CONFIG}" ]; then
    # Auto-detect Proxmox API
    PVE_HOST="https://127.0.0.1:8006"
    
    # Generate random JWT secret and admin password
    JWT_SECRET=$(openssl rand -hex 32)
    ADMIN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)

    cat > "${CONFIG}" << EOF
{
  "server": {
    "host": "0.0.0.0",
    "port": 4200
  },
  "proxmox": {
    "host": "${PVE_HOST}",
    "tokenId": "",
    "tokenSecret": "",
    "node": "$(hostname)"
  },
  "jwt": {
    "secret": "${JWT_SECRET}"
  },
  "admin": {
    "username": "admin",
    "password": "${ADMIN_PASS}"
  },
  "database": {
    "path": "${PROXNEST_DIR}/data/proxnest.db"
  }
}
EOF
    mkdir -p "${PROXNEST_DIR}/data"
    log "Config created at ${CONFIG}"
    warn "Default admin: admin / ${ADMIN_PASS}"
    warn "⚠️  Change the admin password after first login!"
  else
    log "Existing config preserved"
  fi
}

create_service() {
  cat > /etc/systemd/system/proxnest.service << EOF
[Unit]
Description=ProxNest — Home Server Dashboard
After=network.target pveproxy.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${PROXNEST_DIR}/api
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PROXNEST_CONFIG=${PROXNEST_DIR}/config.json
Environment=PROXNEST_DASHBOARD=${PROXNEST_DIR}/dashboard/dist

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable proxnest >/dev/null 2>&1
  systemctl restart proxnest
  log "ProxNest service created and started"
}

get_ip() {
  # Get the primary LAN IP
  ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || hostname -I | awk '{print $1}'
}

finish() {
  IP=$(get_ip)
  echo ""
  echo -e "${CYAN}${BOLD}═══════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  🎉 ProxNest installed successfully!${NC}"
  echo -e "${CYAN}${BOLD}═══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  Dashboard:  ${BOLD}http://${IP}:4200${NC}"
  echo -e "  Username:   ${BOLD}admin${NC}"
  echo -e "  Password:   ${BOLD}$(cat ${PROXNEST_DIR}/config.json | grep -o '"password": "[^"]*"' | head -1 | cut -d'"' -f4)${NC}"
  echo ""
  echo -e "  Manage:     ${BOLD}systemctl status proxnest${NC}"
  echo -e "  Logs:       ${BOLD}journalctl -u proxnest -f${NC}"
  echo -e "  Config:     ${BOLD}${PROXNEST_DIR}/config.json${NC}"
  echo ""
  echo -e "  ${BLUE}Need help? https://github.com/meyerg27/proxnest${NC}"
  echo ""
}

# --- Main ---
banner
check_root
check_proxmox
check_node
install_proxnest
setup_config
create_service
finish
