/**
 * ProxNest Agent — App Guides & Tips
 * Post-install steps, recommendations, and help for each app.
 */

export interface AppGuide {
  appId: string;
  postInstallSteps: string[];
  tips: string[];
  recommendedNext?: string[]; // App IDs to install next
  commonIssues?: Array<{ problem: string; solution: string }>;
  externalDocs?: string;
}

export const APP_GUIDES: Record<string, AppGuide> = {
  // ── Media ──────────────────────────────────
  jellyfin: {
    appId: 'jellyfin',
    postInstallSteps: [
      'Open the Jellyfin web UI and complete the setup wizard',
      'Create your admin account (remember this password!)',
      'Add media libraries: Movies → /media/movies, TV Shows → /media/tv, Music → /media/music',
      'Set your preferred language and metadata providers',
      'Install the Jellyfin app on your phone/TV for streaming',
    ],
    tips: [
      'Enable hardware transcoding in Dashboard → Playback for smoother streaming',
      'Install the "Intro Skipper" plugin to auto-skip TV show intros',
      'Set up remote access through your reverse proxy for streaming outside your network',
      'Create separate user accounts for family members with parental controls',
    ],
    recommendedNext: ['jellyseerr', 'bazarr', 'radarr', 'sonarr'],
    commonIssues: [
      { problem: 'Media not showing up', solution: 'Make sure files are in /data/media/movies or /data/media/tv, then rescan libraries' },
      { problem: 'Buffering during playback', solution: 'Enable hardware transcoding or lower the streaming quality in user settings' },
      { problem: 'Subtitles missing', solution: 'Install Bazarr for automatic subtitle downloads' },
    ],
    externalDocs: 'https://jellyfin.org/docs/',
  },

  plex: {
    appId: 'plex',
    postInstallSteps: [
      'Open the Plex web UI and sign in with your Plex account',
      'Claim your server at https://app.plex.tv/desktop',
      'Add libraries: Movies → /media/movies, TV Shows → /media/tv, Music → /media/music',
      'Enable remote access in Settings → Remote Access',
    ],
    tips: [
      'Get Plex Pass for hardware transcoding and mobile sync',
      'Use Tautulli to monitor who is watching and streaming stats',
      'Set bandwidth limits per user to prevent buffering for others',
    ],
    recommendedNext: ['overseerr', 'tautulli', 'radarr', 'sonarr'],
    externalDocs: 'https://support.plex.tv/',
  },

  // ── Downloads ──────────────────────────────
  qbittorrent: {
    appId: 'qbittorrent',
    postInstallSteps: [
      'Login with admin / proxnest',
      'Go to Settings → Downloads → set Default Save Path to /downloads/complete',
      'Optional: Set up categories (movies, tv) — these are auto-created by Radarr/Sonarr',
      'Recommended: Set up a VPN for privacy (use the VPN Setup in your dashboard)',
    ],
    tips: [
      '⚠️ IMPORTANT: Use a VPN! Your ISP can see torrent traffic without one',
      'Set upload speed limits to avoid saturating your connection',
      'Enable "When ratio reaches 1.0, stop seeding" to save bandwidth',
      'The download folder /downloads is shared with Radarr/Sonarr for automatic importing',
    ],
    recommendedNext: ['radarr', 'sonarr', 'prowlarr'],
    commonIssues: [
      { problem: 'Slow downloads', solution: 'Check if your VPN is throttling. Try a different VPN server location' },
      { problem: 'Port not connectable', solution: 'Forward port 6881 on your router, or enable UPnP in qBit settings' },
      { problem: 'Downloads stuck at 99%', solution: 'The file may need more seeders. Be patient or find a better source' },
    ],
    externalDocs: 'https://github.com/qbittorrent/qBittorrent/wiki',
  },

  radarr: {
    appId: 'radarr',
    postInstallSteps: [
      'Radarr is auto-configured! qBittorrent is already set as your download client',
      'Add indexers: Go to Settings → Indexers (or install Prowlarr to manage them centrally)',
      'Search for a movie to test: Movies → Add New → search and click Add',
      'Set your preferred quality profile in Settings → Profiles',
    ],
    tips: [
      'Use "Movies" root folder (/movies) — it\'s already mapped to Jellyfin/Plex',
      'Enable "Monitor" on movies you want Radarr to automatically find and download',
      'Set up a quality profile: "HD-1080p" is recommended for most setups',
      'Radarr will automatically rename and organize downloaded movies',
    ],
    recommendedNext: ['prowlarr', 'bazarr', 'jellyfin'],
    commonIssues: [
      { problem: 'No indexers configured', solution: 'Install Prowlarr — it auto-syncs indexers to Radarr' },
      { problem: 'Downloads not importing', solution: 'Check that /downloads and /movies paths are correct in Settings → Media Management' },
    ],
    externalDocs: 'https://wiki.servarr.com/radarr',
  },

  sonarr: {
    appId: 'sonarr',
    postInstallSteps: [
      'Sonarr is auto-configured! qBittorrent is already set as your download client',
      'Add indexers: Go to Settings → Indexers (or install Prowlarr)',
      'Search for a TV show: Series → Add New → search and click Add',
      'Choose which seasons to monitor and download',
    ],
    tips: [
      'Use "TV" root folder (/tv) — it\'s already mapped to Jellyfin/Plex',
      'Set season packs vs individual episodes based on your preference',
      'Enable "Season Folder" in Settings → Media Management for clean organization',
      'Sonarr will automatically grab new episodes as they air',
    ],
    recommendedNext: ['prowlarr', 'bazarr', 'jellyfin'],
    externalDocs: 'https://wiki.servarr.com/sonarr',
  },

  prowlarr: {
    appId: 'prowlarr',
    postInstallSteps: [
      'Prowlarr is auto-synced with Radarr and Sonarr!',
      'Add indexers: Indexers → Add Indexer → search for your preferred sites',
      'Popular free indexers: 1337x, RARBG, The Pirate Bay, YTS',
      'Indexers will automatically sync to Radarr and Sonarr',
    ],
    tips: [
      'Add multiple indexers for better coverage — if one is down, others still work',
      'Use Flaresolverr if indexers are blocked by Cloudflare (install as a separate app)',
      'Test each indexer after adding to make sure it returns results',
      'Prowlarr manages all indexers in one place — no need to add them individually to Radarr/Sonarr',
    ],
    recommendedNext: ['radarr', 'sonarr'],
    externalDocs: 'https://wiki.servarr.com/prowlarr',
  },

  bazarr: {
    appId: 'bazarr',
    postInstallSteps: [
      'Go to Settings → Providers and add subtitle providers',
      'Recommended: OpenSubtitles.com (free account required), Subscene, YIFY Subtitles',
      'Set your preferred languages in Settings → Languages',
      'Bazarr will automatically find and download subtitles for your movies and TV shows',
    ],
    tips: [
      'Create an OpenSubtitles.com account (free) for the best subtitle coverage',
      'Set subtitle score threshold to 90+ to avoid bad matches',
      'Enable "Upgrade Subtitles" to automatically replace low-quality subs with better ones',
    ],
    recommendedNext: ['radarr', 'sonarr'],
    externalDocs: 'https://wiki.bazarr.media/',
  },

  // ── Cloud ──────────────────────────────────
  nextcloud: {
    appId: 'nextcloud',
    postInstallSteps: [
      'Login with admin / proxnest',
      'Change the admin password immediately!',
      'Install the Nextcloud desktop app to sync files from your computer',
      'Install the Nextcloud mobile app for photo backup',
    ],
    tips: [
      'Enable 2FA in Settings → Security for extra protection',
      'Set up external storage to access your media files from Nextcloud',
      'Install useful apps: Calendar, Contacts, Notes, Tasks from the app store',
    ],
    recommendedNext: ['immich'],
    externalDocs: 'https://docs.nextcloud.com/',
  },

  immich: {
    appId: 'immich',
    postInstallSteps: [
      'Open the web UI and create your admin account',
      'Download the Immich mobile app (iOS/Android)',
      'Enable auto-backup in the mobile app to replace Google Photos',
      'Your photos are stored locally — no cloud subscription needed',
    ],
    tips: [
      'Enable ML-powered face recognition and smart search in Admin → Machine Learning',
      'Create shared albums for family members',
      'Set up external libraries to include existing photo folders',
      'Immich is actively developed — update regularly for new features',
    ],
    recommendedNext: ['nextcloud'],
    externalDocs: 'https://immich.app/docs/overview/introduction',
  },

  // ── Network ────────────────────────────────
  pihole: {
    appId: 'pihole',
    postInstallSteps: [
      'Login with admin / proxnest',
      'Set your router\'s DNS to this server\'s IP address for network-wide ad blocking',
      'Or set individual device DNS to point here',
      'Check the dashboard to see blocked queries',
    ],
    tips: [
      'Add more blocklists in Group Management → Adlists for better coverage',
      'Whitelist any sites that break (usually login pages or CDNs)',
      'The default blocklist blocks ~170K domains — add "Steven Black\'s list" for more',
    ],
    recommendedNext: [],
    externalDocs: 'https://docs.pi-hole.net/',
  },

  'nginx-proxy-manager': {
    appId: 'nginx-proxy-manager',
    postInstallSteps: [
      'Login with admin@example.com / changeme',
      'Change your login credentials immediately!',
      'Add proxy hosts: point your domain to each service (e.g., jellyfin.yourdomain.com → port 8096)',
      'Enable SSL with free Let\'s Encrypt certificates',
    ],
    tips: [
      'Use wildcard SSL certs (*.yourdomain.com) to cover all services at once',
      'Enable "Force SSL" and "HTTP/2 Support" on each proxy host',
      'Add "Block Common Exploits" for basic security on public-facing services',
    ],
    recommendedNext: [],
    externalDocs: 'https://nginxproxymanager.com/guide/',
  },

  // ── Monitoring ─────────────────────────────
  grafana: {
    appId: 'grafana',
    postInstallSteps: [
      'Login with admin / admin (change password on first login)',
      'Add a Prometheus data source if you have one running',
      'Import community dashboards: Dashboard → Import → enter dashboard ID',
      'Popular dashboard: Node Exporter Full (ID: 1860)',
    ],
    tips: [
      'Set up alerts to get notified when CPU, RAM, or disk usage is high',
      'Create a home dashboard showing all your key metrics at a glance',
    ],
    recommendedNext: ['uptime-kuma', 'portainer'],
    externalDocs: 'https://grafana.com/docs/',
  },

  portainer: {
    appId: 'portainer',
    postInstallSteps: [
      'Open https://your-ip:9443 and create your admin account',
      'Select "Get Started" to manage your local Docker environment',
      'You can now manage all ProxNest app containers from Portainer',
    ],
    tips: [
      'Use Portainer to view container logs, restart services, or check resource usage',
      'Don\'t delete containers named "proxnest-*" from Portainer — use the ProxNest dashboard instead',
    ],
    recommendedNext: ['dozzle', 'grafana'],
    externalDocs: 'https://docs.portainer.io/',
  },

  // ── Productivity ───────────────────────────
  vaultwarden: {
    appId: 'vaultwarden',
    postInstallSteps: [
      'Open the web UI and create your account',
      'Install the Bitwarden browser extension and mobile app',
      'Point the apps to your Vaultwarden URL (not the default Bitwarden cloud)',
      'Start adding your passwords — import from Chrome, 1Password, LastPass, etc.',
    ],
    tips: [
      '⚠️ BACK UP YOUR DATABASE regularly — losing it means losing all passwords',
      'Enable 2FA on your Vaultwarden account for maximum security',
      'Use HTTPS (via reverse proxy) — never expose Vaultwarden over plain HTTP',
      'Share passwords with family using Organizations',
    ],
    recommendedNext: ['nginx-proxy-manager'],
    externalDocs: 'https://github.com/dani-garcia/vaultwarden/wiki',
  },
};

/**
 * Get the guide for an app. Returns a generic guide if no specific one exists.
 */
export function getAppGuide(appId: string): AppGuide {
  return APP_GUIDES[appId] || {
    appId,
    postInstallSteps: [
      'Open the web UI using the URL shown above',
      'Complete the initial setup wizard if prompted',
      'Check the app\'s documentation for configuration options',
    ],
    tips: [
      'Set up a reverse proxy (Nginx Proxy Manager) for HTTPS access',
      'Back up your app data regularly',
    ],
  };
}

/**
 * Get a "Getting Started" checklist based on what's installed.
 */
export function getGettingStarted(installedApps: string[]): Array<{ step: string; done: boolean; priority: 'high' | 'medium' | 'low' }> {
  const steps: Array<{ step: string; done: boolean; priority: 'high' | 'medium' | 'low' }> = [];

  // Always recommend
  steps.push({
    step: 'Set up a reverse proxy for HTTPS access to your services',
    done: installedApps.includes('nginx-proxy-manager'),
    priority: 'high',
  });

  steps.push({
    step: 'Install a password manager to keep your credentials safe',
    done: installedApps.includes('vaultwarden'),
    priority: 'high',
  });

  // Media stack
  const hasMediaPlayer = installedApps.includes('jellyfin') || installedApps.includes('plex');
  const hasDownloader = installedApps.includes('qbittorrent');
  const hasManager = installedApps.includes('radarr') || installedApps.includes('sonarr');
  const hasIndexer = installedApps.includes('prowlarr');

  if (hasMediaPlayer && !hasDownloader) {
    steps.push({ step: 'Install qBittorrent + Radarr/Sonarr to automatically download media', done: false, priority: 'medium' });
  }
  if (hasDownloader && !hasMediaPlayer) {
    steps.push({ step: 'Install Jellyfin or Plex to stream your downloaded media', done: false, priority: 'medium' });
  }
  if (hasManager && !hasIndexer) {
    steps.push({ step: 'Install Prowlarr to manage indexers for Radarr/Sonarr', done: false, priority: 'medium' });
  }
  if (hasDownloader) {
    steps.push({
      step: 'Set up a VPN for qBittorrent to protect your privacy',
      done: false, // Would need to check VPN status
      priority: 'high',
    });
  }

  // Monitoring
  if (installedApps.length >= 3 && !installedApps.includes('uptime-kuma') && !installedApps.includes('portainer')) {
    steps.push({ step: 'Install monitoring tools to keep an eye on your services', done: false, priority: 'low' });
  }

  // Backup reminder
  steps.push({
    step: 'Set up regular backups of your server configuration and data',
    done: false,
    priority: 'high',
  });

  return steps;
}

/**
 * Get smart recommendations based on what's installed.
 */
export function getRecommendations(installedApps: string[]): Array<{ appId: string; reason: string }> {
  const recs: Array<{ appId: string; reason: string }> = [];
  const installed = new Set(installedApps);

  if (installed.has('jellyfin') && !installed.has('jellyseerr')) {
    recs.push({ appId: 'jellyseerr', reason: 'Let your family request movies and shows through a beautiful UI' });
  }
  if (installed.has('plex') && !installed.has('overseerr')) {
    recs.push({ appId: 'overseerr', reason: 'Let users request media through Plex' });
  }
  if (installed.has('plex') && !installed.has('tautulli')) {
    recs.push({ appId: 'tautulli', reason: 'See who\'s watching, what\'s popular, and streaming stats' });
  }
  if ((installed.has('radarr') || installed.has('sonarr')) && !installed.has('bazarr')) {
    recs.push({ appId: 'bazarr', reason: 'Automatically download subtitles for all your movies and TV shows' });
  }
  if ((installed.has('radarr') || installed.has('sonarr')) && !installed.has('prowlarr')) {
    recs.push({ appId: 'prowlarr', reason: 'Manage all your indexers in one place — auto-syncs to Radarr/Sonarr' });
  }
  if (installed.has('qbittorrent') && !installed.has('radarr')) {
    recs.push({ appId: 'radarr', reason: 'Automate movie downloads — search, grab, and organize automatically' });
  }
  if (installed.has('qbittorrent') && !installed.has('sonarr')) {
    recs.push({ appId: 'sonarr', reason: 'Automate TV show downloads — new episodes grabbed automatically' });
  }
  if (!installed.has('nextcloud') && !installed.has('syncthing')) {
    recs.push({ appId: 'nextcloud', reason: 'Replace Google Drive/Dropbox with your own private cloud storage' });
  }
  if (!installed.has('immich')) {
    recs.push({ appId: 'immich', reason: 'Replace Google Photos — backup and organize photos privately' });
  }
  if (installed.size >= 5 && !installed.has('homepage')) {
    recs.push({ appId: 'homepage', reason: 'Beautiful dashboard showing all your services in one place' });
  }
  if (!installed.has('pihole') && !installed.has('adguard')) {
    recs.push({ appId: 'pihole', reason: 'Block ads across your entire network — works on every device' });
  }

  return recs.slice(0, 5); // Max 5 recommendations
}
