import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatBubbleLeftRightIcon, XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { api } from '../lib/api';
import { useChatContext } from '../context/ChatContext';
import Spinner from './ui/Spinner';

const PAGE_LABELS = {
  '/dashboard':  'Dashboard',
  '/profile':    'Profile',
  '/onboarding': 'Onboarding',
};

const WELCOME = "Hi! I'm your Apply Ready assistant. Ask me anything — how the app works, what a fit score means, why your Discover tab is empty, whatever you need.";

export default function ChatWidget() {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([]); // sent to API (no welcome msg)
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);
  const inputRef              = useRef(null);
  const { context }           = useChatContext();
  const location              = useLocation();

  const pageName = PAGE_LABELS[location.pathname] || 'App';

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const { reply } = await api.ai.chat({
        messages: updated,
        context: { page: pageName, ...context },
      });
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Something went wrong. Try again in a moment.' }]);
    } finally {
      setLoading(false);
    }
  }

  // All messages displayed (welcome + conversation)
  const displayMessages = [
    { role: 'assistant', content: WELCOME },
    ...messages,
  ];

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-4 sm:right-6 z-50 flex flex-col bg-linen border border-[#e5e5e0] rounded-sm shadow-xl"
          style={{ width: 'min(380px, calc(100vw - 2rem))', height: '480px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e0] flex-shrink-0 bg-white rounded-t-sm">
            <div>
              <p className="font-montserrat font-bold text-sm text-teal-deeper">Apply Ready Assistant</p>
              <p className="font-lora text-xs text-ink/40">Ask me anything</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-ink/40 hover:text-ink transition-colors p-1 rounded-sm"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {displayMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2.5 rounded-sm font-lora text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-teal text-white'
                    : 'bg-white border border-[#e5e5e0] text-ink/80'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#e5e5e0] px-4 py-3 rounded-sm">
                  <Spinner size="sm" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-[#e5e5e0] flex-shrink-0 bg-white rounded-b-sm">
            <input
              ref={inputRef}
              className="flex-1 px-3 py-2 bg-linen border border-[#e5e5e0] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal"
              placeholder="Ask a question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="p-2 bg-teal text-white rounded-sm hover:bg-teal-deeper transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 sm:right-6 z-50 w-12 h-12 bg-teal text-white rounded-full shadow-lg hover:bg-teal-deeper transition-all flex items-center justify-center"
        aria-label="Open chat assistant"
      >
        {open
          ? <XMarkIcon className="w-5 h-5" />
          : <ChatBubbleLeftRightIcon className="w-5 h-5" />
        }
      </button>
    </>
  );
}
