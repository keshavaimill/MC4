'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, MessageCircle, Minimize2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  data?: any[];
}

const EXAMPLES = [
  'What is the total forecast for SKU001 this month?',
  'Show me mill utilization for all mills last week',
  'Which recipes are used for Superior flour?',
  'What is the bulk flour demand for Bakery flour in January 2020?',
  'Show me the production schedule for M1 mill on 2020-01-01',
  'What is the wheat price in Saudi Arabia?',
  'Show me overload hours for all mills in 2020',
  'What recipes can produce Bakery flour?',
];

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your MC4 AI assistant. I can help with SKU forecasts, mill capacity, recipe planning, flour demand, raw materials, and production planning.\n\nChoose an example below or type your own question.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) scrollToBottom();
  }, [messages, isOpen, isMinimized]);

  const handleSend = async (questionText?: string) => {
    const query = questionText || input;
    if (!query.trim() || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    if (!questionText) setInput('');
    setLoading(true);

    try {
      const response = await api.post('/api/chatbot/query', { question: query });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.data.summary || 'Done.',
          sql: response.data.sql,
          data: response.data.data,
        },
      ]);
    } catch (error: any) {
      let msg = 'Something went wrong.';
      if (error.response?.status === 503) msg = 'Chatbot is unavailable. Try again later.';
      else if (error.response?.data?.detail) msg = String(error.response.data.detail);
      else if (error.request) msg = 'Cannot reach the server.';
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleChat = () => {
    if (isOpen && !isMinimized) setIsMinimized(true);
    else if (isOpen && isMinimized) setIsMinimized(false);
    else {
      setIsOpen(true);
      setIsMinimized(false);
    }
  };

  const closeChat = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-6 right-6 w-14 h-14 bg-brand text-white rounded-full shadow-card flex items-center justify-center z-50 hover:bg-brand-dark transition-all duration-250 ease-smooth hover:scale-105"
          aria-label="Open AI Assistant"
        >
          <MessageCircle className="w-6 h-6" />
          {messages.length > 1 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-white border border-border rounded-full flex items-center justify-center text-[10px] font-medium text-ink">
              {messages.length - 1}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-card border border-border-soft flex flex-col z-50 transition-all duration-300 ease-smooth overflow-hidden ${
            isMinimized ? 'w-80 h-14' : 'w-[400px] h-[560px]'
          }`}
        >
          <div className="h-14 bg-brand text-white flex items-center justify-between px-4 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="w-5 h-5 shrink-0 opacity-90" />
              <span className="font-semibold text-sm truncate">MC4 Assistant</span>
              {!isMinimized && messages.length > 1 && (
                <span className="text-xs text-white/70 truncate">{messages.length - 1} messages</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={toggleChat} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label={isMinimized ? 'Expand' : 'Minimize'}>
                <Minimize2 className="w-4 h-4" />
              </button>
              <button onClick={closeChat} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isMinimized && (
            <div className="flex-1 px-4 flex items-center min-h-0">
              <p className="text-sm text-ink-secondary truncate">
                {messages[messages.length - 1]?.content.substring(0, 60)}
                {(messages[messages.length - 1]?.content.length ?? 0) > 60 ? '…' : ''}
              </p>
            </div>
          )}

          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 1 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-medium text-ink-tertiary uppercase tracking-wider">Try asking</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {EXAMPLES.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(q)}
                          className="text-left px-3 py-2 rounded-xl border border-border-soft bg-surface-hover/50 hover:bg-surface-hover text-sm text-ink transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((message, idx) => (
                  <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        message.role === 'user'
                          ? 'bg-ink text-white rounded-br-md'
                          : 'bg-surface-hover text-ink rounded-bl-md'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {message.role === 'assistant' && <Bot className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />}
                        {message.role === 'user' && <User className="w-4 h-4 mt-0.5 shrink-0 opacity-80" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          {message.sql && (
                            <details className="mt-2">
                              <summary className="text-xs opacity-80 cursor-pointer hover:opacity-100">SQL</summary>
                              <pre className="mt-1 text-xs bg-black/10 p-2 rounded-lg overflow-x-auto">{message.sql}</pre>
                            </details>
                          )}
                          {message.data && message.data.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs opacity-80 cursor-pointer hover:opacity-100">Data ({message.data.length} rows)</summary>
                              <div className="mt-1 text-xs bg-black/10 p-2 rounded-lg overflow-auto max-h-36">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr>
                                      {Object.keys(message.data[0]).map((k) => (
                                        <th key={k} className="font-medium pr-2 border-b border-white/20">{k}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {message.data.slice(0, 10).map((row, i) => (
                                      <tr key={i} className="border-b border-white/10">
                                        {Object.values(row).map((val, j) => (
                                          <td key={j} className="pr-2 py-1">{String(val)}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {message.data.length > 10 && (
                                  <p className="text-[10px] mt-1 opacity-75">First 10 of {message.data.length}</p>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-surface-hover rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border-2 border-ink/30 border-t-ink animate-spin" />
                      <span className="text-sm text-ink-secondary">Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-border-soft flex gap-2 flex-shrink-0">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ask about forecasts, recipes, capacity…"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-white text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/20 text-sm transition-all"
                  disabled={loading}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className="p-2.5 rounded-xl bg-brand text-white hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
