import { useRef, useState } from 'react';
import { FileText, MoreVertical, Edit2, Play, Download, Trash2, Loader2, FileDown, Copy, Type } from 'lucide-react';
import { DropdownPortal } from './DropdownPortal';
import type { PresentationRow } from '../lib/presentationStore';

interface Props {
  presentation: PresentationRow;
  onOpen: (id: string) => void;
  onPresent: (id: string) => void;
  onDownload: (id: string, format: 'pptx' | 'pdf') => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  busy?: boolean;
}

export function PresentationCard({ presentation: p, onOpen, onPresent, onDownload, onDelete, onRename, onDuplicate, busy }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(p.title);
  const dotRef = useRef<HTMLButtonElement>(null);

  const closeAll = () => { setMenuOpen(false); setDownloadOpen(false); };

  const commitRename = () => {
    const title = renameValue.trim();
    setRenaming(false);
    if (title && title !== p.title) onRename(p.id, title);
    else setRenameValue(p.title);
  };

  return (
    <div className="group glass rounded-2xl p-4 border border-white/60 dark:border-slate-800/60 hover:shadow-card hover:-translate-y-1 transition-all relative">
      <button
        onClick={() => onOpen(p.id)}
        className="w-full text-left"
      >
        <div className="aspect-video rounded-lg bg-slate-100 dark:bg-slate-800 mb-3 flex items-center justify-center overflow-hidden">
          {p.thumbnail ? (
            <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-700" />
          )}
        </div>
      </button>

      <div className="flex items-start justify-between gap-2 mb-1">
        {renaming ? (
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenaming(false); setRenameValue(p.title); } }}
            autoFocus
            className="flex-1 min-w-0 rounded-lg border border-brand-400 px-2 py-1 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        ) : (
          <h3
            onClick={() => onOpen(p.id)}
            className="font-medium text-sm text-slate-900 dark:text-white truncate cursor-pointer hover:text-brand-600 dark:hover:text-brand-400 transition flex-1"
          >
            {p.title}
          </h3>
        )}
        <button
          ref={dotRef}
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
          title="More actions"
          aria-label="More actions"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        {p.total_slides} slides · {new Date(p.updated_at).toLocaleDateString()}
      </p>

      <DropdownPortal
        open={menuOpen}
        onClose={closeAll}
        anchorRef={dotRef}
        placement="bottom-end"
        width={200}
      >
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1.5 overflow-hidden">
          <MenuItem icon={<Edit2 className="w-4 h-4" />} label="Edit" onClick={() => { closeAll(); onOpen(p.id); }} />
          <MenuItem icon={<Play className="w-4 h-4" />} label="Present" onClick={() => { closeAll(); onPresent(p.id); }} />
          <MenuItem icon={<Type className="w-4 h-4" />} label="Rename" onClick={() => { closeAll(); setRenameValue(p.title); setRenaming(true); }} />
          <MenuItem icon={<Copy className="w-4 h-4" />} label="Duplicate" onClick={() => { closeAll(); onDuplicate(p.id); }} />
          <MenuItem
            icon={<Download className="w-4 h-4" />}
            label="Download"
            onClick={() => { setDownloadOpen(true); }}
            hasSubmenu
          />
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <MenuItem
            icon={<Trash2 className="w-4 h-4" />}
            label="Delete"
            danger
            onClick={() => { closeAll(); setConfirmDelete(true); }}
          />
        </div>
      </DropdownPortal>

      {downloadOpen && (
        <DropdownPortal
          open={downloadOpen}
          onClose={() => setDownloadOpen(false)}
          anchorRef={dotRef}
          placement="bottom-end"
          width={200}
        >
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1.5">
            <div className="px-3 py-1.5 text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <FileDown className="w-3.5 h-3.5" /> Download
            </div>
            <MenuItem
              icon={<FileDown className="w-4 h-4" />}
              label="Download PPTX"
              onClick={() => { setDownloadOpen(false); setMenuOpen(false); onDownload(p.id, 'pptx'); }}
            />
            <MenuItem
              icon={<FileDown className="w-4 h-4" />}
              label="Download PDF"
              onClick={() => { setDownloadOpen(false); setMenuOpen(false); onDownload(p.id, 'pdf'); }}
            />
          </div>
        </DropdownPortal>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40">
          <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-2xl max-w-sm w-full p-6">
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Delete presentation?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete this presentation? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmDelete(false); setMenuOpen(false); onDelete(p.id); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon, label, onClick, danger, hasSubmenu,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  hasSubmenu?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition text-left ${
        danger
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {hasSubmenu && <span className="text-slate-300 dark:text-slate-600 text-xs">›</span>}
    </button>
  );
}
