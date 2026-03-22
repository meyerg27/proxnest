#!/bin/bash
# ProxNest ISO Builder
# Remaster Proxmox VE ISO with ProxNest pre-installed
# Usage: sudo ./build-iso.sh [proxmox-iso-path]

set -e

# Config
PROXNEST_VERSION="0.4.0"
PVE_ISO_URL="https://enterprise.proxmox.com/iso/proxmox-ve_8.3-1.iso"
WORK_DIR="/tmp/proxnest-iso-build"
OUTPUT_ISO="proxnest-${PROXNEST_VERSION}.iso"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${CYAN}[i]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Check deps
for cmd in xorriso unsquashfs mksquashfs; do
  command -v $cmd &>/dev/null || fail "Missing: $cmd — install with: apt install xorriso squashfs-tools"
done

echo -e "${CYAN}${BOLD}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║       🏠 ProxNest ISO Builder         ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Get Proxmox ISO
PVE_ISO="${1:-}"
if [ -z "$PVE_ISO" ]; then
  PVE_ISO="${WORK_DIR}/proxmox-ve.iso"
  if [ ! -f "$PVE_ISO" ]; then
    warn "Downloading Proxmox VE ISO..."
    mkdir -p "$WORK_DIR"
    wget -q --show-progress -O "$PVE_ISO" "$PVE_ISO_URL"
  fi
  log "Using Proxmox ISO: $PVE_ISO"
else
  log "Using provided ISO: $PVE_ISO"
fi

# Clean workspace
rm -rf "${WORK_DIR}/iso" "${WORK_DIR}/squashfs"
mkdir -p "${WORK_DIR}/iso" "${WORK_DIR}/squashfs"

# Extract ISO
log "Extracting ISO..."
xorriso -osirrox on -indev "$PVE_ISO" -extract / "${WORK_DIR}/iso" 2>/dev/null
chmod -R u+w "${WORK_DIR}/iso"

# Find and extract the squashfs (contains the actual OS)
SQUASHFS=$(find "${WORK_DIR}/iso" -name "pve-base.squashfs" -o -name "pve-installer.squashfs" | head -1)
if [ -z "$SQUASHFS" ]; then
  # PVE 8.x structure
  SQUASHFS=$(find "${WORK_DIR}/iso" -name "*.squashfs" | head -1)
fi
[ -n "$SQUASHFS" ] || fail "Could not find squashfs in ISO"
log "Found squashfs: $(basename $SQUASHFS)"

# Extract squashfs
log "Extracting squashfs (this takes a minute)..."
unsquashfs -d "${WORK_DIR}/squashfs/root" "$SQUASHFS" >/dev/null 2>&1

# Inject ProxNest post-install hook
log "Injecting ProxNest post-install hook..."

# Create the first-boot script that runs after Proxmox install
cat > "${WORK_DIR}/squashfs/root/usr/local/bin/proxnest-first-boot.sh" << 'FIRSTBOOT'
#!/bin/bash
# ProxNest First Boot — Runs once after Proxmox installation
# This script installs ProxNest and sets up the first-boot wizard

LOG="/var/log/proxnest-first-boot.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== ProxNest First Boot $(date) ==="

# Wait for network
for i in $(seq 1 30); do
  ping -c1 -W2 8.8.8.8 &>/dev/null && break
  sleep 2
done

# Install Node.js 22
if ! command -v node &>/dev/null; then
  echo "[ProxNest] Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y nodejs >/dev/null 2>&1
fi

# Install ProxNest
echo "[ProxNest] Installing ProxNest..."
PROXNEST_DIR="/opt/proxnest"
if [ ! -d "$PROXNEST_DIR" ]; then
  git clone --depth 1 https://github.com/meyerg27/proxnest.git "$PROXNEST_DIR" 2>/dev/null || {
    mkdir -p "$PROXNEST_DIR"
    curl -fsSL https://github.com/meyerg27/proxnest/archive/refs/heads/main.tar.gz | tar xz -C "$PROXNEST_DIR" --strip-components=1
  }
fi

# Install dependencies and build
cd "$PROXNEST_DIR/api" && npm install --production --silent 2>/dev/null
cd "$PROXNEST_DIR/dashboard" && npm install --silent 2>/dev/null && npm run build 2>/dev/null

# Generate config
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)
NODE_NAME=$(hostname)

mkdir -p "$PROXNEST_DIR/data"
cat > "$PROXNEST_DIR/config.json" << EOF
{
  "server": { "host": "0.0.0.0", "port": 4200 },
  "proxmox": {
    "host": "https://127.0.0.1:8006",
    "node": "${NODE_NAME}",
    "tokenId": "",
    "tokenSecret": ""
  },
  "jwt": { "secret": "${JWT_SECRET}" },
  "admin": { "username": "admin", "password": "${ADMIN_PASS}" },
  "database": { "path": "${PROXNEST_DIR}/data/proxnest.db" },
  "firstBoot": true
}
EOF

# Create systemd service
cat > /etc/systemd/system/proxnest.service << EOF
[Unit]
Description=ProxNest — Home Server Dashboard
After=network.target pveproxy.service

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
systemctl enable proxnest
systemctl start proxnest

# Create welcome message
IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
cat > /etc/motd << EOF

  ╔═══════════════════════════════════════════════════════╗
  ║  🏠 ProxNest — Your Home Server is Ready!            ║
  ║                                                       ║
  ║  Dashboard:  http://${IP}:4200                        ║
  ║  Setup:      http://${IP}:4200/setup                  ║
  ║                                                       ║
  ║  Default login: admin / ${ADMIN_PASS}                 ║
  ╚═══════════════════════════════════════════════════════╝

EOF

echo "[ProxNest] Installation complete!"
echo "[ProxNest] Dashboard: http://${IP}:4200"
echo "[ProxNest] Admin: admin / ${ADMIN_PASS}"

# Disable this script from running again
systemctl disable proxnest-first-boot.service 2>/dev/null
rm -f /etc/systemd/system/proxnest-first-boot.service

echo "=== ProxNest First Boot Complete $(date) ==="
FIRSTBOOT

chmod +x "${WORK_DIR}/squashfs/root/usr/local/bin/proxnest-first-boot.sh"

# Create systemd service for first-boot
mkdir -p "${WORK_DIR}/squashfs/root/etc/systemd/system"
cat > "${WORK_DIR}/squashfs/root/etc/systemd/system/proxnest-first-boot.service" << 'EOF'
[Unit]
Description=ProxNest First Boot Setup
After=network-online.target pveproxy.service
Wants=network-online.target
ConditionPathExists=/usr/local/bin/proxnest-first-boot.sh

[Service]
Type=oneshot
ExecStart=/usr/local/bin/proxnest-first-boot.sh
RemainAfterExit=yes
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
EOF

# Enable the first-boot service
ln -sf /etc/systemd/system/proxnest-first-boot.service \
  "${WORK_DIR}/squashfs/root/etc/systemd/system/multi-user.target.wants/proxnest-first-boot.service" 2>/dev/null || true

# Rebrand the installer
log "Rebranding installer..."

# Update installer title if possible
find "${WORK_DIR}/iso" -name "*.cfg" -exec sed -i \
  -e 's/Proxmox VE/ProxNest/g' \
  -e 's/Install Proxmox/Install ProxNest/g' {} + 2>/dev/null || true

# Update GRUB menu
find "${WORK_DIR}/iso" -name "grub.cfg" -exec sed -i \
  -e 's/Install Proxmox VE.*/Install ProxNest (Graphical)/g' \
  -e 's/Proxmox VE/ProxNest/g' {} + 2>/dev/null || true

# Repack squashfs
log "Repacking squashfs..."
rm -f "${SQUASHFS}"
mksquashfs "${WORK_DIR}/squashfs/root" "${SQUASHFS}" -comp zstd -quiet

# Rebuild ISO
log "Building ProxNest ISO..."
cd "${WORK_DIR}/iso"
xorriso -as mkisofs \
  -o "${WORK_DIR}/${OUTPUT_ISO}" \
  -r -V "PROXNEST_${PROXNEST_VERSION}" \
  -isohybrid-mbr /usr/lib/ISOLINUX/isohdpfx.bin \
  -b boot/isolinux/isolinux.bin \
  -c boot/isolinux/boot.cat \
  -no-emul-boot -boot-load-size 4 -boot-info-table \
  -eltorito-alt-boot \
  -e boot/grub/efi.img \
  -no-emul-boot -isohybrid-gpt-basdat \
  . 2>/dev/null

ISO_SIZE=$(du -h "${WORK_DIR}/${OUTPUT_ISO}" | awk '{print $1}')
log "ISO built: ${WORK_DIR}/${OUTPUT_ISO} (${ISO_SIZE})"

# Copy to output
cp "${WORK_DIR}/${OUTPUT_ISO}" "./${OUTPUT_ISO}"

echo ""
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  🎉 ProxNest ISO Ready!${NC}"
echo -e "${CYAN}${BOLD}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  ISO:    ${BOLD}${OUTPUT_ISO}${NC} (${ISO_SIZE})"
echo -e "  Flash:  ${BOLD}dd if=${OUTPUT_ISO} of=/dev/sdX bs=4M status=progress${NC}"
echo -e "  Or use: ${BOLD}Balena Etcher / Rufus${NC}"
echo ""
echo -e "  After install, open: ${BOLD}http://<server-ip>:4200${NC}"
echo ""
