# Networking Guide

ProxNest includes built-in tools for VPN, reverse proxy, remote access, DNS, and SSL - all manageable through the dashboard.

## VPN Setup

### (Recommended)
WireGuard is the default VPN for ProxNest - fast, modern, and lightweight.

**Install via App Store:**
1. Dashboard → App Store → Search "WireGuard"
2. Click Install
3. Access WireGuard UI at `http://your-server:51821`

**Features:**
- Generate client configs with QR codes
- Mobile-friendly (iOS, Android apps available)
- Kill-switch support for torrent traffic
- Auto-starts on boot

**Use cases:**
- Secure remote access to your home network
- Route torrent traffic through external VPN provider
- Site-to-site connections between locations

### OpenVPN
For compatibility with corporate VPNs or VPN providers that only support OpenVPN:

1. Dashboard → System → VPN
2. Upload your `.ovpn` configuration file
3. Select your VPN provider (or "Custom")
4. Click Start

Supported providers:
- Mullvad
- ProtonVPN
- NordVPN
- Surfshark
- PIA (Private Internet Access)
- Custom `.ovpn` files

### (Zero-Config Mesh VPN)
For the easiest remote access without port forwarding:

1. Install Tailscale from App Store
2. Authenticate with your Tailscale account
3. All your Tailscale devices can now access the server

---

## Reverse Proxy

### Proxy Manager (NPM)
The recommended reverse proxy for ProxNest. Provides a GUI for managing proxy hosts and SSL certificates.

**Install:**
1. Dashboard → App Store → Search "Nginx Proxy Manager"
2. Click Install
3. Access at `http://your-server:81`
4. Default login: `admin@example.com` / `changeme`

**Setting up a proxy host:**
1. Click "Add Proxy Host"
2. Domain: `jellyfin.yourdomain.com`
3. Forward to: `http://your-server-ip:8096`
4. Enable SSL → Request Let's Encrypt certificate
5. Force SSL → On

### Traefik
For power users who prefer configuration-as-code:

1. Install Traefik from App Store
2. Configure via `traefik.yml` and dynamic config files
3. Automatic Let's Encrypt with HTTP challenge

### Caddy
Simplest option - automatic HTTPS with zero config:

1. Install Caddy from App Store
2. Edit Caddyfile with your domains
3. SSL certificates are automatic

---

## Remote Access

### Tunnels (Recommended for Exposing Services)
Access your services from anywhere without opening ports.

1. Install Cloudflared from App Store
2. Create a tunnel in the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/)
3. Copy the tunnel token
4. Configure in ProxNest: Dashboard → Network → Cloudflare Tunnel
5. Map public hostnames to internal services

**Advantages:**
- No port forwarding needed
- DDoS protection included
- Free tier available
- Access policies for additional security

### Tailscale
Mesh VPN for private access (not public-facing):

1. Install Tailscale from App Store
2. All Tailscale-connected devices can reach your server
3. Use MagicDNS for easy naming (e.g., `proxnest.tail12345.ts.net`)

### Port Forwarding
If you prefer traditional access:

1. Forward ports on your router (443 for HTTPS, 51820 for WireGuard)
2. Use a reverse proxy (NPM) with SSL certificates
3. Set up Dynamic DNS if you don't have a static IP

> ⚠️ **Security Note:** Always use a reverse proxy with SSL. Never expose services directly on HTTP.

---

## DNS

### Home (Recommended)
Network-wide ad blocking and DNS management.

1. Install AdGuard Home from App Store
2. Set your router's DNS to your ProxNest server IP
3. Access at `http://your-server:3003`

**Features:**
- Block ads and trackers network-wide
- DNS-over-HTTPS and DNS-over-TLS support
- Per-client filtering rules
- Query log and statistics

### Pi-hole
Alternative ad-blocking DNS:

1. Install Pi-hole from App Store
2. Set router DNS to server IP
3. Access at `http://your-server/admin`

### DNS
Run internal DNS alongside ad blocking:

1. Configure AdGuard/Pi-hole with custom DNS rewrites
2. Map `*.local.yourdomain.com` to internal IPs
3. Use with reverse proxy for clean URLs

Example AdGuard DNS rewrite:
```
jellyfin.home → 192.168.50.200
nextcloud.home → 192.168.50.201
```

---

## SSL Certificates

### Encrypt (via NPM)
Free, automated SSL certificates:

1. Set up Nginx Proxy Manager (see above)
2. Add proxy host with your domain
3. Enable SSL → Request Let's Encrypt certificate
4. Auto-renewal is handled automatically

### Origin Certificates
If using Cloudflare as your DNS:

1. Generate an Origin Certificate in Cloudflare dashboard
2. Upload to NPM as a custom certificate
3. Set SSL mode to "Full (Strict)" in Cloudflare

### (Local Only)
For local-only access:

1. ProxNest generates self-signed certs automatically
2. Accept the browser security warning
3. Or add the CA to your devices' trust store

---

## Network Configuration

### IP
Set via Dashboard → Settings → Network, or via CLI:

```bash
# Edit network config
nano /etc/network/interfaces

# Example static IP
auto eth0
iface eth0 inet static
    address 192.168.50.100/24
    gateway 192.168.50.1
```

### Support
ProxNest supports VLANs for network segmentation:

1. Dashboard → Network → Create VLAN
2. Assign VLAN ID and IP range
3. Assign VMs/CTs to specific VLANs

### Firewall
Built-in firewall management:

1. Dashboard → Firewall
2. View active iptables rules
3. Add/remove rules via GUI
4. PVE firewall integration

---

Need networking help? [Join our Discord](https://discord.gg/b4NGUMYU34) - our community includes networking experts.
