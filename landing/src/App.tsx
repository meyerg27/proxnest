import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Server, Shield, Zap, HardDrive, Layout, Users,
  ChevronRight, Check, ArrowRight, Menu, X, Github, Twitter,
  Box, Download,
  Terminal, Star, MessageCircle
} from 'lucide-react'

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
}

// --- NAVBAR ---
function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="fixed top-0 w-full z-50 glass">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
            <Server size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold">Prox<span className="text-accent-400">Nest</span></span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-nest-300 hover:text-white transition">Features</a>
          <a href="#apps" className="text-nest-300 hover:text-white transition">Apps</a>
          <a href="#compare" className="text-nest-300 hover:text-white transition">Compare</a>
          <a href="#pricing" className="text-nest-300 hover:text-white transition">Pricing</a>
          <a href="https://cloud.proxnest.com" className="text-nest-300 hover:text-white transition">
            Dashboard
          </a>
          <a href="https://cloud.proxnest.com/login" className="px-4 py-2 border border-nest-600 hover:border-accent-500 rounded-lg font-medium transition">
            Login
          </a>
          <a href="https://discord.gg/b4NGUMYU34" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] rounded-lg font-medium transition flex items-center gap-1.5">
            <MessageCircle size={16} /> Discord
          </a>
          <a href="#install" className="px-5 py-2 bg-accent-500 hover:bg-accent-600 rounded-lg font-medium transition">
            Install
          </a>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden px-6 pb-6 flex flex-col gap-4">
          <a href="#features" className="text-nest-300" onClick={() => setOpen(false)}>Features</a>
          <a href="#apps" className="text-nest-300" onClick={() => setOpen(false)}>Apps</a>
          <a href="#compare" className="text-nest-300" onClick={() => setOpen(false)}>Compare</a>
          <a href="#pricing" className="text-nest-300" onClick={() => setOpen(false)}>Pricing</a>
          <a href="https://cloud.proxnest.com/login" className="px-5 py-2 border border-nest-600 rounded-lg font-medium text-center" onClick={() => setOpen(false)}>Login</a>
          <a href="https://discord.gg/b4NGUMYU34" target="_blank" rel="noopener noreferrer" className="px-5 py-2 bg-[#5865F2] rounded-lg font-medium text-center flex items-center justify-center gap-1.5" onClick={() => setOpen(false)}><MessageCircle size={16} /> Discord</a>
          <a href="#install" className="px-5 py-2 bg-accent-500 rounded-lg font-medium text-center" onClick={() => setOpen(false)}>Install</a>
        </div>
      )}
    </nav>
  )
}

// --- HERO ---
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-[128px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-green-500/8 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.05)_0%,transparent_70%)]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <motion.div initial="hidden" animate="visible" variants={stagger}>
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent-500/30 bg-accent-500/10 text-accent-300 text-sm mb-6">
            <Zap size={14} /> Early access. Rough edges expected.
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl lg:text-7xl font-bold leading-tight mb-6">
            Proxmox power,<br />
            <span className="gradient-text">without the pain.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-xl text-nest-300 mb-8 max-w-lg">
            Apps that install and configure themselves. Built on Proxmox, so you get real VMs, containers, and ZFS. Not another Docker wrapper.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
            <a href="#install" className="px-8 py-3.5 bg-accent-500 hover:bg-accent-600 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2 shadow-lg shadow-accent-500/25">
              <Download size={20} /> Install
            </a>
            <a href="#features" className="px-8 py-3.5 border border-nest-600 hover:border-nest-500 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2 text-nest-200">
              How it works <ChevronRight size={18} />
            </a>
          </motion.div>
          <motion.div variants={fadeUp} className="flex items-center gap-6 mt-8 text-sm text-nest-400">
            <span className="flex items-center gap-1.5"><Check size={14} className="text-green-400" /> Free tier, no time limit</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-green-400" /> Runs on your hardware</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-green-400" /> Open source (AGPL)</span>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-6">
            <a href="https://discord.gg/b4NGUMYU34" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5865F2]/15 border border-[#5865F2]/30 hover:bg-[#5865F2]/25 rounded-xl text-[#8b9aff] hover:text-white transition text-sm font-medium">
              <svg width="20" height="16" viewBox="0 0 71 55" fill="currentColor"><path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.7 9a.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.2.1 58.5 58.5 0 0017.7-9v-.1c1.4-15-2.3-28.4-9.8-40.1a.2.2 0 00-.1-.1zM23.7 37.3c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1 6.4 3.2 6.3 7.1c0 3.9-2.8 7.1-6.3 7.1zm23.2 0c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1 6.4 3.2 6.3 7.1c0 3.9-2.7 7.1-6.3 7.1z"/></svg>
              Join the Discord. Ask questions, share your setup.
            </a>
          </motion.div>
        </motion.div>

        {/* Real Dashboard Screenshots */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative"
        >
          <div className="glass rounded-2xl glow-border p-1">
            <div className="bg-nest-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-nest-700">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-nest-400">cloud.proxnest.com</span>
              </div>
              <img
                src="/screenshots/ss-overview.png"
                alt="ProxNest dashboard showing system stats and installed apps"
                className="w-full"
              />
            </div>
          </div>
          <div className="absolute -z-10 top-8 left-8 right-8 bottom-0 bg-accent-500/5 rounded-2xl blur-xl" />
        </motion.div>
      </div>
    </section>
  )
}

// --- FEATURES ---
const features = [
  {
    icon: Box,
    title: 'Apps that wire themselves',
    desc: "Click \"Media Server.\" Jellyfin, Radarr, Sonarr, qBit, and Prowlarr install and connect to each other. You didn't touch a single config file.",
    color: 'bg-accent-500/15 text-accent-400',
  },
  {
    icon: HardDrive,
    title: 'Storage that makes sense',
    desc: 'Plug in a drive. The wizard detects it, formats it, and asks where you want media vs. downloads vs. backups. ZFS, ext4, whatever. No command line required.',
    color: 'bg-green-500/15 text-green-400',
  },
  {
    icon: Layout,
    title: 'Manage it from your phone',
    desc: 'The cloud dashboard lets you check on your server from anywhere. See what\'s running, open a terminal, install apps. Works on your phone.',
    color: 'bg-amber-400/15 text-amber-400',
  },
  {
    icon: Shield,
    title: 'Your hardware. Your data.',
    desc: 'Everything runs locally. The cloud portal is just a remote control. Your files never leave your network. WireGuard VPN is baked in for torrents.',
    color: 'bg-rose-400/15 text-rose-400',
  },
  {
    icon: Terminal,
    title: 'Full Proxmox underneath',
    desc: "This isn't a toy. It's actual Proxmox VE. You can still spin up VMs, create LXC containers, manage ZFS pools. We just added a friendlier layer on top.",
    color: 'bg-purple-400/15 text-purple-400',
  },
  {
    icon: Users,
    title: 'Backups that work',
    desc: 'One button backs up every app config. Restore to the same box or a new one. Post-install guides tell you what to do next instead of leaving you guessing.',
    color: 'bg-cyan-400/15 text-cyan-400',
  },
]

function Features() {
  return (
    <section id="features" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.h2 variants={fadeUp} className="text-4xl lg:text-5xl font-bold mb-4">
            What it <span className="gradient-text">actually does.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400 max-w-2xl mx-auto">
            ProxNest is a dashboard and auto-config layer on top of Proxmox. You get the full power of Proxmox without needing to learn Proxmox.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={stagger}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((f, i) => (
            <motion.div key={i} variants={fadeUp}
              className="glass rounded-2xl p-8 hover:border-accent-500/30 transition group"
            >
              <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                <f.icon size={22} />
              </div>
              <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
              <p className="text-nest-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// --- SCREENSHOT GALLERY ---
const screenshots = [
  { src: '/screenshots/ss-overview.png', label: 'Dashboard', desc: 'System stats, quick actions, getting started checklist' },
  { src: '/screenshots/ss-system.png', label: 'System', desc: 'Services, updates, web terminal' },
  { src: '/screenshots/ss-storage.png', label: 'Storage', desc: 'Disk detection, pool management, role assignment' },
  { src: '/screenshots/ss-fleet.png', label: 'Fleet', desc: 'Multiple servers, one view' },
]

function Screenshots() {
  const [active, setActive] = useState(0)
  return (
    <section className="py-32 bg-nest-800/30">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-12">
          <motion.h2 variants={fadeUp} className="text-4xl lg:text-5xl font-bold mb-4">
            Real screenshots. <span className="gradient-text">No mockups.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400">
            This is what you actually get.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <div className="flex justify-center gap-3 mb-8">
            {screenshots.map((s, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  active === i
                    ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                    : 'text-nest-400 hover:text-white hover:bg-nest-700/50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="glass rounded-2xl glow-border p-1 max-w-5xl mx-auto">
            <div className="bg-nest-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-nest-700">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-nest-400">cloud.proxnest.com — {screenshots[active].label}</span>
              </div>
              <img
                src={screenshots[active].src}
                alt={screenshots[active].desc}
                className="w-full transition-opacity duration-300"
              />
            </div>
          </div>
          <p className="text-center text-nest-400 text-sm mt-4">{screenshots[active].desc}</p>
        </motion.div>
      </div>
    </section>
  )
}

// --- APP STORE SECTION ---
const appCategories = [
  {
    name: 'Media',
    apps: [
      { name: 'Plex', desc: 'Stream your media library' },
      { name: 'Jellyfin', desc: 'Open-source media server' },
      { name: 'Navidrome', desc: 'Music streaming' },
      { name: 'Audiobookshelf', desc: 'Audiobooks & podcasts' },
      { name: 'Tautulli', desc: 'Plex stats' },
      { name: 'Overseerr', desc: 'Media requests (Plex)' },
      { name: 'Jellyseerr', desc: 'Media requests (Jellyfin)' },
      { name: 'Tdarr', desc: 'Transcoding & health checks' },
    ],
  },
  {
    name: 'Downloads',
    apps: [
      { name: 'Radarr', desc: 'Movie management' },
      { name: 'Sonarr', desc: 'TV series management' },
      { name: 'qBittorrent', desc: 'Torrent client' },
      { name: 'Prowlarr', desc: 'Indexer management' },
      { name: 'Bazarr', desc: 'Subtitle automation' },
      { name: 'SABnzbd', desc: 'Usenet downloader' },
      { name: 'NZBGet', desc: 'Lightweight Usenet' },
      { name: 'NZBHydra2', desc: 'Usenet meta search' },
    ],
  },
  {
    name: 'Cloud & Productivity',
    apps: [
      { name: 'Nextcloud', desc: 'Files, calendar, contacts' },
      { name: 'Immich', desc: 'Photo & video backup' },
      { name: 'Paperless-ngx', desc: 'Document management' },
      { name: 'FileBrowser', desc: 'Web file manager' },
      { name: 'Syncthing', desc: 'P2P file sync' },
      { name: 'Vaultwarden', desc: 'Password manager' },
      { name: 'Mealie', desc: 'Recipe & meal planning' },
      { name: 'Homepage', desc: 'Services dashboard' },
    ],
  },
  {
    name: 'Network & Security',
    apps: [
      { name: 'Pi-hole', desc: 'Network ad blocker' },
      { name: 'AdGuard Home', desc: 'DNS ad blocking' },
      { name: 'Nginx Proxy Manager', desc: 'Reverse proxy + SSL' },
      { name: 'WireGuard', desc: 'VPN tunnel' },
      { name: 'Tailscale', desc: 'Mesh VPN' },
    ],
  },
  {
    name: 'Monitoring',
    apps: [
      { name: 'Grafana', desc: 'Dashboards & metrics' },
      { name: 'Uptime Kuma', desc: 'Uptime monitoring' },
      { name: 'Portainer', desc: 'Docker management' },
      { name: 'Dozzle', desc: 'Live Docker logs' },
    ],
  },
  {
    name: 'Automation',
    apps: [
      { name: 'Home Assistant', desc: 'Home automation' },
      { name: 'Node-RED', desc: 'Flow-based automation' },
      { name: 'Mosquitto MQTT', desc: 'MQTT broker' },
      { name: 'n8n', desc: 'Workflow automation' },
    ],
  },
  {
    name: 'Development',
    apps: [
      { name: 'Gitea', desc: 'Self-hosted Git' },
      { name: 'VS Code Server', desc: 'VS Code in browser' },
    ],
  },
]

function AppStore() {
  return (
    <section id="apps" className="py-32 bg-nest-800/30">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
          <motion.h2 variants={fadeUp} className="text-4xl lg:text-5xl font-bold mb-4">
            ~40 apps. <span className="gradient-text">Actually pre-configured.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400 max-w-2xl mx-auto">
            Not just a list of Docker containers. These are templates that set up networking, storage paths, and inter-app connections for you.
          </motion.p>
          <p className="text-sm text-nest-500 mt-2">Media, torrents, Usenet, cloud storage, smart home, dev tools</p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appCategories.map((cat, i) => (
            <motion.div key={i} variants={fadeUp} className="space-y-3">
              <h3 className="text-sm font-semibold text-accent-400 uppercase tracking-wider mb-4">{cat.name}</h3>
              {cat.apps.map((app, j) => (
                <div key={j} className="glass rounded-xl p-4 flex items-center gap-3 hover:border-accent-500/30 transition cursor-pointer group">
                  <div className="w-10 h-10 rounded-lg bg-accent-500/15 flex items-center justify-center shrink-0">
                    <Box size={18} className="text-accent-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{app.name}</div>
                    <div className="text-xs text-nest-400 truncate">{app.desc}</div>
                  </div>
                  <ArrowRight size={14} className="ml-auto text-nest-500 group-hover:text-accent-400 transition shrink-0" />
                </div>
              ))}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// --- COMPARISON ---
function Comparison() {
  const rows = [
    { feature: 'Price', truenas: 'Free', omv: 'Free', hexos: '$200', unraid: '$60-130', proxnest: 'Free + $5/mo Pro' },
    { feature: 'Base', truenas: 'FreeBSD/Linux', omv: 'Debian', hexos: 'TrueNAS', unraid: 'Custom Linux', proxnest: 'Proxmox VE' },
    { feature: 'Focus', truenas: 'Storage/NAS', omv: 'Simple NAS', hexos: 'Home server', unraid: 'Home server', proxnest: 'App-first server', highlight: true },
    { feature: 'VMs', truenas: 'Bhyve (limited)', omv: 'No', hexos: 'Limited', unraid: 'Basic KVM', proxnest: 'Full KVM' },
    { feature: 'Containers', truenas: 'Jails/Docker', omv: 'Docker only', hexos: 'Docker', unraid: 'Docker', proxnest: 'Docker + LXC' },
    { feature: 'ZFS', truenas: 'Best in class ⭐', omv: 'Plugin', hexos: 'Via TrueNAS', unraid: 'Plugin', proxnest: 'Native' },
    { feature: 'App auto-config', truenas: 'No', omv: 'No', hexos: 'Some', unraid: 'No', proxnest: 'Yes', highlight: true },
    { feature: 'App count', truenas: '~30 charts', omv: 'BYO Docker', hexos: 'Limited', unraid: 'Community', proxnest: '~40 curated' },
    { feature: 'Open source', truenas: 'Yes', omv: 'Yes', hexos: 'No', unraid: 'Partial', proxnest: 'Core: yes' },
    { feature: 'Maturity', truenas: 'Stable ⭐', omv: 'Stable ⭐', hexos: 'Beta (delayed)', unraid: 'Stable', proxnest: 'Early access' },
  ]

  return (
    <section id="compare" className="py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
          <motion.h2 variants={fadeUp} className="text-4xl lg:text-5xl font-bold mb-4">
            Honest <span className="gradient-text">comparison.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400">
            Every tool has tradeoffs. Here are ours.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <div className="glass rounded-2xl overflow-hidden glow-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-nest-700">
                    <th className="text-left p-4 text-nest-400 font-medium text-sm">Feature</th>
                    <th className="text-center p-4 text-nest-400 font-medium text-sm">TrueNAS</th>
                    <th className="text-center p-4 text-nest-400 font-medium text-sm">OMV</th>
                    <th className="text-center p-4 text-nest-400 font-medium text-sm">Hexos</th>
                    <th className="text-center p-4 text-nest-400 font-medium text-sm">Unraid</th>
                    <th className="text-center p-4 font-medium text-accent-400 text-sm">ProxNest</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-b border-nest-700/50 ${row.highlight ? 'bg-accent-500/5' : ''}`}>
                      <td className="p-4 text-sm font-medium">{row.feature}</td>
                      <td className="p-4 text-sm text-center text-nest-400">{row.truenas}</td>
                      <td className="p-4 text-sm text-center text-nest-400">{row.omv}</td>
                      <td className="p-4 text-sm text-center text-nest-400">{row.hexos}</td>
                      <td className="p-4 text-sm text-center text-nest-400">{row.unraid}</td>
                      <td className="p-4 text-sm text-center font-medium text-white">{row.proxnest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Why not just use X? */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="mt-20">
          <motion.h3 variants={fadeUp} className="text-3xl font-bold mb-10 text-center">
            "Why not just use X?"
          </motion.h3>
          <motion.div variants={fadeUp} className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="glass rounded-2xl p-6">
              <h4 className="text-lg font-semibold mb-3 text-accent-400">Why not TrueNAS?</h4>
              <p className="text-nest-400 text-sm leading-relaxed">
                TrueNAS is incredible for storage. If your main goal is ZFS pool management, replication, and enterprise-grade data integrity, use TrueNAS. Seriously. But if you want to run Plex + Radarr + Sonarr, you're fighting the app ecosystem. Docker support on TrueNAS SCALE works, but it's not the focus. ProxNest is app-first, storage-second.
              </p>
            </div>
            <div className="glass rounded-2xl p-6">
              <h4 className="text-lg font-semibold mb-3 text-accent-400">Why not Unraid?</h4>
              <p className="text-nest-400 text-sm leading-relaxed">
                Unraid is polished and has a great community app store. The downsides: it costs $60-130, it's closed source, and it has no native ZFS. If you're fine with that, Unraid is solid. ProxNest is free, open source, and gives you real Proxmox VMs and ZFS underneath.
              </p>
            </div>
            <div className="glass rounded-2xl p-6">
              <h4 className="text-lg font-semibold mb-3 text-accent-400">Why not plain Proxmox?</h4>
              <p className="text-nest-400 text-sm leading-relaxed">
                ProxNest IS Proxmox. Every Proxmox feature still works. We add a dashboard, an app store with auto-configuration, and a storage wizard on top. If you already know Proxmox well, you might not need us. ProxNest is for people who want Proxmox's power without spending a weekend on the wiki.
              </p>
            </div>
            <div className="glass rounded-2xl p-6">
              <h4 className="text-lg font-semibold mb-3 text-accent-400">Why not OMV?</h4>
              <p className="text-nest-400 text-sm leading-relaxed">
                OpenMediaVault is great if you just need a simple NAS with Docker. It's stable and lightweight. But there are no VMs, no LXC containers, and no auto-config between apps. If Docker Compose is enough for you, OMV is a fine choice. ProxNest is for when you want more.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// --- PRICING ---
function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      desc: 'The full local experience. No tricks.',
      features: [
        'Local dashboard',
        'All app installs',
        'Auto-wiring between apps',
        'Storage wizard',
        'One-click backups',
        'Web terminal',
        'Post-install guides',
        'Community Discord',
      ],
      cta: 'Download Free',
      primary: false,
    },
    {
      name: 'Pro',
      price: '$5',
      period: '/month',
      annual: '$50/year (save 17%)',
      desc: 'Remote access and management extras.',
      features: [
        'Everything in Free',
        'Cloud dashboard (manage from anywhere)',
        'Mobile web terminal',
        'Multi-user accounts',
        'One-click app updates',
        'Health monitoring + alerts',
        'Auto-generated Homepage dashboard',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      primary: true,
    },
  ]

  return (
    <section id="pricing" className="py-32 bg-nest-800/30">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
          <motion.h2 variants={fadeUp} className="text-4xl lg:text-5xl font-bold mb-4">
            Straightforward <span className="gradient-text">pricing.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400">
            Free tier has no limits on apps or features. Pro adds remote access.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div key={i} variants={fadeUp}
              className={`rounded-2xl p-8 ${plan.primary
                ? 'bg-gradient-to-b from-accent-500/20 to-accent-500/5 border-2 border-accent-500/40 relative'
                : 'glass'
              }`}
            >
              {plan.primary && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent-500 rounded-full text-xs font-semibold">
                  Most Popular
                </div>
              )}
              <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-nest-400">{plan.period}</span>
              </div>
              {plan.annual && <div className="text-sm text-accent-300 mb-3">{plan.annual}</div>}
              <p className="text-nest-400 mb-6">{plan.desc}</p>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm">
                    <Check size={16} className="text-green-400 shrink-0" />
                    <span className="text-nest-200">{f}</span>
                  </li>
                ))}
              </ul>
              <a href="#install" className={`block text-center py-3 rounded-xl font-semibold transition ${
                plan.primary
                  ? 'bg-accent-500 hover:bg-accent-600 shadow-lg shadow-accent-500/25'
                  : 'border border-nest-600 hover:border-nest-500 text-nest-200'
              }`}>
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// --- INSTALL ---
function CTA() {
  const [copied, setCopied] = useState(false)
  const installCmd = 'curl -fsSL https://proxnest.com/install.sh | bash'

  const copyCmd = () => {
    navigator.clipboard.writeText(installCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="install" className="py-32">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-4xl lg:text-5xl font-bold mb-6">
            Try it. Takes 60 seconds.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400 mb-8 max-w-2xl mx-auto">
            Run one command on an existing Proxmox host. Or grab the ISO for a fresh install.
          </motion.p>
          <motion.div variants={fadeUp} className="max-w-2xl mx-auto mb-8">
            <div
              onClick={copyCmd}
              className="bg-nest-900 border border-nest-700 rounded-xl p-5 flex items-center justify-between cursor-pointer hover:border-accent-500/50 transition group"
            >
              <div className="flex items-center gap-3">
                <Terminal size={18} className="text-accent-400" />
                <code className="text-accent-300 text-sm sm:text-base font-mono">{installCmd}</code>
              </div>
              <span className="text-nest-500 group-hover:text-accent-400 transition text-sm shrink-0 ml-4">
                {copied ? '✓ Copied!' : 'Copy'}
              </span>
            </div>
          </motion.div>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://github.com/proxnest-os/proxnest/releases/download/v0.4.0/proxnest-0.4.0.iso" className="px-8 py-3.5 bg-accent-500 hover:bg-accent-600 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2 shadow-lg shadow-accent-500/25">
              ⬇️ Download ISO (1.5 GB)
            </a>
            <a href="https://github.com/proxnest-os/proxnest" target="_blank" rel="noopener noreferrer" className="px-8 py-3.5 border border-nest-600 hover:border-nest-500 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2 text-nest-200">
              <Github size={20} /> Source on GitHub
            </a>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-nest-400 text-sm">
            <span className="flex items-center gap-2"><Star size={14} className="text-amber-400" /> AGPLv3 licensed</span>
            <span className="hidden sm:block">·</span>
            <span className="flex items-center gap-2"><Shield size={14} className="text-green-400" /> Runs locally. No cloud needed.</span>
            <span className="hidden sm:block">·</span>
            <span className="flex items-center gap-2"><Zap size={14} className="text-yellow-400" /> Proxmox VE 7+ / 8+</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// --- FOOTER ---
function Footer() {
  return (
    <footer className="border-t border-nest-700/50 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
                <Server size={18} className="text-white" />
              </div>
              <span className="text-lg font-bold">Prox<span className="text-accent-400">Nest</span></span>
            </div>
            <p className="text-sm text-nest-400">An app-first home server OS. Proxmox underneath, friendly dashboard on top.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Product</h4>
            <ul className="space-y-2 text-sm text-nest-400">
              <li><a href="#features" className="hover:text-white transition">Features</a></li>
              <li><a href="#apps" className="hover:text-white transition">Apps</a></li>
              <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
              <li><a href="https://github.com/proxnest-os/proxnest#readme" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Docs</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Community</h4>
            <ul className="space-y-2 text-sm text-nest-400">
              <li><a href="https://github.com/proxnest-os/proxnest" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub</a></li>
              <li><a href="https://discord.gg/b4NGUMYU34" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-1.5"><MessageCircle size={14} className="text-[#5865F2]" /> Discord</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-nest-400">
              <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition">License (AGPLv3)</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-nest-700/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-nest-500">&copy; 2026 ProxNest</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/proxnest-os/proxnest" target="_blank" rel="noopener noreferrer" className="text-nest-500 hover:text-white transition"><Github size={18} /></a>
            <a href="https://discord.gg/b4NGUMYU34" target="_blank" rel="noopener noreferrer" className="text-nest-500 hover:text-[#5865F2] transition"><MessageCircle size={18} /></a>
            <a href="#" className="text-nest-500 hover:text-white transition"><Twitter size={18} /></a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// --- MAIN APP ---
export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <Screenshots />
      <AppStore />
      <Comparison />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}
