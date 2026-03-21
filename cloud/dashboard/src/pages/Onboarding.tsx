/**
 * ProxNest Cloud — Onboarding Page
 * Auto-discovery flow: Install → Scan → Name → Done
 */

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type DiscoveredServer } from '../lib/api';
import {
  Server, Copy, Check, Wifi, ArrowRight, Loader2,
  MonitorSmartphone, Cpu, MemoryStick, Search, Keyboard,
} from 'lucide-react';
import { clsx } from 'clsx';

type Step = 'install' | 'scanning' | 'found' | 'naming' | 'manual';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('install');
  const [found, setFound] = useState<DiscoveredServer | null>(null);
  const [serverName, setServerName] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [scanElapsed, setScanElapsed] = useState(0);
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const installCmd = 'curl -sSL https://install.proxnest.com | bash';

  // ─── Auto-discovery polling ────────────────────
  const startScanning = useCallback(() => {
    setStep('scanning');
    setScanElapsed(0);
    setError(null);

    // Elapsed timer
    elapsedTimer.current = setInterval(() => {
      setScanElapsed((prev) => prev + 1);
    }, 1000);

    // Discovery poll every 3 seconds
    const poll = async () => {
      try {
        const { servers } = await api.discoverServers();
        if (servers.length > 0) {
          setFound(servers[0]);
          setServerName(servers[0].hostname || 'My Server');
          setStep('found');
          stopScanning();
        }
      } catch {
        // Silently retry
      }
    };

    poll(); // immediate first check
    scanTimer.current = setInterval(poll, 3000);
  }, []);

  const stopScanning = useCallback(() => {
    if (scanTimer.current) { clearInterval(scanTimer.current); scanTimer.current = null; }
    if (elapsedTimer.current) { clearInterval(elapsedTimer.current); elapsedTimer.current = null; }
  }, []);

  useEffect(() => {
    return () => stopScanning();
  }, [stopScanning]);

  // After 30s show manual fallback
  const showManualFallback = scanElapsed >= 30 && step === 'scanning';

  // ─── Claim server ─────────────────────────────
  const handleClaim = async (serverId: number, name: string, claimToken?: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.claimServerById(serverId, name || 'My Server', claimToken);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim server');
    } finally {
      setLoading(false);
    }
  };

  // ─── Manual claim ─────────────────────────────
  const handleManualClaim = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.claimServer(manualCode.trim(), serverName || 'My Server');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid claim code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-nest-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl
            bg-gradient-to-br from-nest-500/20 to-nest-600/5 mb-4">
            <Server size={32} className="text-nest-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to ProxNest</h1>
          <p className="text-sm text-nest-400 mt-1">Connect your Proxmox server in seconds</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['install', 'scanning', 'naming'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={clsx(
                'h-2 w-2 rounded-full transition-colors',
                (step === 'install' && i === 0) ||
                (['scanning', 'found', 'manual'].includes(step) && i === 1) ||
                (step === 'naming' && i === 2)
                  ? 'bg-nest-400'
                  : 'bg-nest-700',
              )} />
              {i < 2 && <div className="w-8 h-px bg-nest-800" />}
            </div>
          ))}
        </div>

        {/* ─── Step 1: Install ─────────────────── */}
        {step === 'install' && (
          <div className="glass rounded-2xl p-8 glow-border space-y-6 text-center">
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Install the ProxNest Agent</h2>
              <p className="text-sm text-nest-400">
                Run this command on your Proxmox server to install the agent:
              </p>
            </div>

            <div className="glass rounded-xl p-4 flex items-center gap-3">
              <code className="flex-1 text-xs text-nest-300 font-mono break-all text-left">
                {installCmd}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 p-2 rounded-lg text-nest-400 hover:text-white hover:bg-nest-800 transition-colors"
                title="Copy command"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>

            <div className="text-xs text-nest-500">
              Or download the{' '}
              <a href="#" className="text-nest-400 hover:text-white underline underline-offset-2 transition-colors">
                ProxNest ISO
              </a>
            </div>

            <button
              onClick={startScanning}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                bg-gradient-to-r from-nest-500 to-nest-600 text-sm font-semibold text-white
                shadow-lg shadow-nest-500/20 hover:from-nest-400 hover:to-nest-500 transition-all"
            >
              I've already installed it
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ─── Step 2: Scanning ─────────────────── */}
        {(step === 'scanning' || step === 'manual') && (
          <div className="glass rounded-2xl p-8 glow-border space-y-6 text-center">
            {step === 'scanning' && (
              <>
                <div className="relative flex items-center justify-center h-32">
                  {/* Radar pulse animation */}
                  <div className="radar-pulse" />
                  <div className="radar-pulse radar-pulse-delay-1" />
                  <div className="radar-pulse radar-pulse-delay-2" />
                  <div className="relative z-10 h-12 w-12 rounded-full bg-nest-900 border border-nest-700
                    flex items-center justify-center">
                    <Search size={20} className="text-nest-400" />
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">
                    Searching your network...
                  </h2>
                  <p className="text-sm text-nest-400">
                    Looking for ProxNest servers on your network
                  </p>
                  <p className="text-xs text-nest-600 mt-2 font-mono">{scanElapsed}s</p>
                </div>

                {showManualFallback && (
                  <div className="space-y-3 pt-2">
                    <div className="h-px bg-nest-800" />
                    <p className="text-sm text-nest-400">Can't find your server?</p>
                    <button
                      onClick={() => setStep('manual')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                        text-nest-300 bg-nest-800/50 hover:bg-nest-800 transition-colors"
                    >
                      <Keyboard size={14} />
                      Enter claim code manually
                    </button>
                  </div>
                )}
              </>
            )}

            {step === 'manual' && (
              <form onSubmit={handleManualClaim} className="space-y-5 text-left">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-white mb-1">Enter Claim Code</h2>
                  <p className="text-sm text-nest-400">
                    Find the code displayed on your server's terminal
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-nest-300 mb-1.5">Claim Code</label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    required
                    placeholder="e.g. AB12CD34"
                    autoFocus
                    className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-3
                      text-sm text-white font-mono tracking-wider text-center uppercase
                      placeholder-nest-500
                      focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-nest-300 mb-1.5">
                    Server Name <span className="text-nest-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    placeholder="My Home Server"
                    className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-3
                      text-sm text-white placeholder-nest-500
                      focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep('scanning'); startScanning(); }}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium
                      text-nest-400 hover:text-white hover:bg-nest-800/50 transition-colors"
                  >
                    ← Back to scan
                  </button>
                  <button
                    type="submit"
                    disabled={loading || manualCode.trim().length < 6}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg
                      bg-gradient-to-r from-nest-500 to-nest-600 px-4 py-2.5
                      text-sm font-semibold text-white shadow-lg shadow-nest-500/20
                      hover:from-nest-400 hover:to-nest-500 transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Claim Server'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ─── Step 2b: Server Found ─────────────── */}
        {step === 'found' && found && (
          <div className="glass rounded-2xl p-8 glow-border space-y-6 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center
                ring-2 ring-emerald-500/20">
                <Wifi size={28} className="text-emerald-400" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white mb-1">
                🎉 Found your server!
              </h2>
              <p className="text-sm text-nest-400">
                ProxNest detected a server on your network
              </p>
            </div>

            <div className="glass rounded-xl p-4 space-y-2 text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/5
                  flex items-center justify-center">
                  <Server size={18} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {found.hostname || found.agent_id.slice(0, 12)}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400">Online</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-nest-400 pt-1">
                {found.os && (
                  <span className="flex items-center gap-1">
                    <MonitorSmartphone size={10} />
                    {found.os}
                  </span>
                )}
                {found.cpu_cores && (
                  <span className="flex items-center gap-1">
                    <Cpu size={10} />
                    {found.cpu_cores} cores
                  </span>
                )}
                {found.ram_total_mb && (
                  <span className="flex items-center gap-1">
                    <MemoryStick size={10} />
                    {(found.ram_total_mb / 1024).toFixed(0)} GB
                  </span>
                )}
                {found.proxmox_version && <span>PVE {found.proxmox_version}</span>}
              </div>
            </div>

            <button
              onClick={() => setStep('naming')}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                bg-gradient-to-r from-nest-500 to-nest-600 text-sm font-semibold text-white
                shadow-lg shadow-nest-500/20 hover:from-nest-400 hover:to-nest-500 transition-all"
            >
              Connect this server
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ─── Step 3: Name your server ─────────── */}
        {step === 'naming' && found && (
          <div className="glass rounded-2xl p-8 glow-border space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-white mb-1">Name your server</h2>
              <p className="text-sm text-nest-400">Give it a friendly name you'll recognize</p>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
                {error}
              </div>
            )}

            <div>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="e.g. Home Lab, Office Server"
                autoFocus
                className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 px-4 py-3
                  text-sm text-white placeholder-nest-500
                  focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleClaim(found.id, serverName);
                }}
              />
            </div>

            <button
              onClick={() => handleClaim(found.id, serverName)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                bg-gradient-to-r from-nest-500 to-nest-600 text-sm font-semibold text-white
                shadow-lg shadow-nest-500/20 hover:from-nest-400 hover:to-nest-500 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Finish Setup
                  <Check size={16} />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Radar pulse CSS */}
      <style>{`
        .radar-pulse {
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 1px solid rgba(var(--nest-rgb, 99, 102, 241), 0.3);
          animation: radar-expand 3s ease-out infinite;
        }
        .radar-pulse-delay-1 { animation-delay: 1s; }
        .radar-pulse-delay-2 { animation-delay: 2s; }
        @keyframes radar-expand {
          0% {
            transform: scale(0.3);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
