import {
  Sparkles, ArrowRight, Wand2, Zap, Download, Edit3, Palette,
  Mic, BarChart3, Github, Sun, Moon, Check, Star, BookOpen,
} from 'lucide-react';
import type { PresentationSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

interface Props {
  onGenerate: (settings: PresentationSettings) => void;
  onHelp: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

const FEATURES = [
  { icon: Wand2, title: 'AI Generation', desc: 'Generate complete, well-structured presentations from a single prompt.' },
  { icon: Edit3, title: 'Inline Editing', desc: 'Click any text to edit. Add, duplicate, reorder, or delete slides.' },
  { icon: Palette, title: '10 Themes', desc: 'Switch themes instantly without losing your content.' },
  { icon: Mic, title: 'Speaker Notes', desc: 'Auto-generated notes for every slide to guide your delivery.' },
  { icon: BarChart3, title: 'Viva Assistant', desc: 'Expected questions, answers, and follow-ups for academic defense.' },
  { icon: Download, title: 'PPTX & PDF', desc: 'Export to PowerPoint or PDF with formatting preserved.' },
];

const STEPS = [
  { num: '01', title: 'Describe your topic', desc: 'Type a prompt or pick an example to start.' },
  { num: '02', title: 'Configure options', desc: 'Choose audience, theme, colors, fonts, and more.' },
  { num: '03', title: 'AI generates slides', desc: 'Get a full deck with varied layouts in seconds.' },
  { num: '04', title: 'Edit & export', desc: 'Refine any slide, then download as PPTX or PDF.' },
];

export function Landing({ onGenerate, onHelp, dark, onToggleDark }: Props) {
  const handleGenerate = () => {
    onGenerate({ ...DEFAULT_SETTINGS, prompt: '', title: '' });
  };

  return (
    <div className="min-h-screen mesh-bg">
      {/* Nav */}
      <nav className="sticky top-0 z-40 glass-strong border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-none">Prezento AI</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">AI Presentations, Free</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Github className="w-4 h-4" /> Open Source
            </a>
            <button
              onClick={onToggleDark}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleGenerate}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 transition"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 lg:pt-24">
        <div className="text-center max-w-3xl mx-auto animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-medium mb-6 border border-brand-200 dark:border-brand-800">
            <Zap className="w-3.5 h-3.5" /> 100% Free · No API keys · Runs locally
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
            Create Professional Presentations
            <br />
            <span className="text-gradient">for Free with AI</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Prezento AI generates beautiful, well-structured slide decks from a single prompt —
            then lets you edit, restyle, and export to PPTX or PDF. No subscriptions, no paid APIs.
          </p>
        </div>

        {/* Prompt card */}
        <div className="mt-10 max-w-3xl mx-auto animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="glass-strong rounded-2xl shadow-card-lg p-8 sm:p-10 border border-white/60 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-500 text-white font-medium shadow-glow hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <Wand2 className="w-5 h-5" /> Generate Presentation
            </button>
            <button
              onClick={onHelp}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 font-medium hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
            >
              <BookOpen className="w-5 h-5" /> How to use
            </button>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Unlimited generations</span>
          <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> No credit card</span>
          <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Free account</span>
          <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Open-source AI models</span>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Everything you need to present
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            A complete presentation toolkit — generation, editing, design, delivery, and export —
            all in one place, all free.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="group glass rounded-2xl p-5 border border-white/60 dark:border-slate-800/60 hover:shadow-card hover:-translate-y-1 transition-all animate-fade-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-white mb-1">{f.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            From prompt to presentation in 4 steps
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="text-5xl font-display font-bold text-brand-200 dark:text-brand-900 mb-2">{s.num}</div>
              <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-white mb-1">{s.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{s.desc}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight className="hidden lg:block absolute top-6 -right-3 w-5 h-5 text-slate-300 dark:text-slate-700" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-10 sm:p-16 text-center">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #22d3ee 0, transparent 40%), radial-gradient(circle at 80% 70%, #6366f1 0, transparent 40%)' }} />
          <div className="relative">
            <div className="inline-flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-3">
              Professional AI Presentations. Completely Free.
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto mb-8">
              Join thousands of students, educators, and professionals who create presentations with Prezento AI.
            </p>
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-900 font-medium hover:bg-brand-50 transition shadow-lg"
            >
              <Wand2 className="w-5 h-5" /> Start Generating Now
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Prezento AI — Free AI Presentations</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-500">
            Built with React, TypeScript, Tailwind CSS · Runs on local open-source AI
          </div>
        </div>
        <div className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500" style={{ fontSize: '13px' }}>
          © 2026 Prezento AI · Created by Stephen
        </div>
      </footer>
    </div>
  );
}
