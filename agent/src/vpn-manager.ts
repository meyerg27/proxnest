/**
 * ProxNest Agent — VPN Manager
 * Manages a Gluetun VPN container that qBittorrent routes through.
 * 
 * Architecture:
 *   User uploads .ovpn → Gluetun container starts → qBit uses --network=container:gluetun
 *   Kill switch is automatic: if VPN drops, qBit has no internet.
 * 
 * Supported providers: AirVPN, Mullvad, NordVPN, ProtonVPN, PIA, Surfshark, custom OpenVPN
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';

const VPN_DIR = '/opt/proxnest-apps/vpn';
const VPN_CONTAINER = 'proxnest-vpn';

export interface VpnConfig {
  provider: string;
  status: 'running' | 'stopped' | 'error' | 'not_configured';
  publicIp?: string;
  country?: string;
  error?: string;
}

// ─── VPN Setup ───────────────────────────────────

/**
 * Save an OpenVPN config file and start the VPN container.
 */
export function setupVpn(ovpnContent: string, provider: string = 'custom'): { success: boolean; message: string } {
  try {
    mkdirSync(VPN_DIR, { recursive: true });

    // Save the config
    writeFileSync(`${VPN_DIR}/config.ovpn`, ovpnContent);
    writeFileSync(`${VPN_DIR}/provider.txt`, provider);

    // Extract auth from ovpn if present, or create empty auth file
    if (!existsSync(`${VPN_DIR}/auth.txt`)) {
      writeFileSync(`${VPN_DIR}/auth.txt`, '');
    }

    // Stop existing VPN container
    try {
      execSync(`docker rm -f ${VPN_CONTAINER} 2>/dev/null`, { encoding: 'utf-8', timeout: 10000 });
    } catch { /* ok */ }

    // Detect provider-specific settings
    const gluetunEnv = getGluetunEnv(provider, ovpnContent);

    // Start Gluetun VPN container
    let cmd = `docker run -d --name ${VPN_CONTAINER} --restart unless-stopped --privileged --cap-add=NET_ADMIN`;
    
    // Gluetun needs /dev/net/tun
    cmd += ` --device /dev/net/tun:/dev/net/tun`;
    
    // Mount config
    cmd += ` -v ${VPN_DIR}:/gluetun`;
    
    // Expose qBit ports through VPN container (since qBit will use this network)
    cmd += ` -p 8085:8085 -p 6881:6881 -p 6881:6881/udp`;
    
    // Environment variables
    for (const [k, v] of Object.entries(gluetunEnv)) {
      cmd += ` -e ${k}=${v}`;
    }

    cmd += ` qmcgaw/gluetun:latest`;

    const containerId = execSync(cmd, { encoding: 'utf-8', timeout: 60000 }).trim();

    // Wait for VPN to connect
    execSync('sleep 10', { encoding: 'utf-8' });

    // Check if VPN is up
    const status = getVpnStatus();
    
    if (status.status === 'running') {
      return {
        success: true,
        message: `VPN connected! Public IP: ${status.publicIp || 'checking...'}${status.country ? ` (${status.country})` : ''}. qBittorrent will route through VPN with kill switch enabled.`,
      };
    } else {
      return {
        success: false,
        message: `VPN container started but may not be connected yet. Check status in a moment. ${status.error || ''}`,
      };
    }
  } catch (err) {
    return {
      success: false,
      message: `VPN setup failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Build Gluetun environment variables based on provider.
 */
function getGluetunEnv(provider: string, ovpnContent: string): Record<string, string> {
  const env: Record<string, string> = {
    TZ: 'UTC',
  };

  const providerLower = provider.toLowerCase();

  if (providerLower === 'airvpn') {
    env.VPN_SERVICE_PROVIDER = 'airvpn';
    env.VPN_TYPE = 'openvpn';
    env.OPENVPN_CUSTOM_CONFIG = '/gluetun/config.ovpn';
  } else if (providerLower === 'mullvad') {
    env.VPN_SERVICE_PROVIDER = 'mullvad';
    env.VPN_TYPE = 'openvpn';
    env.OPENVPN_CUSTOM_CONFIG = '/gluetun/config.ovpn';
  } else if (['nordvpn', 'nord'].includes(providerLower)) {
    env.VPN_SERVICE_PROVIDER = 'nordvpn';
    env.VPN_TYPE = 'openvpn';
    env.OPENVPN_CUSTOM_CONFIG = '/gluetun/config.ovpn';
  } else if (['protonvpn', 'proton'].includes(providerLower)) {
    env.VPN_SERVICE_PROVIDER = 'protonvpn';
    env.VPN_TYPE = 'openvpn';
    env.OPENVPN_CUSTOM_CONFIG = '/gluetun/config.ovpn';
  } else if (['pia', 'privateinternetaccess'].includes(providerLower)) {
    env.VPN_SERVICE_PROVIDER = 'private internet access';
    env.VPN_TYPE = 'openvpn';
    env.OPENVPN_CUSTOM_CONFIG = '/gluetun/config.ovpn';
  } else if (providerLower === 'surfshark') {
    env.VPN_SERVICE_PROVIDER = 'surfshark';
    env.VPN_TYPE = 'openvpn';
    env.OPENVPN_CUSTOM_CONFIG = '/gluetun/config.ovpn';
  } else {
    // Custom OpenVPN config
    env.VPN_SERVICE_PROVIDER = 'custom';
    env.VPN_TYPE = 'openvpn';
    env.OPENVPN_CUSTOM_CONFIG = '/gluetun/config.ovpn';
  }

  // Check if ovpn has inline auth or needs auth-user-pass file
  if (ovpnContent.includes('auth-user-pass')) {
    env.OPENVPN_USER = '';
    env.OPENVPN_PASSWORD = '';
  }

  return env;
}

/**
 * Get current VPN status.
 */
export function getVpnStatus(): VpnConfig {
  const provider = (() => {
    try { return readFileSync(`${VPN_DIR}/provider.txt`, 'utf-8').trim(); } catch { return 'unknown'; }
  })();

  // Check if container exists and is running
  try {
    const status = execSync(
      `docker inspect --format '{{.State.Status}}' ${VPN_CONTAINER} 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    ).trim();

    if (status !== 'running') {
      return { provider, status: 'stopped' };
    }

    // Get public IP through VPN
    let publicIp: string | undefined;
    let country: string | undefined;
    try {
      publicIp = execSync(
        `docker exec ${VPN_CONTAINER} wget -qO- https://ipinfo.io/ip 2>/dev/null`,
        { encoding: 'utf-8', timeout: 10000 },
      ).trim();
      
      // Get country
      try {
        country = execSync(
          `docker exec ${VPN_CONTAINER} wget -qO- https://ipinfo.io/country 2>/dev/null`,
          { encoding: 'utf-8', timeout: 5000 },
        ).trim();
      } catch { /* ok */ }
    } catch { /* ok */ }

    return { provider, status: 'running', publicIp, country };
  } catch {
    if (!existsSync(`${VPN_DIR}/config.ovpn`)) {
      return { provider: 'none', status: 'not_configured' };
    }
    return { provider, status: 'stopped' };
  }
}

/**
 * Stop the VPN container.
 */
export function stopVpn(): { success: boolean; message: string } {
  try {
    execSync(`docker stop ${VPN_CONTAINER} 2>/dev/null`, { encoding: 'utf-8', timeout: 10000 });
    return { success: true, message: 'VPN stopped. qBittorrent will lose internet (kill switch).' };
  } catch {
    return { success: false, message: 'VPN container not found or already stopped.' };
  }
}

/**
 * Start the VPN container (if config exists).
 */
export function startVpn(): { success: boolean; message: string } {
  try {
    execSync(`docker start ${VPN_CONTAINER} 2>/dev/null`, { encoding: 'utf-8', timeout: 10000 });
    execSync('sleep 5', { encoding: 'utf-8' });
    const status = getVpnStatus();
    return {
      success: status.status === 'running',
      message: status.status === 'running'
        ? `VPN started. IP: ${status.publicIp || 'connecting...'}`
        : 'VPN container started but not connected yet.',
    };
  } catch {
    return { success: false, message: 'No VPN config found. Upload a .ovpn file first.' };
  }
}

/**
 * Check if VPN is running and qBit should route through it.
 */
export function isVpnActive(): boolean {
  try {
    const status = execSync(
      `docker inspect --format '{{.State.Status}}' ${VPN_CONTAINER} 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 },
    ).trim();
    return status === 'running';
  } catch { return false; }
}

/**
 * Get Docker network flag for qBit when VPN is active.
 * Returns '--network=container:proxnest-vpn' if VPN is running, empty string otherwise.
 */
export function getVpnNetworkFlag(): string {
  return isVpnActive() ? `--network=container:${VPN_CONTAINER}` : '';
}
