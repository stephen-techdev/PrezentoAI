import { useEffect, useState, useRef } from 'react';
import { Sparkles, Check, Loader2 } from 'lucide-react';

interface Props {
  prompt: string;
  progress?: string;
  onDone: () => void;
}

const DEFAULT_STEPS = [
  'Generating outline...',
  'Writing content...',
  'Adding images...',
  'Building your presentation...',
];

const FALLBACK_STEPS = [
  'Understanding your topic',
  'Researching key concepts',
  'Creating presentation outline',
  'Generating slide content',
  'Selecting layouts and visuals',
  'Writing speaker notes',
  'Validating and finalizing',
];

export function GeneratingScreen({ prompt, progress, onDone }: Props) {
  const [step, setStep] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // When a real progress message arrives from the generation pipeline,
  // use it to drive the step list. Otherwise fall back to the cosmetic
  // timed steps so the screen still animates.
  const steps = progress ? DEFAULT_STEPS : FALLBACK_STEPS;

  useEffect(() => {
    if (progress) {
      // Real progress: map the message to the matching step index.
      const idx = DEFAULT_STEPS.findIndex(
        (s) => progress === s || progress.startsWith(s.replace('...', '')),
      );
      if (idx >= 0) setStep(idx + 1);
      return;
    }

    // Fallback: cosmetic timed progression (local generator path).
    const timers: number[] = [];
    FALLBACK_STEPS.forEach((_, i) => {
      timers.push(window.setTimeout(() => setStep(i + 1), 350 * (i + 1)));
    });
    return () => timers.forEach(clearTimeout);
  }, [progress]);

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-400 to-indigo-500 opacity-20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center shadow-glow">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>

        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Generating your presentation
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 line-clamp-2">
          "{prompt}"
        </p>

        <div className="space-y-2 text-left">
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div
                key={s}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                  active ? 'bg-white/70 dark:bg-slate-800/60 scale-[1.02]' : ''
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition ${
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                }`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-[10px]">{i + 1}</span>}
                </div>
                <span className={`text-sm transition ${done ? 'text-slate-500 dark:text-slate-400' : active ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
