import { useEffect, useState } from 'react';
import { FileText, Plus, Search, Loader2 } from 'lucide-react';
import { listPresentations, renamePresentation, duplicatePresentation, type PresentationRow } from '../lib/presentationStore';
import { PresentationCard } from './PresentationCard';
import type { NavPage } from './Navbar';

interface Props {
  onNavigate: (page: NavPage) => void;
  onOpenPresentation: (id: string) => void;
  onPresent: (id: string) => void;
  onDownload: (id: string, format: 'pptx' | 'pdf') => void;
  onDelete: (id: string) => void;
  downloadLoading: string | null;
}

export function MyPresentations({ onNavigate, onOpenPresentation, onPresent, onDownload, onDelete, downloadLoading }: Props) {
  const [presentations, setPresentations] = useState<PresentationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await listPresentations();
    setPresentations(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await onDelete(id);
    await load();
  };

  const handleRename = async (id: string, title: string) => {
    await renamePresentation(id, title);
    await load();
  };

  const handleDuplicate = async (id: string) => {
    await duplicatePresentation(id);
    await load();
  };

  const filtered = presentations.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen mesh-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">My Presentations</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{presentations.length} presentation{presentations.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => onNavigate('create')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-500 text-white text-sm font-medium shadow-glow hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-4 h-4" /> New Presentation
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search presentations..."
            className="w-full sm:max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
          />
        </div>

        {loading ? (
          <div className="glass rounded-2xl p-12 text-center text-slate-400 border border-white/60 dark:border-slate-800/60">
            <Loader2 className="w-8 h-8 mx-auto animate-spin mb-3" />
            Loading presentations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-white/60 dark:border-slate-800/60">
            <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {search ? 'No presentations match your search' : 'No presentations yet'}
            </p>
            {!search && (
              <button
                onClick={() => onNavigate('create')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-indigo-500 text-white text-sm font-medium shadow-glow hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Create your first presentation
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <PresentationCard
                key={p.id}
                presentation={p}
                onOpen={onOpenPresentation}
                onPresent={onPresent}
                onDownload={onDownload}
                onDelete={handleDelete}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                busy={downloadLoading === p.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
