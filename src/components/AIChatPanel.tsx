import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Sparkles, X, Loader2, Check } from 'lucide-react';
import type { Presentation } from '../types';
import { apiEditPresentation } from '../lib/api';
import {
  processChatMessage,
  processAiActions,
  type EditorContext,
  type ActionResult,
} from '../lib/aiActions';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pendingConfirmation?: {
    message: string;
    originalText: string;
  };
}

interface Props {
  presentation: Presentation;
  currentSlideIndex: number;
  selectedElementId: string | null;
  onPresentationChange: (p: Presentation) => void;
  onClose: () => void;
}

export function AIChatPanel({
  presentation,
  currentSlideIndex,
  selectedElementId,
  onPresentationChange,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! Tell me what to change — in any language. For example: "Change all backgrounds to light blue", "Make the title bigger", "Add a slide", or "Make it more professional".',
    },
  ]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, processing]);

  const applyResult = (result: ActionResult) => {
    if (result.applied > 0) {
      onPresentationChange(result.presentation);
    }
    const aiMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: result.message,
    };
    setMessages((prev) => [...prev, aiMsg]);
  };

  const send = async (text: string) => {
    if (!text.trim() || processing) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setProcessing(true);

    const ctx: EditorContext = {
      presentation,
      currentSlideIndex,
      selectedElementId,
    };

    // Try AI-powered intent parsing first
    const aiResult = await apiEditPresentation(text, presentation, currentSlideIndex, selectedElementId);

    if (aiResult && aiResult.actions.length > 0) {
      // Destructive operation confirmation
      if (aiResult.needsConfirmation) {
        setProcessing(false);
        const confirmMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: aiResult.message,
          pendingConfirmation: {
            message: aiResult.message,
            originalText: text,
          },
        };
        setMessages((prev) => [...prev, confirmMsg]);
        return;
      }

      const result = processAiActions(aiResult.actions, aiResult.message, ctx);
      applyResult(result);
    } else {
      // Fallback to local regex parser
      await new Promise((r) => setTimeout(r, 200));
      const result = processChatMessage(text, ctx);
      applyResult(result);
    }

    setProcessing(false);
  };

  const confirmAction = (msg: ChatMessage) => {
    if (!msg.pendingConfirmation) return;
    // Re-send with confirmation flag — the backend won't ask again
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, text: msg.pendingConfirmation!.message + ' (Confirmed)', pendingConfirmation: undefined } : m
      )
    );
    // Re-process the original request but force execution
    const ctx: EditorContext = { presentation, currentSlideIndex, selectedElementId };
    const result = processChatMessage(msg.pendingConfirmation.originalText, ctx);
    applyResult(result);
  };

  const cancelConfirmation = (msg: ChatMessage) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, text: m.pendingConfirmation?.message + ' (Cancelled)', pendingConfirmation: undefined } : m
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <MessageSquare className="w-4 h-4 text-brand-500" />
          AI Assistant
        </div>
        <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand-500 text-white rounded-br-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm'
              }`}
            >
              {msg.role === 'assistant' && msg.id === 'welcome' && (
                <Sparkles className="w-3.5 h-3.5 text-brand-400 inline mr-1.5 mb-0.5" />
              )}
              {msg.text}
            </div>
            {msg.pendingConfirmation && (
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => confirmAction(msg)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition"
                >
                  <Check className="w-3 h-3" /> Yes, do it
                </button>
                <button
                  onClick={() => cancelConfirmation(msg)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            )}
          </div>
        ))}
        {processing && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell AI what you want to change..."
            rows={2}
            className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 pr-12 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || processing}
            className="absolute right-2 bottom-2 p-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400 text-center">
          Editing slide {currentSlideIndex + 1} of {presentation.slides.length}
          {selectedElementId && ' · element selected'}
        </p>
      </div>
    </div>
  );
}
