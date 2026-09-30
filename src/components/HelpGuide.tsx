import {
  X, Wand2, ListOrdered, Palette, Edit3, MessageSquare, Download,
  Mic, BarChart3, Check, Globe, WifiOff, BadgeCheck,
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

const CHAT_COMMANDS: { group: string; examples: string[] }[] = [
  {
    group: 'Restructure slides (no more bullet walls)',
    examples: [
      '"make this slide a table"',
      '"convert bullets to cards"',
      '"show this as a timeline"',
      '"turn these points into steps"',
      '"make it visual" / "redesign this slide"',
    ],
  },
  {
    group: 'Style & design',
    examples: [
      '"change all backgrounds to light blue"',
      '"make the title bigger" / "smaller"',
      '"center the title" / "align left"',
      '"apply the dark theme"',
      '"make the text bold"',
    ],
  },
  {
    group: 'Slides & content',
    examples: [
      '"add a slide then change its title to Pricing"',
      '"duplicate slide 2" / "delete slide 5"',
      '"change slide 3 title to Introduction"',
      '"remove "old text"" / "replace "old" with "new""',
      '"add an image about teamwork"',
    ],
  },
  {
    group: 'Polish text',
    examples: [
      '"rewrite this professionally"',
      '"shorten the body" / "simplify the text"',
      '"fix the grammar"',
    ],
  },
];

const STEPS = [
  {
    icon: Wand2,
    title: '1. Describe your deck',
    body: 'On the home screen, write what you want. Best results come from an outline:\nSlide 1: Title\nSlide 2: What we built\n- point one\n- point two\nSlide 3: Thank You\n\nExtra lines like "Use a modern style" or "add visuals" are treated as design instructions — they style the deck and never appear as slide text.',
  },
  {
    icon: ListOrdered,
    title: '2. Review the outline',
    body: 'Before generating, you see every detected slide as an editable card. Fix titles, rewrite bullets (one per line), delete slides, or add new ones. What you approve here is exactly what gets arranged — nothing is invented or dropped.',
  },
  {
    icon: Palette,
    title: '3. Pick a theme, then Generate',
    body: 'Choose one of 10 themes, a background, and your audience (school, college, business…). Press Generate. Bullets automatically become tables, cards, process steps, timelines, statistics, comparisons, or quotes wherever they fit — instead of plain bullet walls.',
  },
  {
    icon: Edit3,
    title: '4. Edit visually',
    body: 'Click any text to edit it inline. Select a title, subtitle, or bullet and press "Move freely" in the floating toolbar to detach it into a text box you can drag anywhere, Canva-style (drag to move, handles to resize/rotate, double-click to edit). Use the Properties panel (right side) for fonts, custom colors with any hex code, gradients, patterns, custom background images, and shapes. Upload images or a logo from your device — the logo pins itself to the top-right corner of the slide. Images are added to every suitable slide automatically — remove one per slide via Properties → Slide → Slide Image → Remove.',
  },
  {
    icon: MessageSquare,
    title: '5. Command the AI chat',
    body: 'Open the AI Assistant in the editor and type what you want in any language — English, Spanish, French, German, Hindi, Tamil, Arabic and more. Chain commands with "then": "add a slide then change its title to Pricing". See the command reference below.',
  },
  {
    icon: Download,
    title: '6. Present & export',
    body: 'Present right in the browser, or export to PPTX (PowerPoint) and PDF with formatting preserved. Check your Presentation Score, auto-generated Speaker Notes, and Viva Q&A before you deliver.',
  },
];

export function HelpGuide({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">How to use Prezento</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">The complete guide — creation to delivery</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition" aria-label="Close guide">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {STEPS.map((s) => (
            <div key={s.title} className="flex gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center shrink-0">
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}

          {/* AI chat command reference */}
          <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-900/10 p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-brand-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">AI chat — command reference</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {CHAT_COMMANDS.map((c) => (
                <div key={c.group}>
                  <div className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wide mb-1.5">{c.group}</div>
                  <ul className="space-y-1">
                    {c.examples.map((e) => (
                      <li key={e} className="text-[13px] text-slate-700 dark:text-slate-200 font-mono bg-white/70 dark:bg-slate-900/60 rounded-lg px-2.5 py-1.5 border border-brand-100 dark:border-brand-900/40">{e}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Tip: numbers, "slide N", color names, hex codes, and "quoted text" work in every language. Destructive actions (deleting slides/images) ask for confirmation first.
            </p>
          </div>

          {/* Delivery tools */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <Mic className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Speaker notes & Viva Q&A</div>
                <div className="text-[13px] text-slate-600 dark:text-slate-300 mt-0.5">Every slide gets delivery notes; the Viva panel generates expected questions with answers for your defense.</div>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <BarChart3 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Presentation score</div>
                <div className="text-[13px] text-slate-600 dark:text-slate-300 mt-0.5">Content, design, readability, and flow are scored with concrete suggestions to improve.</div>
              </div>
            </div>
          </div>

          {/* Free forever */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <BadgeCheck className="w-5 h-5" />
              <h3 className="font-semibold">Free for you, free to build</h3>
            </div>
            <ul className="space-y-1.5 text-[13px] text-white/95">
              <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" /> Unlimited generations — no credits, no subscriptions, no credit card.</li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" /> No paid AI APIs. Generation runs on local open-source models (Ollama) with an offline fallback.</li>
              <li className="flex items-start gap-2"><WifiOff className="w-4 h-4 mt-0.5 shrink-0" /> Works offline: the editor, chat fallback, and PPTX/PDF export all run in your browser.</li>
              <li className="flex items-start gap-2"><Globe className="w-4 h-4 mt-0.5 shrink-0" /> Cloud sync (Supabase free tier) is optional — sign in to save decks online, or export files locally.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
