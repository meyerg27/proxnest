import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Server, Shield, Zap, HardDrive, Layout, Users,
  ChevronRight, Check, ArrowRight, Menu, X, Github, Twitter,
  Cpu, Globe, Box, Download,
  Terminal, Gauge, Star
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
          <a href="#apps" className="text-nest-300 hover:text-white transition">App Store</a>
          <a href="#pricing" className="text-nest-300 hover:text-white transition">Pricing</a>
          <a href="#compare" className="text-nest-300 hover:text-white transition">Compare</a>
          <a href="https://cloud.proxnest.com" className="text-nest-300 hover:text-white transition">
            Cloud Dashboard
          </a>
          <a href="https://cloud.proxnest.com/login" className="px-4 py-2 border border-nest-600 hover:border-accent-500 rounded-lg font-medium transition">
            Login
          </a>
          <a href="#install" className="px-5 py-2 bg-accent-500 hover:bg-accent-600 rounded-lg font-medium transition">
            Install Now
          </a>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden px-6 pb-6 flex flex-col gap-4">
          <a href="#features" className="text-nest-300" onClick={() => setOpen(false)}>Features</a>
          <a href="#apps" className="text-nest-300" onClick={() => setOpen(false)}>App Store</a>
          <a href="#pricing" className="text-nest-300" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#compare" className="text-nest-300" onClick={() => setOpen(false)}>Compare</a>
          <a href="https://cloud.proxnest.com/login" className="px-5 py-2 border border-nest-600 rounded-lg font-medium text-center" onClick={() => setOpen(false)}>Login</a>
          <a href="#install" className="px-5 py-2 bg-accent-500 rounded-lg font-medium text-center" onClick={() => setOpen(false)}>Install Now</a>
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
            <Zap size={14} /> Now in early access
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-5xl lg:text-7xl font-bold leading-tight mb-6">
            Your server,<br />
            <span className="gradient-text">your rules.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-xl text-nest-300 mb-8 max-w-lg">
            Install one ISO. Click "Media Server." Watch 6 apps install, auto-configure, and connect themselves. Your Netflix replacement is ready in 5 minutes.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
            <a href="#install" className="px-8 py-3.5 bg-accent-500 hover:bg-accent-600 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2 shadow-lg shadow-accent-500/25">
              <Download size={20} /> Install Now
            </a>
            <a href="#features" className="px-8 py-3.5 border border-nest-600 hover:border-nest-500 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2 text-nest-200">
              See Features <ChevronRight size={18} />
            </a>
          </motion.div>
          <motion.div variants={fadeUp} className="flex items-center gap-6 mt-8 text-sm text-nest-400">
            <span className="flex items-center gap-1.5"><Check size={14} className="text-green-400" /> Free forever tier</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-green-400" /> No cloud required</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-green-400" /> Open source core</span>
          </motion.div>
        </motion.div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative"
        >
          <div className="glass rounded-2xl glow-border p-1">
            <div className="bg-nest-800 rounded-xl overflow-hidden">
              {/* Mock titlebar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-nest-700">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-nest-400">proxnest.local — Dashboard</span>
              </div>
              {/* Mock dashboard content */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">System Overview</h3>
                  <span className="text-xs text-green-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> All systems healthy</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'CPU', value: '23%', icon: Cpu, color: 'text-accent-400' },
                    { label: 'RAM', value: '8.2 / 32 GB', icon: Gauge, color: 'text-green-400' },
                    { label: 'Storage', value: '2.1 / 12 TB', icon: HardDrive, color: 'text-amber-400' },
                    { label: 'Network', value: '↓ 45 MB/s', icon: Globe, color: 'text-rose-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-nest-700/50 rounded-lg p-3 text-center">
                      <s.icon size={18} className={`mx-auto mb-1 ${s.color}`} />
                      <div className="text-xs text-nest-400">{s.label}</div>
                      <div className="text-sm font-medium">{s.value}</div>
                    </div>
                  ))}
                </div>
                {/* Mock app grid */}
                <div>
                  <h4 className="text-sm font-medium text-nest-300 mb-2">Running Apps</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {['Plex', 'Radarr', 'Sonarr', 'Nextcloud', 'Pi-hole'].map(app => (
                      <div key={app} className="bg-nest-700/30 rounded-lg p-2 text-center">
                        <div className="w-8 h-8 mx-auto mb-1 rounded-lg bg-accent-500/20 flex items-center justify-center">
                          <Box size={14} className="text-accent-400" />
                        </div>
                        <span className="text-xs text-nest-300">{app}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
    title: 'One-Click App Stacks',
    desc: 'Install an entire media server (Jellyfin + Radarr + Sonarr + qBit + Prowlarr + Bazarr) with one click. Apps auto-configure each other — zero manual setup.',
    color: 'bg-accent-500/15 text-accent-400',
  },
  {
    icon: HardDrive,
    title: 'Storage Wizard',
    desc: 'Detect disks, mount drives, and assign roles (media, downloads, backups) through a guided UI. ZFS, ext4, USB — all managed visually.',
    color: 'bg-green-500/15 text-green-400',
  },
  {
    icon: Layout,
    title: 'Cloud Dashboard',
    desc: 'Manage your server from anywhere — phone, laptop, work. Real-time stats, web terminal, app management, all through a secure cloud portal.',
    color: 'bg-amber-400/15 text-amber-400',
  },
  {
    icon: Shield,
    title: 'Local-First, Cloud-Assisted',
    desc: 'Everything runs on your hardware. The cloud portal is optional — for remote access only. Your data never leaves your network. VPN built-in for torrents.',
    color: 'bg-rose-400/15 text-rose-400',
  },
  {
    icon: Terminal,
    title: 'Web Terminal & Auto-Wire',
    desc: 'Full shell access from your browser. Apps automatically connect to each other on install — Radarr finds qBit, Prowlarr syncs indexers, no config files needed.',
    color: 'bg-purple-400/15 text-purple-400',
  },
  {
    icon: Users,
    title: 'Backups & Smart Guides',
    desc: 'One-click backup and restore of all app configs. Post-install guides tell you exactly what to do next. Smart recommendations suggest what to install.',
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
            Everything you need.<br /><span className="gradient-text">Nothing you don't.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400 max-w-2xl mx-auto">
            ProxNest wraps the power of Proxmox in an interface anyone can use. Enterprise-grade infrastructure, consumer-grade simplicity.
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

// --- APP STORE SECTION ---
const appCategories = [
  {
    name: 'Media',
    apps: [
      { name: 'Plex', desc: 'Stream your media library' },
      { name: 'Jellyfin', desc: 'Open-source media server' },
      { name: 'Navidrome', desc: 'Music streaming server' },
    ],
  },
  {
    name: 'Downloads',
    apps: [
      { name: 'Radarr', desc: 'Movie collection manager' },
      { name: 'Sonarr', desc: 'TV series manager' },
      { name: 'qBittorrent', desc: 'Torrent client' },
    ],
  },
  {
    name: 'Cloud',
    apps: [
      { name: 'Nextcloud', desc: 'Files, calendar, contacts' },
      { name: 'Immich', desc: 'Photo & video backup' },
      { name: 'Paperless-ngx', desc: 'Document management' },
    ],
  },
  {
    name: 'Network',
    apps: [
      { name: 'Pi-hole', desc: 'Network-wide ad blocker' },
      { name: 'WireGuard', desc: 'Fast VPN tunnel' },
      { name: 'Tailscale', desc: 'Zero-config mesh VPN' },
    ],
  },
]

function AppStore() {
  return (
    <section id="apps" className="py-32 bg-nest-800/30">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
          <motion.h2 variants={fadeUp} className="text-4xl lg:text-5xl font-bold mb-4">
            50+ apps. <span className="gradient-text">One click.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400 max-w-2xl mx-auto">
            Pre-configured Docker and LXC templates. No YAML editing, no port conflicts, no headaches.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
    { feature: 'Price', hexos: '$200', unraid: '$60-130', proxnest: 'Free + $5/mo Pro', highlight: true },
    { feature: 'Base OS', hexos: 'TrueNAS', unraid: 'Custom Linux', proxnest: 'Proxmox VE' },
    { feature: 'Cloud Required', hexos: 'Yes ❌', unraid: 'No', proxnest: 'No ✅', highlight: true },
    { feature: 'Virtual Machines', hexos: 'Limited', unraid: 'Basic KVM', proxnest: 'Full KVM ✅' },
    { feature: 'Containers', hexos: 'Docker', unraid: 'Docker', proxnest: 'Docker + LXC ✅' },
    { feature: 'ZFS Support', hexos: 'Via TrueNAS', unraid: 'Plugin', proxnest: 'Native ✅' },
    { feature: 'App Store', hexos: 'Limited', unraid: 'Community', proxnest: '50+ curated ✅' },
    { feature: 'Open Source', hexos: 'No', unraid: 'Partial', proxnest: 'Core: yes ✅' },
    { feature: 'Status', hexos: 'Beta (delayed)', unraid: 'Stable', proxnest: 'Early Access' },
  ]

  return (
    <section id="compare" className="py-32">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-16">
          <motion.h2 variants={fadeUp} className="text-4xl lg:text-5xl font-bold mb-4">
            See how we <span className="gradient-text">stack up.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400">
            ProxNest gives you more for less. Period.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <div className="glass rounded-2xl overflow-hidden glow-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-nest-700">
                    <th className="text-left p-4 text-nest-400 font-medium">Feature</th>
                    <th className="text-center p-4 text-nest-400 font-medium">Hexos</th>
                    <th className="text-center p-4 text-nest-400 font-medium">Unraid</th>
                    <th className="text-center p-4 font-medium text-accent-400">ProxNest</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`border-b border-nest-700/50 ${row.highlight ? 'bg-accent-500/5' : ''}`}>
                      <td className="p-4 text-sm font-medium">{row.feature}</td>
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
      desc: 'Everything you need to get started.',
      features: [
        'Beautiful local dashboard',
        'Unlimited app installs',
        'Auto-wiring (apps configure each other)',
        'Storage wizard',
        'One-click backups',
        'Web terminal',
        'Post-install guides',
        'Community support',
      ],
      cta: 'Download Free',
      primary: false,
    },
    {
      name: 'Pro',
      price: '$5',
      period: '/month',
      annual: '$50/year (save 17%)',
      desc: 'For power users and families.',
      features: [
        'Everything in Free',
        'Cloud remote access (manage from anywhere)',
        'Web terminal from your phone',
        'Multi-user + family accounts',
        'Update manager (one-click app updates)',
        'Health monitoring + alerts',
        'Auto-generated Homepage dashboard',
        'Priority support + Discord',
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
            Simple, <span className="gradient-text">honest pricing.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400">
            No $200 license fees. No per-device charges. No gotchas.
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
            Install in 60 seconds.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-nest-400 mb-8 max-w-2xl mx-auto">
            One command on your existing Proxmox host — or download the ISO for a fresh install.
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
            <a href="https://dl.proxnest.com/proxnest-0.1.0.iso" className="px-8 py-3.5 bg-accent-500 hover:bg-accent-600 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2 shadow-lg shadow-accent-500/25">
              ⬇️ Download ISO (1.8 GB)
            </a>
            <a href="https://github.com/meyerg27/proxnest" target="_blank" rel="noopener noreferrer" className="px-8 py-3.5 border border-nest-600 hover:border-nest-500 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2 text-nest-200">
              <Github size={20} /> View on GitHub
            </a>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-nest-400 text-sm">
            <span className="flex items-center gap-2"><Star size={14} className="text-amber-400" /> Open source · AGPLv3</span>
            <span className="hidden sm:block">·</span>
            <span className="flex items-center gap-2"><Shield size={14} className="text-green-400" /> 100% local · No cloud required</span>
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
            <p className="text-sm text-nest-400">The home server OS that doesn't suck. Built on Proxmox, designed for humans.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Product</h4>
            <ul className="space-y-2 text-sm text-nest-400">
              <li><a href="#features" className="hover:text-white transition">Features</a></li>
              <li><a href="#apps" className="hover:text-white transition">App Store</a></li>
              <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
              <li><a href="https://github.com/meyerg27/proxnest#readme" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Documentation</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Community</h4>
            <ul className="space-y-2 text-sm text-nest-400">
              <li><a href="https://github.com/meyerg27/proxnest" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub</a></li>
              <li><a href="#early-access" className="hover:text-white transition">Discord (Coming Soon)</a></li>
              <li><a href="#early-access" className="hover:text-white transition">Reddit (Coming Soon)</a></li>
              <li><a href="#early-access" className="hover:text-white transition">Blog (Coming Soon)</a></li>
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
          <p className="text-sm text-nest-500">&copy; 2026 ProxNest. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/meyerg27/proxnest" target="_blank" rel="noopener noreferrer" className="text-nest-500 hover:text-white transition"><Github size={18} /></a>
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
      <AppStore />
      <Comparison />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}
