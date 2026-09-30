import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, X, Loader2, Send, CheckCircle, Plus, ArrowLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { submitFeedback, fetchOwnFeedback, addFeedbackMessage, fetchFeedbackMessages, type FeedbackType, type FeedbackRow } from '../lib/admin';

const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'general', label: 'General Feedback' },
  { value: 'problem', label: 'Report a Problem' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
];

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  in_progress: 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
  resolved: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
};

const TYPE_LABELS: Record<string, string> = {
  general: 'General Feedback',
  problem: 'Report a Problem',
  bug: 'Bug Report',
  feature_request: 'Feature Request',
  other: 'Other',
};

interface ChatMessage {
  id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'new' | 'chat'>('list');
  const [feedbackList, setFeedbackList] = useState<FeedbackRow[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRow | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // New feedback form state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const { profile } = useAuth();

  useEffect(() => {
    if (open && profile) {
      setName(profile.full_name || profile.username || '');
      setEmail(profile.email || '');
    }
  }, [open, profile]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    const { data } = await fetchOwnFeedback();
    setFeedbackList(data || []);
    setLoadingList(false);
  }, []);

  const loadChatMessages = useCallback(async (feedbackId: string) => {
    setLoadingChat(true);
    const { data: msgs } = await fetchFeedbackMessages(feedbackId);
    if (msgs) {
      setChatMessages(msgs.map(m => ({ id: m.id, sender_role: m.sender_role, message: m.message, created_at: m.created_at })));
    } else {
      setChatMessages([]);
    }
    setLoadingChat(false);
  }, []);

  useEffect(() => {
    if (open && view === 'list') loadList();
  }, [open, view, loadList]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleOpen = () => {
    setOpen(true);
    setView('list');
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    setOpen(false);
    setError(null);
    setSuccess(false);
    setView('list');
    setSelectedFeedback(null);
    setChatMessages([]);
    setReplyText('');
    setMessage('');
    setFeedbackType('general');
  };

  const handleOpenChat = async (fb: FeedbackRow) => {
    setSelectedFeedback(fb);
    setView('chat');
    await loadChatMessages(fb.id);
  };

  const handleSubmitNew = async () => {
    if (!message.trim()) {
      setError('Please enter a message.');
      return;
    }
    setSending(true);
    setError(null);
    const { error: err } = await submitFeedback(feedbackType, message.trim(), name, email);
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setSuccess(true);
    setMessage('');
    setFeedbackType('general');
    setTimeout(() => {
      setSuccess(false);
      setView('list');
      loadList();
    }, 1500);
  };

  const handleSendReply = async () => {
    if (!selectedFeedback || !replyText.trim()) return;
    setSendingReply(true);
    const { error: err } = await addFeedbackMessage(selectedFeedback.id, replyText.trim());
    setSendingReply(false);
    if (err) {
      setError(err);
      return;
    }
    setReplyText('');
    setError(null);
    await loadChatMessages(selectedFeedback.id);
    // Refresh the list to get updated status
    loadList();
  };

  const allChatMessages: ChatMessage[] = selectedFeedback
    ? [{ id: 'initial', sender_role: 'user', message: selectedFeedback.message, created_at: selectedFeedback.created_at }, ...chatMessages]
    : [];

  return (
    <>
      {/* Fixed button at bottom-left */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 left-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <MessageSquare className="w-4 h-4" />
        Feedback
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={handleClose}>
          <div
            className="glass-strong rounded-2xl shadow-card-lg w-full max-w-lg border border-white/60 dark:border-slate-700/60 animate-fade-up flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-700/60 shrink-0">
              <div className="flex items-center gap-2">
                {view === 'chat' && (
                  <button
                    onClick={() => { setView('list'); setSelectedFeedback(null); setChatMessages([]); }}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <MessageSquare className="w-5 h-5 text-rose-500" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {view === 'list' ? 'Feedback & Support' : view === 'new' ? 'New Feedback' : 'Conversation'}
                </h2>
              </div>
              <button onClick={handleClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">
              {/* LIST VIEW */}
              {view === 'list' && (
                <div className="p-5">
                  {success && (
                    <div className="text-center py-6 mb-4">
                      <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        Thank you! Your feedback has been sent.
                      </p>
                    </div>
                  )}
                  {loadingList ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                    </div>
                  ) : feedbackList.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">You haven't submitted any feedback yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {feedbackList.map((fb) => (
                        <button
                          key={fb.id}
                          onClick={() => handleOpenChat(fb)}
                          className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700/60 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {TYPE_LABELS[fb.feedback_type] || fb.feedback_type}
                            </span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[fb.status] || ''}`}>
                              {STATUS_LABELS[fb.status] || fb.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                            {fb.message}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-slate-400">
                              {new Date(fb.created_at).toLocaleDateString()}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-rose-400 transition" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* New feedback button */}
                  <button
                    onClick={() => { setView('new'); setError(null); }}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition"
                  >
                    <Plus className="w-4 h-4" />
                    New Feedback
                  </button>
                </div>
              )}

              {/* NEW FEEDBACK VIEW */}
              {view === 'new' && (
                <div className="p-5 space-y-4">
                  {success ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        Thank you! Your feedback has been sent to the administrator.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                          placeholder="your@email.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Feedback Type</label>
                        <select
                          value={feedbackType}
                          onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                        >
                          {FEEDBACK_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Message</label>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 transition resize-none"
                          placeholder="Tell us what happened or what you would like us to improve..."
                        />
                      </div>
                      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                      <div className="flex gap-3 justify-end pt-1">
                        <button
                          onClick={() => { setView('list'); setError(null); }}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSubmitNew}
                          disabled={sending}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-50"
                        >
                          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Send Feedback
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* CHAT VIEW */}
              {view === 'chat' && selectedFeedback && (
                <div className="flex flex-col h-full">
                  {/* Thread info */}
                  <div className="px-5 py-3 border-b border-slate-200/60 dark:border-slate-700/60 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {TYPE_LABELS[selectedFeedback.feedback_type] || selectedFeedback.feedback_type}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedFeedback.status] || ''}`}>
                        {STATUS_LABELS[selectedFeedback.status] || selectedFeedback.status}
                      </span>
                    </div>
                  </div>

                  {/* Messages */}
                  <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[200px]">
                    {loadingChat ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                      </div>
                    ) : (
                      allChatMessages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_role === 'admin' ? 'justify-start' : 'justify-end'}`}>
                          <div className="max-w-[80%]">
                            <div className={`text-xs font-medium mb-0.5 ${msg.sender_role === 'admin' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                              {msg.sender_role === 'admin' ? 'Admin' : 'You'}
                            </div>
                            <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                              msg.sender_role === 'admin'
                                ? 'bg-rose-50 dark:bg-rose-900/20 text-slate-700 dark:text-slate-200 rounded-tl-sm'
                                : 'bg-brand-50 dark:bg-brand-900/20 text-slate-700 dark:text-slate-200 rounded-tr-sm'
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.message}</p>
                            </div>
                            <div className={`text-[10px] text-slate-400 mt-0.5 ${msg.sender_role === 'admin' ? '' : 'text-right'}`}>
                              {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Reply box */}
                  <div className="border-t border-slate-200/60 dark:border-slate-700/60 px-4 py-3 shrink-0">
                    {error && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                        placeholder="Write a reply..."
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={sendingReply || !replyText.trim()}
                        className="flex items-center justify-center w-9 h-9 rounded-xl text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
