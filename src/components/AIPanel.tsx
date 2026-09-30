import { useState, useEffect } from 'react';
import {
  Wand2, Scissors, Maximize, Minimize, Briefcase, GraduationCap, Building2,
  Smile, RefreshCw, Mic, BarChart3, X, Loader2, Check, Lightbulb,
} from 'lucide-react';
import type { Presentation, Slide, VivaQuestion, PresentationScore, RewriteTone } from '../types';
import { apiRewrite, apiRegenerateSlide, apiVivaQuestions, apiScore } from '../lib/api';

type Tab = 'rewrite' | 'notes' | 'viva' | 'score';

interface Props {
  presentation: Presentation;
  slide: Slide;
  onSlideChange: (s: Slide) => void;
  onClose: () => void;
  initialTab?: Tab;
}

export function AIPanel({ presentation, slide, onSlideChange, onClose, initialTab = 'rewrite' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string; icon: typeof Wand2 }[] = [
    { id: 'rewrite', label: 'AI Rewrite', icon: Wand2 },
    { id: 'notes', label: 'Notes', icon: Mic },
    { id: 'viva', label: 'Viva', icon: GraduationCap },
    { id: 'score', label: 'Score', icon: BarChart3 },
  ];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between px-4 h-12 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                tab === t.id
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'rewrite' && <RewriteTab slide={slide} onSlideChange={onSlideChange} presentation={presentation} />}
        {tab === 'notes' && <NotesTab slide={slide} onSlideChange={onSlideChange} />}
        {tab === 'viva' && <VivaTab presentation={presentation} />}
        {tab === 'score' && <ScoreTab presentation={presentation} />}
      </div>
    </div>
  );
}

const TONES: { id: RewriteTone; label: string; icon: typeof Wand2 }[] = [
  { id: 'rewrite', label: 'Rewrite', icon: RefreshCw },
  { id: 'shorten', label: 'Shorten', icon: Minimize },
  { id: 'expand', label: 'Expand', icon: Maximize },
  { id: 'simplify', label: 'Simplify', icon: Scissors },
  { id: 'professional', label: 'Professional', icon: Briefcase },
  { id: 'academic', label: 'Academic', icon: GraduationCap },
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'friendly', label: 'Friendly', icon: Smile },
];

function RewriteTab({ slide, onSlideChange, presentation }: { slide: Slide; onSlideChange: (s: Slide) => void; presentation: Presentation }) {
  const [loading, setLoading] = useState<RewriteTone | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const applyTone = async (tone: RewriteTone) => {
    setLoading(tone);
    await new Promise((r) => setTimeout(r, 300));
    const newSlide = { ...slide };
    if (newSlide.title) newSlide.title = await apiRewrite(newSlide.title, tone);
    if (newSlide.subtitle) newSlide.subtitle = await apiRewrite(newSlide.subtitle, tone);
    if (newSlide.body) newSlide.body = await apiRewrite(newSlide.body, tone);
    if (newSlide.bullets) newSlide.bullets = await Promise.all(
      newSlide.bullets.map(async (b) => ({ ...b, text: await apiRewrite(b.text, tone) })),
    );
    if (newSlide.cards) newSlide.cards = await Promise.all(
      newSlide.cards.map(async (c) => ({ ...c, description: await apiRewrite(c.description, tone) })),
    );
    if (newSlide.timeline) newSlide.timeline = await Promise.all(
      newSlide.timeline.map(async (t) => ({ ...t, description: await apiRewrite(t.description, tone) })),
    );
    if (newSlide.steps) newSlide.steps = await Promise.all(
      newSlide.steps.map(async (s) => ({ ...s, description: await apiRewrite(s.description, tone) })),
    );
    if (newSlide.stats) newSlide.stats = await Promise.all(
      newSlide.stats.map(async (s) => ({ ...s, description: s.description ? await apiRewrite(s.description, tone) : s.description })),
    );
    onSlideChange(newSlide);
    setLoading(null);
    setDone(tone);
    setTimeout(() => setDone(null), 1500);
  };

  const regenerate = async () => {
    setRegenerating(true);
    await new Promise((r) => setTimeout(r, 400));
    const newSlide = await apiRegenerateSlide(slide, presentation.settings, Math.floor(Math.random() * 100));
    onSlideChange({ ...newSlide, id: slide.id });
    setRegenerating(false);
    setDone('regenerate');
    setTimeout(() => setDone(null), 1500);
  };

  return (
    <div className="p-4 space-y-5">
      <div>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          AI Rewrite — applies to this slide
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => applyTone(t.id)}
              disabled={loading !== null}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 transition"
            >
              {loading === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : done === t.id ? <Check className="w-4 h-4 text-emerald-500" /> : <t.icon className="w-4 h-4" />}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Regenerate this slide
        </div>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-indigo-500 text-white text-sm font-medium hover:shadow-glow disabled:opacity-50 transition"
        >
          {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : done === 'regenerate' ? <Check className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
          {regenerating ? 'Regenerating…' : done === 'regenerate' ? 'Regenerated!' : 'Regenerate Slide'}
        </button>
        <p className="mt-2 text-xs text-slate-400">
          Generates fresh content for this slide while keeping the layout.
        </p>
      </div>
    </div>
  );
}

function NotesTab({ slide, onSlideChange }: { slide: Slide; onSlideChange: (s: Slide) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(slide.notes || '');

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Speaker Notes
        </div>
        <button
          onClick={() => {
            if (editing) {
              onSlideChange({ ...slide, notes: draft });
            }
            setEditing(!editing);
          }}
          className="text-xs px-2 py-1 rounded text-brand-600 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/30"
        >
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full min-h-[200px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      ) : (
        <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
          {slide.notes || 'No notes generated for this slide.'}
        </div>
      )}
    </div>
  );
}

function VivaTab({ presentation }: { presentation: Presentation }) {
  const [questions, setQuestions] = useState<VivaQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const q = await apiVivaQuestions(presentation);
        if (!cancelled) {
          setQuestions(q);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [presentation]);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-sm">Generating viva questions…</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Expected Viva Questions
        </div>
      </div>
      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setOpen(open === q.id ? null : q.id)}
              className="w-full flex items-start gap-2 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
            >
              <span className="text-xs font-bold text-brand-500 mt-0.5">Q{i + 1}</span>
              <span className="text-sm text-slate-900 dark:text-white font-medium">{q.question}</span>
            </button>
            {open === q.id && (
              <div className="px-3 pb-3 animate-fade-in">
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Answer</div>
                <p className="text-sm text-slate-700 dark:text-slate-200 mb-3">{q.answer}</p>
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Possible Follow-ups</div>
                <ul className="space-y-1">
                  {q.followUps.map((f, j) => (
                    <li key={j} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">→</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreTab({ presentation }: { presentation: Presentation }) {
  const [score, setScore] = useState<PresentationScore | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => setScore(await apiScore(presentation)), 300);
    return () => clearTimeout(t);
  }, [presentation]);

  if (!score) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-sm">Analyzing presentation…</p>
      </div>
    );
  }

  const metrics: { label: string; value: number; color: string }[] = [
    { label: 'Content Quality', value: score.contentQuality, color: '#06b6d4' },
    { label: 'Design', value: score.design, color: '#6366f1' },
    { label: 'Readability', value: score.readability, color: '#10b981' },
    { label: 'Visual Balance', value: score.visualBalance, color: '#f59e0b' },
    { label: 'Grammar', value: score.grammar, color: '#ec4899' },
    { label: 'Presentation Flow', value: score.flow, color: '#8b5cf6' },
  ];

  return (
    <div className="p-4">
      <div className="text-center mb-5">
        <div className="text-5xl font-display font-bold text-gradient mb-1">{score.overall}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Overall Score</div>
      </div>
      <div className="space-y-3 mb-5">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-600 dark:text-slate-300">{m.label}</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{m.value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${m.value}%`, background: m.color }}
              />
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Suggestions
        </div>
        <ul className="space-y-1.5">
          {score.suggestions.map((s, i) => (
            <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
