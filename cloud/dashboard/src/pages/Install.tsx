/**
 * ProxNest Install Page
 * Public page showing install instructions and the curl command.
 * Accessible at /install for browser visitors.
 */

import { useState } from 'react';
import { Copy, Check, Terminal, Shield, Server, Download, ArrowRight } from 'lucide-react';

const INSTALL_CMD = 'curl -sSL https://proxnest.com/install.sh | bash';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-sm transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-green-400" />
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function InstallPage() {
  return (
    <div className="min-h-screen bg-nest-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center">
              <Server className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold">ProxNest</span>
          </a>
          <a
            href="/login"
            className="text-sm text-nest-300 hover:text-white transition-colors"
          >
            Sign in to Dashboard →
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-sm mb-6">
            <Download className="w-4 h-4" />
            One-line install
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Install ProxNest Agent
          </h1>
          <p className="text-lg text-nest-300 max-w-2xl mx-auto">
            Run this command on your Proxmox VE server to connect it to your
            ProxNest cloud dashboard. Takes about 2 minutes.
          </p>
        </div>

        {/* Install Command */}
        <div className="rounded-xl border border-white/10 bg-nest-900 p-6 mb-12">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-nest-400">
              <Terminal className="w-4 h-4" />
              <span>Run on your Proxmox server as root</span>
            </div>
            <CopyButton text={INSTALL_CMD} />
          </div>
          <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
            <span className="text-green-400">root@proxmox</span>
            <span className="text-nest-400">:</span>
            <span className="text-blue-400">~</span>
            <span className="text-nest-400"># </span>
            <span className="text-white">{INSTALL_CMD}</span>
          </div>
        </div>

        {/* What it does */}
        <h2 className="text-2xl font-semibold mb-6">What the installer does</h2>
        <div className="grid gap-4 sm:grid-cols-2 mb-12">
          {[
            {
              icon: '📦',
              title: 'Installs Node.js 22 LTS',
              desc: 'Via NodeSource — skipped if already present.',
            },
            {
              icon: '🐳',
              title: 'Installs Docker CE',
              desc: 'Optional — needed for one-click app installs.',
            },
            {
              icon: '🔧',
              title: 'Sets up ProxNest agent',
              desc: 'Clones from GitHub, builds, creates systemd service.',
            },
            {
              icon: '🔐',
              title: 'Generates secure config',
              desc: 'JWT secret, agent identity, claim token for pairing.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-white/10 bg-nest-900/50 p-5"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="font-medium mb-1">{item.title}</h3>
              <p className="text-sm text-nest-400">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <h2 className="text-2xl font-semibold mb-6">Getting started</h2>
        <div className="space-y-4 mb-12">
          {[
            {
              step: 1,
              title: 'Run the install command',
              desc: 'SSH into your Proxmox server and run the curl command above.',
            },
            {
              step: 2,
              title: 'Save your claim token',
              desc: 'The installer prints a claim token at the end. Copy it.',
            },
            {
              step: 3,
              title: 'Add server to dashboard',
              desc: 'Sign in at cloud.proxnest.com, click "Add Server", paste the token.',
            },
            {
              step: 4,
              title: 'Manage everything from the cloud',
              desc: 'VMs, containers, apps, storage, networking — all from one dashboard.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex items-start gap-4 rounded-lg border border-white/10 bg-nest-900/50 p-5"
            >
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-semibold text-sm">
                {item.step}
              </div>
              <div>
                <h3 className="font-medium mb-1">{item.title}</h3>
                <p className="text-sm text-nest-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Requirements */}
        <h2 className="text-2xl font-semibold mb-6">Requirements</h2>
        <div className="rounded-lg border border-white/10 bg-nest-900/50 p-6 mb-12">
          <ul className="space-y-3 text-sm">
            {[
              'Proxmox VE 7.0+ (Debian/Ubuntu-based host also works)',
              'Root access (SSH)',
              'Internet connection for package downloads',
              '500MB free disk space',
              'x86_64 or aarch64 architecture',
            ].map((req) => (
              <li key={req} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span className="text-nest-200">{req}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Security Note */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5 mb-12">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-200 mb-1">Security note</h3>
              <p className="text-sm text-amber-200/70">
                We recommend reviewing the install script before running it.
                Download it first with{' '}
                <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300">
                  curl -sSL https://proxnest.com/install.sh -o install.sh
                </code>{' '}
                then inspect and run with{' '}
                <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300">
                  bash install.sh
                </code>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Uninstall */}
        <h2 className="text-2xl font-semibold mb-4">Uninstall</h2>
        <div className="rounded-xl border border-white/10 bg-nest-900 p-5 mb-12">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-nest-400">Remove ProxNest agent</span>
            <CopyButton text="curl -sSL https://proxnest.com/install.sh | bash -s -- --uninstall" />
          </div>
          <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
            <span className="text-nest-400">$ </span>
            <span className="text-white">
              curl -sSL https://proxnest.com/install.sh | bash -s -- --uninstall
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <a
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-nest-950 font-semibold transition-colors"
          >
            Create Free Account
            <ArrowRight className="w-4 h-4" />
          </a>
          <p className="text-sm text-nest-400 mt-3">
            Free for up to 3 servers. No credit card required.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-nest-500">
        <p>ProxNest — Open Source Home Server OS for Proxmox VE</p>
      </footer>
    </div>
  );
}
