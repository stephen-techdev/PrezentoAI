import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Sliders,
  Mic, BookOpen, X, ListOrdered, Palette, Trash2, Plus,
} from 'lucide-react';
import type { PresentationSettings } from '../types';
import { detectContent } from '../lib/contentDetector';
import { THEME_LIST, BACKGROUND_STYLES, AUDIENCE_OPTIONS } from '../themes';

interface Props {
  settings: PresentationSettings;
  onChange: (s: PresentationSettings) => void;
  onGenerate: () => void;
  onBack: () => void;
  generating?: boolean;
}

interface OutlineSlide {
  title: string;
  bullets: string[];
}

// Gamma-style pipeline: 1 Content → 2 Outline (review/edit) → 3 Theme → Generate.
// The outline is derived from the prompt (Slide N blocks / lists) and is fully
// editable before generation; on Generate it is written back into the prompt
// so the arrange-only engine produces exactly what was reviewed.
export function SettingsPanel({ settings, onChange, onGenerate, onBack, generating }: Props) {
  const [open, setOpen] = useState<string>('outline');

  const update = (patch: Partial<PresentationSettings>) => onChange({ ...settings, ...patch });

  const sections = [
    { id: 'outline', label: 'Outline — review & edit slides', icon: ListOrdered },
    { id: 'theme', label: 'Theme — pick a look', icon: Palette },
    { id: 'options', label: 'Options', icon: Sliders },
  ];

  const handleGenerate = () => {
    onGenerate();
  };

  return (
    <div className="min-h-screen mesh-bg">
      {/* Top bar */}
      <div className="sticky top-0 z-30 glass-strong border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="w-4 h-4" /> Back
          </button>
          {/* Gamma-style step indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="px-2 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">1 Content ✓</span>
            <span>→</span>
            <span className="px-2 py-1 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">2 Outline</span>
            <span>→</span>
            <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">3 Theme</span>
          </div>
          <div className="font-display font-semibold text-sm sm:hidden">Configure</div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-indigo-500 text-white text-sm font-medium shadow-glow hover:shadow-lg disabled:opacity-60 transition"
          >
            {generating ? 'Generating…' : 'Generate ✨'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Step 1 — Content */}
        <div className="glass rounded-2xl p-5 mb-4 border border-white/60 dark:border-slate-800/60">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Step 1 — Content <span className="normal-case font-normal">(paste your outline, doc, or describe slides)</span>
          </div>
          <textarea
            value={settings.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
            placeholder={'Paste your outline or describe slides.\nExample:\nSlide 1: Introduction\nSlide 2: What we built\nSlide 3: Thank You'}
            className="w-full min-h-[90px] resize-y rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <div className="mt-3">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Presentation Title</label>
            <input
              value={settings.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Auto-derived from prompt"
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>

        {/* Steps 2–3 + options */}
        <div className="space-y-3">
          {sections.map((sec) => {
            const isOpen = open === sec.id;
            return (
              <div key={sec.id} className="glass rounded-2xl border border-white/60 dark:border-slate-800/60 overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? '' : sec.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/40 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center">
                      <sec.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-display font-semibold text-slate-900 dark:text-white">{sec.label}</span>
                  </div>
                  {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 animate-fade-in">
                    {sec.id === 'outline' && <OutlineSection settings={settings} onChange={onChange} />}
                    {sec.id === 'theme' && <ThemeSection settings={settings} update={update} />}
                    {sec.id === 'options' && <OptionsSection settings={settings} update={update} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: editable outline (Gamma's "paste outline → structure slides") ──
function OutlineSection({ settings, onChange }: { settings: PresentationSettings; onChange: (s: PresentationSettings) => void }) {
  const parsed: OutlineSlide[] = useMemo(() => {
    const d = detectContent(settings.prompt);
    if (d.slideInstructions.length > 0) {
      return d.slideInstructions.map((s) => ({ title: s.title, bullets: [...s.bullets, ...s.bodyLines] }));
    }
    const pts = d.multiTopics.length >= 2 ? d.multiTopics : d.subtopics.length >= 2 ? d.subtopics : d.contentPoints;
    if (pts.length > 0) return pts.map((p) => ({ title: p.split(/[:：]/)[0].trim().substring(0, 60) || 'Untitled', bullets: [] as string[] }));
    return [];
  }, [settings.prompt]);

  const [local, setLocal] = useState<OutlineSlide[] | null>(null);
  const outline = local ?? parsed;
  // Reset local edits when the prompt changes upstream
  const [lastPrompt, setLastPrompt] = useState(settings.prompt);
  if (lastPrompt !== settings.prompt) {
    setLastPrompt(settings.prompt);
    setLocal(null);
  }

  const writeBack = (slides: OutlineSlide[]) => {
    setLocal(slides);
    // Rebuild prompt so the arrange engine produces exactly this outline
    const rebuilt = slides.map((s, i) => `Slide ${i + 1}: ${s.title}\n${s.bullets.map((b) => `- ${b}`).join('\n')}`).join('\n\n');
    onChange({ ...settings, prompt: rebuilt });
  };

  if (outline.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No structured outline detected yet — add <span className="font-semibold">“Slide 1: … Slide 2: …”</span> blocks
        or a bullet list above and they’ll appear here for review. Anything without structure will be arranged automatically on generate.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Gamma-style review: edit titles & bullets, delete or add slides. Layouts, tables, and process steps are picked automatically at generate time.
      </p>
      {outline.map((s, i) => (
        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-brand-600 dark:text-brand-300 w-8 shrink-0">{i + 1}</span>
            <input
              value={s.title}
              onChange={(e) => {
                const next = outline.map((o, j) => (j === i ? { ...o, title: e.target.value } : o));
                writeBack(next);
              }}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              onClick={() => writeBack(outline.filter((_, j) => j !== i))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
              title="Delete slide"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={s.bullets.join('\n')}
            onChange={(e) => {
              const next = outline.map((o, j) => (j === i ? { ...o, bullets: e.target.value.split('\n').map((l) => l.replace(/^[-*•\d+.)\s]+/, '').trim()).filter(Boolean) } : o));
              writeBack(next);
            }}
            rows={Math.max(2, Math.min(8, s.bullets.length + 1))}
            placeholder="One bullet per line"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      ))}
      <button
        onClick={() => writeBack([...outline, { title: `New Slide ${outline.length + 1}`, bullets: [] }])}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-brand-400 hover:text-brand-600 transition"
      >
        <Plus className="w-4 h-4" /> Add slide
      </button>
    </div>
  );
}

// ── Step 3: theme picker (Gamma's "pick a theme and generate") ──
function ThemeSection({ settings, update }: { settings: PresentationSettings; update: (p: Partial<PresentationSettings>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Theme</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {THEME_LIST.map((t) => {
            const active = settings.theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => update({ theme: t.id })}
                className={`rounded-xl border p-2 text-left transition ${active ? 'border-brand-500 ring-2 ring-brand-300' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'}`}
                title={t.name}
              >
                <div className="h-10 rounded-lg mb-1.5" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.secondary})` }} />
                <div className="text-xs font-medium truncate">{t.name}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Background</div>
        <div className="flex flex-wrap gap-2">
          {BACKGROUND_STYLES.map((b) => (
            <button
              key={b.id}
              onClick={() => update({ background: b.id })}
              title={b.name}
              className={`w-10 h-10 rounded-lg border transition ${settings.background === b.id ? 'border-brand-500 ring-2 ring-brand-300' : 'border-slate-200 dark:border-slate-700'}`}
              style={{ background: b.preview }}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Audience</div>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_OPTIONS.map((a: { id: string; name: string }) => (
            <button
              key={a.id}
              onClick={() => update({ audience: a.id as PresentationSettings['audience'] })}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${settings.audience === a.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700'}`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OptionsSection({ settings, update }: { settings: PresentationSettings; update: (p: Partial<PresentationSettings>) => void }) {
  const toggles: { key: keyof PresentationSettings; label: string; icon: typeof Mic; desc: string }[] = [
    { key: 'speakerNotes', label: 'Speaker Notes', icon: Mic, desc: 'Generate notes for each slide to guide delivery' },
    { key: 'references', label: 'References Slide', icon: BookOpen, desc: 'Add a references slide with cited sources' },
    { key: 'explainPoints', label: 'Explain Short Points', icon: ListOrdered, desc: 'Adds a one-line explanation to very short bullets (uses built-in topic knowledge)' },
  ];
  // Note: Images are always included by default — remove them per slide in the
  // editor (Properties → Slide → Slide Image → Remove) or via AI chat
  // ("remove image").
  return (
    <div className="space-y-2">
      {toggles.map((t) => {
        const value = settings[t.key] as boolean;
        return (
          <button
            key={t.key}
            onClick={() => update({ [t.key]: !value } as Partial<PresentationSettings>)}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition text-left"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${value ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <t.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">{t.label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{t.desc}</div>
              </div>
            </div>
            <div className={`relative w-11 h-6 rounded-full transition ${value ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
