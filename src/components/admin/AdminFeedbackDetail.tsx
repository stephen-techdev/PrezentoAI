import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Loader2, MessageSquare, Circle, Clock, CheckCircle, Send } from 'lucide-react';
import { fetchFeedbackDetail, updateFeedbackStatus, fetchFeedbackMessages, addFeedbackMessage, type FeedbackRow, type FeedbackStatus } from '../../lib/admin';

interface Props {
  feedbackId: string;
  onBack: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  general: 'General Feedback',
  problem: 'Report a Problem',
  bug: 'Bug Report',
  feature_request: 'Feature Request',
  other: 'Other',
};

const STATUS_OPTIONS: { value: FeedbackStatus; label: string; icon: typeof Circle; color: string }[] = [
  { value: 'open', label: 'Mark as Open', icon: Circle, color: 'text-amber-600 dark:text-amber-400' },
  { value: 'in_progress', label: 'Mark as In Progress', icon: Clock, color: 'text-sky-600 dark:text-sky-400' },
  { value: 'resolved', label: 'Mark as Resolved', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400' },
];

interface ChatMessage {
  id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export function AdminFeedbackDetail({ feedbackId, onBack }: Props) {
  const [feedback, setFeedback] = useState<FeedbackRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const { data: msgs } = await fetchFeedbackMessages(feedbackId);
    if (msgs) {
      setMessages(msgs.map(m => ({ id: m.id, sender_role: m.sender_role, message: m.message, created_at: m.created_at })));
    }
  }, [feedbackId]);

  useEffect(() => {
    (async () => {
      const { data } = await fetchFeedbackDetail(feedbackId);
      if (data) setFeedback(data);
      await loadMessages();
      setLoading(false);
    })();
  }, [feedbackId, loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleStatusChange = async (status: FeedbackStatus) => {
    if (!feedback) return;
    setUpdating(true);
    const { error } = await updateFeedbackStatus(feedback.id, status);
    setUpdating(false);
    if (error) return;
    setFeedback({ ...feedback, status });
  };

  const handleSendReply = async () => {
    if (!feedback || !replyText.trim()) return;
    setSendingReply(true);
    const { error } = await addFeedbackMessage(feedback.id, replyText.trim());
    setSendingReply(false);
    if (error) return;
    setReplyText('');
    await loadMessages();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-slate-400">Feedback not found.</p>
        <button onClick={onBack} className="mt-4 text-sm text-rose-600 hover:underline">← Back to feedback</button>
      </div>
    );
  }

  const allMessages: ChatMessage[] = [
    { id: 'initial', sender_role: 'user', message: feedback.message, created_at: feedback.created_at },
    ...messages,
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Feedback
      </button>

      {/* Header */}
      <div className="glass rounded-2xl p-6 border border-white/60 dark:border-slate-800/60 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6 text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-1">
              {TYPE_LABELS[feedback.feedback_type] || feedback.feedback_type}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Submitted {new Date(feedback.created_at).toLocaleString()}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                feedback.status === 'open' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                  feedback.status === 'in_progress' ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' :
                  'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
              }`}>
                {feedback.status === 'in_progress' ? 'In Progress' : feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <InfoCard label="User Name" value={feedback.user_name || 'Unknown'} />
        <InfoCard label="User Email" value={feedback.user_email || '—'} />
        <InfoCard label="Submitted" value={new Date(feedback.created_at).toLocaleDateString()} />
      </div>

      {/* Conversation */}
      <div className="glass rounded-2xl border border-white/60 dark:border-slate-800/60 mb-6 overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 px-6 pt-5 pb-3 border-b border-slate-200/60 dark:border-slate-700/60">Conversation</h3>
        <div ref={scrollRef} className="max-h-[400px] overflow-y-auto px-6 py-4 space-y-4">
          {allMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender_role === 'admin' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[75%] ${msg.sender_role === 'admin' ? '' : ''}`}>
                <div className={`text-xs font-medium mb-1 ${msg.sender_role === 'admin' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {msg.sender_role === 'admin' ? 'Admin' : feedback.user_name || 'User'}
                </div>
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.sender_role === 'admin'
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-slate-700 dark:text-slate-200 rounded-tl-sm'
                    : 'bg-brand-50 dark:bg-brand-900/20 text-slate-700 dark:text-slate-200 rounded-tr-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 {msg.sender_role === 'admin' ? '' : 'text-right'}">
                  {new Date(msg.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reply box */}
        <div className="border-t border-slate-200/60 dark:border-slate-700/60 px-4 py-3">
          <div className="flex gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendReply(); }}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 transition resize-none"
              placeholder="Write a reply..."
            />
            <button
              onClick={handleSendReply}
              disabled={sendingReply || !replyText.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Reply
            </button>
          </div>
        </div>
      </div>

      {/* Status management */}
      <div className="glass rounded-2xl p-6 border border-white/60 dark:border-slate-800/60">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Manage Status</h3>
        <div className="flex flex-wrap gap-3">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = feedback.status === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                disabled={updating || isActive}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                  isActive
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-default'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <opt.icon className={`w-4 h-4 ${opt.color}`} />}
                {opt.label}
              </button>
            );
          })}
        </div>
        {feedback.updated_at !== feedback.created_at && (
          <p className="text-xs text-slate-400 mt-3">Last updated {new Date(feedback.updated_at).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/60 dark:border-slate-800/60">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">{label}</div>
      <div className="text-sm font-medium text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
