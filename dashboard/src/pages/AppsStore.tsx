import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { apps } from '@/lib/api';
import { Search, Download, ExternalLink, Check } from 'lucide-react';
import { clsx } from 'clsx';
import type { AppTemplate, AppCategory } from '@/types/api';

function AppCard({
  template,
  onInstall,
  installing,
}: {
  template: AppTemplate;
  onInstall: (id: string) => void;
  installing: string | null;
}) {
  const isInstalling = installing === template.id;

  return (
    <div className="glass rounded-xl p-5 glow-border glass-hover transition-all group">
      <div className="flex items-start gap-4">
        <span className="text-3xl">{template.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{template.name}</h3>
          <p className="text-xs text-nest-400 mt-1 line-clamp-2">{template.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-nest-800/80 text-nest-300 uppercase">
          {template.type}
        </span>
        {template.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-nest-800/50 text-nest-500">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={() => onInstall(template.id)}
          disabled={isInstalling}
          className={clsx(
            'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
            isInstalling
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-nest-500/15 text-nest-300 hover:bg-nest-500/25',
          )}
        >
          {isInstalling ? (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
              Installing...
            </>
          ) : (
            <>
              <Download size={12} />
              Install
            </>
          )}
        </button>
        {template.website && (
          <a
            href={template.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-nest-800/50 text-nest-400 hover:text-white transition-colors"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

export function AppsStorePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const { data, loading } = useApi(
    () => apps.store({ category: category || undefined, search: search || undefined }),
    [category, search],
  );

  const templates = (data as { templates: AppTemplate[]; categories: AppCategory[] } | null)?.templates || [];
  const categories = (data as { templates: AppTemplate[]; categories: AppCategory[] } | null)?.categories || [];

  const handleInstall = async (templateId: string) => {
    setInstalling(templateId);
    try {
      await apps.install(templateId);
      setInstalled((prev) => new Set(prev).add(templateId));
    } catch (err) {
      console.error('Install failed:', err);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nest-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCategory(null); }}
            className="w-full rounded-lg border border-nest-400/10 bg-nest-900/50 pl-10 pr-4 py-2.5 text-sm text-white
              placeholder-nest-500 focus:border-nest-400/30 focus:outline-none focus:ring-1 focus:ring-nest-400/20"
            placeholder="Search apps..."
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setCategory(null); setSearch(''); }}
            className={clsx(
              'px-3 py-2 rounded-lg text-xs font-medium transition-colors',
              !category ? 'bg-nest-500/15 text-nest-300' : 'text-nest-400 hover:text-white',
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setCategory(cat.id); setSearch(''); }}
              className={clsx(
                'px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                category === cat.id ? 'bg-nest-500/15 text-nest-300' : 'text-nest-400 hover:text-white',
              )}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
        </div>
      ) : templates.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-nest-400 text-sm">
          No apps found. Try a different search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {templates.map((t) => (
            <AppCard
              key={t.id}
              template={t}
              onInstall={handleInstall}
              installing={installing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
