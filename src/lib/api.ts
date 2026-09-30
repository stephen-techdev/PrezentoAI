// Frontend API client.
//
// Talks to the Prezento AI FastAPI backend when it's reachable. If the
// backend is offline, every method falls back to the local in-browser
// generator so the app always works — even with no backend running.

import type {
  Presentation,
  PresentationSettings,
  Slide,
  VivaQuestion,
  PresentationScore,
  RewriteTone,
} from '../types';
import {
  generatePresentation as localGenerate,
  createBlankPresentation as localBlank,
  rewriteText as localRewrite,
  regenerateSlide as localRegenerate,
  generateVivaQuestions as localViva,
  scorePresentation as localScore,
} from './generator';
import { detectContent } from './contentDetector';

export type ProgressCallback = (step: string) => void;

// Backend URL — defaults to localhost:8000. Override with VITE_API_URL.
const API_URL = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:8000';

let _backendAvailable: boolean | null = null;

async function checkBackend(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${API_URL}/api/health`, { signal: ctrl.signal });
    clearTimeout(t);
    _backendAvailable = res.ok;
  } catch {
    _backendAvailable = false;
  }
  return _backendAvailable;
}

// ── Generate ────────────────────────────────────────────────────────────────

export async function apiGenerate(
  settings: PresentationSettings,
  onProgress?: ProgressCallback,
): Promise<Presentation> {
  const hasTitle = settings.title.trim().length > 0;
  const hasPrompt = settings.prompt.trim().length > 0;
  if (!hasTitle && !hasPrompt) {
    return localBlank(settings);
  }

  // ── ARRANGE-ONLY: the prompt IS the content. Never call AI search. ──
  // Only detect slide count / instructions to arrange verbatim.
  let effectiveSettings = settings;
  if (hasPrompt) {
    const detection = detectContent(settings.prompt);
    if (detection.mode === 'multi-topic' && detection.multiTopics.length >= 2) {
      effectiveSettings = { ...settings, slideCount: detection.multiTopics.length };
    } else if (detection.slideInstructions.length >= 1) {
      // Verbatim slide count from "Slide N:" / "### Slide N" blocks
      const maxNum = detection.slideInstructions.reduce(
        (max, s) => (s.slideNumber && s.slideNumber > max ? s.slideNumber : max), 0,
      );
      const count = maxNum > 0 ? maxNum : detection.slideInstructions.length;
      effectiveSettings = { ...settings, slideCount: count };
    } else if (detection.requestedSlideCount && detection.requestedSlideCount >= 2) {
      effectiveSettings = { ...settings, slideCount: detection.requestedSlideCount };
    } else {
      const numberedMatches = settings.prompt.match(/^\s*\d+[.):]\s+\S/gim);
      if (numberedMatches && numberedMatches.length >= 2) {
        effectiveSettings = { ...settings, slideCount: numberedMatches.length };
      }
    }
  }

  // Arrange locally — no Supabase edge, no backend LLM. Prompt arranged verbatim.
  onProgress?.('Arranging your content into slides...');
  const pres = await localGenerate(effectiveSettings);
  onProgress?.('Building your presentation...');
  return pres;
}

// ── Rewrite ─────────────────────────────────────────────────────────────────

export async function apiRewrite(text: string, tone: RewriteTone): Promise<string> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_URL}/api/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, tone }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.text as string;
      }
    } catch {
      _backendAvailable = false;
    }
  }
  return localRewrite(text, tone);
}

// ── Regenerate single slide ──────────────────────────────────────────────────

export async function apiRegenerateSlide(
  slide: Slide,
  settings: PresentationSettings,
  variant = 0,
): Promise<Slide> {
  // No backend endpoint for single-slide regen — use local generator.
  return localRegenerate(slide, settings, variant);
}

// ── Viva questions ──────────────────────────────────────────────────────────

export async function apiVivaQuestions(presentation: Presentation): Promise<VivaQuestion[]> {
  if (await checkBackend()) {
    try {
      // Backend needs a saved presentation; save first via generate, then call viva.
      // For simplicity, we use the local generator which is fast and deterministic.
      const res = await fetch(`${API_URL}/api/viva/${presentation.id}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        return data.questions as VivaQuestion[];
      }
    } catch {
      _backendAvailable = false;
    }
  }
  return localViva(presentation);
}

// ── Score ────────────────────────────────────────────────────────────────────

export async function apiScore(presentation: Presentation): Promise<PresentationScore> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_URL}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presentation),
      });
      if (res.ok) {
        const data = await res.json();
        return data as PresentationScore;
      }
    } catch {
      _backendAvailable = false;
    }
  }
  return localScore(presentation);
}

// ── AI Chat edit (intent parsing) ──────────────────────────────────────────────

export interface EditIntentResult {
  actions: Record<string, unknown>[];
  message: string;
  needsConfirmation: boolean;
}

export async function apiEditPresentation(
  message: string,
  presentation: Presentation,
  currentSlideIndex: number,
  selectedElementId: string | null,
): Promise<EditIntentResult | null> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_URL}/api/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          presentation,
          currentSlideIndex,
          selectedElementId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          actions: data.actions || [],
          message: data.message || '',
          needsConfirmation: !!data.needsConfirmation,
        };
      }
    } catch {
      _backendAvailable = false;
    }
  }
  return null;
}

// ── Export (download) ───────────────────────────────────────────────────────

export async function apiExport(
  presentation: Presentation,
  format: 'pptx' | 'pdf',
): Promise<void> {
  if (await checkBackend()) {
    try {
      const res = await fetch(`${API_URL}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentation, format }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = (presentation.settings.title || 'presentation').replace(/[^a-z0-9]+/gi, '-');
        a.download = `${filename}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
    } catch {
      _backendAvailable = false;
    }
  }
  // Fallback: client-side export
  if (format === 'pdf') {
    const { exportPDF } = await import('./exporter');
    await exportPDF(presentation);
  } else {
    const { exportPPTX } = await import('./exporter');
    await exportPPTX(presentation);
  }
}
