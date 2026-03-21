#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  ProxNest Installer
#  curl -sSL https://proxnest.com/install.sh | bash
#
#  Installs the ProxNest agent on a Proxmox VE host.
#  • Node.js 22 LTS (via NodeSource, skipped if present)
#  • ProxNest agent from GitHub
#  • systemd service (proxnest-agent)
#  • Optional Docker CE (for app-store installs)
#  • JWT secret + first-boot config
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Branding ──────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROXNEST_REPO="https://github.com/proxnest/proxnest.git"
INSTALL_DIR="/opt/proxnest"
CONFIG_DIR="/etc/proxnest"
AGENT_USER="proxnest"
NODE_MAJOR=22
MIN_PVE_MAJOR=7

banner() {
  echo -e "${CYAN}"
  echo "  ╔═══════════════════════════════════════════════╗"
  echo "  ║             ProxNest Installer                ║"
  echo "  ║        Home Server OS for Proxmox VE          ║"
  echo "  ╚═══════════════════════════════════════════════╝"
  echo -e "${NC}"
}

log()   { echo -e "  ${GREEN}✓${NC} $*"; }
info()  { echo -e "  ${CYAN}ℹ${NC} $*"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $*"; }
fail()  { echo -e "  ${RED}✗ $*${NC}" >&2; exit 1; }
step()  { echo -e "\n${BOLD}▸ $*${NC}"; }

# ── Pre-flight checks ────────────────────────────────────────
preflight() {
  step "Running pre-flight checks"

  # Must be root
  [[ $EUID -eq 0 ]] || fail "This installer must be run as root.  Try: sudo bash"

  # Must be Debian/Ubuntu based
  if ! command -v apt-get &>/dev/null; then
    fail "Only Debian/Ubuntu-based systems are supported (apt-get not found)."
  fi

  # Check for Proxmox VE
  if command -v pveversion &>/dev/null; then
    local pve_ver
    pve_ver=$(pveversion --verbose 2>/dev/null | head -1 | grep -oP '\d+' | head -1 || echo "0")
    if [[ "$pve_ver" -lt "$MIN_PVE_MAJOR" ]]; then
      warn "Proxmox VE $pve_ver detected — ProxNest works best with PVE $MIN_PVE_MAJOR+"
    else
      log "Proxmox VE $pve_ver detected"
    fi
  else
    warn "Proxmox VE not detected — ProxNest agent will run in standalone mode"
  fi

  # Architecture
  local arch
  arch=$(uname -m)
  if [[ "$arch" != "x86_64" && "$arch" != "aarch64" ]]; then
    fail "Unsupported architecture: $arch (need x86_64 or aarch64)"
  fi
  log "Architecture: $arch"

  # Disk space (need at least 500MB free in /opt)
  local free_mb
  free_mb=$(df -BM /opt 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'M')
  if [[ "${free_mb:-0}" -lt 500 ]]; then
    warn "Low disk space on /opt (${free_mb}MB free, 500MB recommended)"
  fi

  log "Pre-flight checks passed"
}

# ── Install Node.js 22 ───────────────────────────────────────
install_node() {
  step "Checking Node.js"

  if command -v node &>/dev/null; then
    local node_ver
    node_ver=$(node -v | grep -oP '\d+' | head -1)
    if [[ "$node_ver" -ge "$NODE_MAJOR" ]]; then
      log "Node.js $(node -v) already installed — skipping"
      return 0
    else
      info "Node.js v$node_ver found — upgrading to v$NODE_MAJOR"
    fi
  fi

  info "Installing Node.js $NODE_MAJOR LTS via NodeSource..."

  # Install prerequisites
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg >/dev/null 2>&1

  # NodeSource setup
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null

  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list

  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null 2>&1

  # Verify
  if ! command -v node &>/dev/null; then
    fail "Node.js installation failed"
  fi
  log "Node.js $(node -v) installed"
}

# ── Install Docker (optional) ────────────────────────────────
install_docker() {
  step "Checking Docker"

  if command -v docker &>/dev/null; then
    log "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1) already installed"
    return 0
  fi

  echo ""
  info "Docker is required for the ProxNest app store (one-click installs)."
  info "You can install it now or skip and install later."
  echo ""

  # If running non-interactively (piped), default to yes
  if [[ -t 0 ]]; then
    read -rp "  Install Docker CE? [Y/n] " docker_choice
    docker_choice=${docker_choice:-Y}
  else
    docker_choice="Y"
    info "Non-interactive mode — installing Docker automatically"
  fi

  if [[ "${docker_choice,,}" != "y" ]]; then
    warn "Skipping Docker — app store installs will not work until Docker is installed"
    return 0
  fi

  info "Installing Docker CE..."

  # Docker official install
  apt-get install -y -qq ca-certificates curl >/dev/null 2>&1
  install -m 0755 -d /etc/apt/keyrings

  curl -fsSL https://download.docker.com/linux/debian/gpg \
    -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  # Detect distro
  local distro codename
  if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    distro="${ID}"
    codename="${VERSION_CODENAME:-}"
  fi

  # Proxmox is Debian-based but may report as proxmox
  if [[ -z "$codename" ]] || [[ "$distro" == "proxmox"* ]]; then
    distro="debian"
    codename=$(grep -oP 'VERSION_CODENAME=\K\w+' /etc/os-release 2>/dev/null || echo "bookworm")
  fi

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/${distro} ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null 2>&1

  systemctl enable --now docker >/dev/null 2>&1

  if ! command -v docker &>/dev/null; then
    warn "Docker installation failed — app store installs will not work"
    return 0
  fi
  log "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1) installed"
}

# ── Install git if missing ───────────────────────────────────
install_git() {
  if command -v git &>/dev/null; then
    return 0
  fi
  info "Installing git..."
  apt-get install -y -qq git >/dev/null 2>&1
  log "git installed"
}

# ── Clone / Update ProxNest ──────────────────────────────────
install_proxnest() {
  step "Installing ProxNest agent"

  install_git

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Existing installation found — updating..."
    cd "$INSTALL_DIR"
    git fetch --quiet origin
    git reset --hard origin/main --quiet
    log "Updated to latest version"
  else
    info "Cloning ProxNest from GitHub..."
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 --quiet "$PROXNEST_REPO" "$INSTALL_DIR"
    log "Cloned to $INSTALL_DIR"
  fi

  # Install agent dependencies and build
  cd "$INSTALL_DIR/agent"
  info "Installing dependencies..."
  npm ci --production=false --silent 2>/dev/null
  info "Building agent..."
  npx tsc 2>/dev/null
  log "Agent built successfully"
}

# ── Generate config ──────────────────────────────────────────
generate_config() {
  step "Generating configuration"

  mkdir -p "$CONFIG_DIR"

  # Generate JWT secret if not exists
  local jwt_secret
  if [[ -f "$CONFIG_DIR/agent.json" ]]; then
    # Preserve existing config
    info "Existing config found at $CONFIG_DIR/agent.json — preserving"
    jwt_secret=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_DIR/agent.json'));console.log(c.jwtSecret||'')}catch{}" 2>/dev/null || echo "")
  fi

  if [[ -z "${jwt_secret:-}" ]]; then
    jwt_secret=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
  fi

  # Auto-detect Proxmox API
  local pve_host="https://127.0.0.1:8006"

  # Generate agent identity if not exists
  local agent_id
  if [[ -f "$CONFIG_DIR/identity.json" ]]; then
    info "Existing identity found — preserving"
    agent_id=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_DIR/identity.json'));console.log(c.agentId||'')}catch{}" 2>/dev/null || echo "")
  fi

  if [[ -z "${agent_id:-}" ]]; then
    agent_id=$(node -e "console.log(require('crypto').randomUUID())")
  fi

  # Write config (only if doesn't exist)
  if [[ ! -f "$CONFIG_DIR/agent.json" ]]; then
    cat > "$CONFIG_DIR/agent.json" <<CONF
{
  "portalUrl": "wss://portal.proxnest.com/agent",
  "apiUrl": "https://api.proxnest.com",
  "proxmoxHost": "${pve_host}",
  "heartbeatInterval": 30000,
  "metricsInterval": 60000,
  "logLevel": "info",
  "localApiPort": 9120,
  "jwtSecret": "${jwt_secret}"
}
CONF
    log "Config written to $CONFIG_DIR/agent.json"
  fi

  # Write identity (only if doesn't exist)
  if [[ ! -f "$CONFIG_DIR/identity.json" ]]; then
    cat > "$CONFIG_DIR/identity.json" <<IDENT
{
  "agentId": "${agent_id}",
  "registeredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
IDENT
    log "Identity written to $CONFIG_DIR/identity.json"
  fi

  # Secure permissions
  chmod 600 "$CONFIG_DIR/agent.json" "$CONFIG_DIR/identity.json"
  chmod 700 "$CONFIG_DIR"
  log "Config permissions secured (600)"
}

# ── Create systemd service ───────────────────────────────────
create_service() {
  step "Creating systemd service"

  cat > /etc/systemd/system/proxnest-agent.service <<SERVICE
[Unit]
Description=ProxNest Agent — Home Server Management
Documentation=https://proxnest.com/docs
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
ExecStart=/usr/bin/node ${INSTALL_DIR}/agent/dist/index.js
WorkingDirectory=${INSTALL_DIR}/agent
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=NODE_TLS_REJECT_UNAUTHORIZED=0

# Security hardening
NoNewPrivileges=false
ProtectSystem=false
ProtectHome=false
ReadWritePaths=${CONFIG_DIR} ${INSTALL_DIR}

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=proxnest-agent

# Resource limits
LimitNOFILE=65536
TimeoutStartSec=30
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable proxnest-agent.service >/dev/null 2>&1
  log "proxnest-agent.service created and enabled"
}

# ── Create Docker management service (optional) ─────────────
create_docker_service() {
  # Only create if Docker is installed
  if ! command -v docker &>/dev/null; then
    return 0
  fi

  step "Configuring Docker for ProxNest"

  # Create a dedicated Docker network for ProxNest apps
  if ! docker network inspect proxnest &>/dev/null 2>&1; then
    docker network create proxnest >/dev/null 2>&1
    log "Created 'proxnest' Docker network"
  else
    log "Docker network 'proxnest' already exists"
  fi

  # Create data directory for app volumes
  mkdir -p /opt/proxnest-data
  log "App data directory: /opt/proxnest-data"
}

# ── First-boot setup ─────────────────────────────────────────
first_boot_setup() {
  step "First-boot setup"

  # Create log directory
  mkdir -p /var/log/proxnest
  log "Log directory: /var/log/proxnest"

  # Create a claim token for cloud portal registration
  local claim_token
  claim_token=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")

  # Update identity with claim token
  if [[ -f "$CONFIG_DIR/identity.json" ]]; then
    node -e "
      const fs = require('fs');
      const id = JSON.parse(fs.readFileSync('$CONFIG_DIR/identity.json'));
      id.claimToken = '${claim_token}';
      fs.writeFileSync('$CONFIG_DIR/identity.json', JSON.stringify(id, null, 2));
    "
  fi

  # Write first-boot marker
  touch "$CONFIG_DIR/.installed"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$CONFIG_DIR/.installed"

  log "Claim token generated for cloud portal pairing"
  info "Save this token to register your server: ${BOLD}${claim_token}${NC}"
}

# ── Start agent ──────────────────────────────────────────────
start_agent() {
  step "Starting ProxNest agent"

  systemctl start proxnest-agent.service

  # Wait a moment and check status
  sleep 2
  if systemctl is-active --quiet proxnest-agent.service; then
    log "ProxNest agent is running"
  else
    warn "Agent may not have started correctly — check: journalctl -u proxnest-agent -f"
  fi
}

# ── Summary ──────────────────────────────────────────────────
print_summary() {
  local agent_id claim_token local_ip
  agent_id=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$CONFIG_DIR/identity.json')).agentId)}catch{console.log('unknown')}" 2>/dev/null)
  claim_token=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$CONFIG_DIR/identity.json')).claimToken||'none')}catch{console.log('none')}" 2>/dev/null)
  local_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  ✓ ProxNest installed successfully!${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  ${BOLD}Agent ID:${NC}     $agent_id"
  echo -e "  ${BOLD}Local API:${NC}    http://${local_ip}:9120"
  echo -e "  ${BOLD}Claim Token:${NC}  $claim_token"
  echo -e "  ${BOLD}Config:${NC}       $CONFIG_DIR/agent.json"
  echo -e "  ${BOLD}Install Dir:${NC}  $INSTALL_DIR"
  echo ""
  echo -e "  ${BOLD}Next steps:${NC}"
  echo -e "    1. Go to ${CYAN}https://cloud.proxnest.com${NC}"
  echo -e "    2. Create an account or log in"
  echo -e "    3. Click ${BOLD}\"Add Server\"${NC} and enter your claim token"
  echo -e "    4. Your server will appear in the dashboard!"
  echo ""
  echo -e "  ${BOLD}Useful commands:${NC}"
  echo -e "    systemctl status proxnest-agent    # Check agent status"
  echo -e "    journalctl -u proxnest-agent -f    # View agent logs"
  echo -e "    systemctl restart proxnest-agent   # Restart agent"
  echo ""
  echo -e "  ${BOLD}Docs:${NC} https://proxnest.com/docs"
  echo -e "  ${BOLD}Help:${NC} https://proxnest.com/discord"
  echo ""
}

# ── Uninstall helper (--uninstall flag) ──────────────────────
uninstall() {
  step "Uninstalling ProxNest"

  systemctl stop proxnest-agent.service 2>/dev/null || true
  systemctl disable proxnest-agent.service 2>/dev/null || true
  rm -f /etc/systemd/system/proxnest-agent.service
  systemctl daemon-reload

  rm -rf "$INSTALL_DIR"
  info "Removed $INSTALL_DIR"

  echo ""
  warn "Config preserved at $CONFIG_DIR — delete manually if desired:"
  echo "  rm -rf $CONFIG_DIR"
  echo ""
  log "ProxNest uninstalled"
  exit 0
}

# ── Main ─────────────────────────────────────────────────────
main() {
  banner

  # Handle --uninstall flag
  if [[ "${1:-}" == "--uninstall" ]]; then
    uninstall
  fi

  preflight
  install_node
  install_docker
  install_proxnest
  generate_config
  create_service
  create_docker_service
  first_boot_setup
  start_agent
  print_summary
}

main "$@"
