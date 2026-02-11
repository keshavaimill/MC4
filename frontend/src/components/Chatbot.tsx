import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Minimize2, Sparkles, Mail, UserCircle } from 'lucide-react';
import { chatbotQuery, emailChatbotInsight, type ChatbotResponse } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  sql_query?: string; // Support both for compatibility
  data?: any[];
  viz?: string;
  mime?: string;
  chart?: string; // New field name
  question?: string; // Store the original question for email
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm your MC4 AI assistant. I can help you with:\n\n• SKU forecasts and demand\n• Mill capacity and utilization\n• Recipe information and scheduling\n• Flour demand and allocation\n• Raw material prices and availability\n• Production planning\n\nClick on the example questions below to get started, or type your own question!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailing, setEmailing] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleExampleClick = (question: string) => {
    handleSend(question);
  };

  const handleSend = async (questionText?: string) => {
    const query =
      typeof questionText === 'string'
        ? questionText
        : typeof input === 'string'
        ? input
        : '';

    if (!query.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    const question = query;
    if (!questionText) setInput('');
    setLoading(true);

    try {
      const result: ChatbotResponse = await chatbotQuery(question);
      const assistantMessage: Message = {
        role: 'assistant',
        content: result.answer || 'Query executed successfully.',
        sql: result.sql_query,
        sql_query: result.sql_query,
        data: result.data,
        viz: result.chart, // Support both field names for compatibility
        mime: 'image/png', // Default to PNG
        chart: result.chart, // New field name
        question: question, // Store the original question for email
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chatbot error:', error);
      let errorMessage = 'An error occurred while processing your query.';

      if (error.response) {
        // Server responded with error
        if (error.response.status === 503) {
          errorMessage = 'Chatbot service is currently unavailable. Please try again later.';
        } else if (error.response.data?.detail) {
          errorMessage = `Error: ${error.response.data.detail}`;
        } else {
          errorMessage = `Error: ${error.response.status} ${error.response.statusText}`;
        }
      } else if (error.request) {
        // Request made but no response
        errorMessage = 'Unable to connect to the server. Please check your connection.';
      } else {
        // Something else happened
        errorMessage = `Error: ${error.message || 'Unknown error'}`;
      }

      const errorMsg: Message = {
        role: 'assistant',
        content: errorMessage,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailInsight = async (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message.question || message.role !== 'assistant') return;

    setEmailing(messageIndex);
    try {
      await emailChatbotInsight({
        question: message.question,
        answer: message.content,
        sql_query: message.sql_query || message.sql,
        data: message.data,
        chart: message.chart || message.viz,
      });
      
      alert('Email sent successfully!');
    } catch (error: any) {
      console.error('Error sending email:', error);
      alert(error.message || 'Failed to send email. Please check your email configuration.');
    } finally {
      setEmailing(null);
    }
  };

  const toggleChat = () => {
    if (isOpen && !isMinimized) {
      setIsMinimized(true);
    } else if (isOpen && isMinimized) {
      setIsMinimized(false);
    } else {
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
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-full shadow-2xl hover:from-orange-600 hover:to-brown-600 transition-all duration-300 flex items-center justify-center z-50 hover:scale-110"
          aria-label="Open AI Assistant"
        >
          <UserCircle className="w-7 h-7" />
          {messages.length > 1 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
              {messages.length - 1}
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl border border-brown-200 flex flex-col z-50 transition-all duration-300 ${
            isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
          }`}
        >
          {/* Header */}
          <div className="h-14 bg-gradient-to-r from-orange-500 to-orange-600 text-white flex items-center justify-between px-4 rounded-t-lg flex-shrink-0">
            <div className="flex items-center space-x-2">
              <UserCircle className="w-5 h-5" />
              {isMinimized ? (
                <span className="font-semibold text-sm">MC4 AI Assistant</span>
              ) : (
                <span className="font-semibold">MC4 AI Assistant</span>
              )}
              {!isMinimized && messages.length > 1 && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {messages.length - 1} message{messages.length > 2 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleChat}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                aria-label={isMinimized ? 'Expand' : 'Minimize'}
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={closeChat}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                aria-label="Close"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Minimized view - show last message preview */}
          {isMinimized && (
            <div className="flex-1 px-4 flex items-center">
              <p className="text-sm text-brown-600 truncate">
                {messages[messages.length - 1]?.content.substring(0, 50)}
                {(messages[messages.length - 1]?.content.length ?? 0) > 50 ? '...' : ''}
              </p>
            </div>
          )}

          {/* Messages - Only show when not minimized */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Example Questions - Show only when there's just the welcome message */}
                {messages.length === 1 && (
                  <div className="space-y-3 mb-4">
                    <p className="text-xs font-semibold text-brown-600 uppercase tracking-wide">
                      Try asking:
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() =>
                          handleExampleClick('What is the total forecast for SKU001 this month?')
                        }
                        className="text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-sm text-brown-700 transition-colors"
                      >
                        📊 What is the total forecast for SKU001 this month?
                      </button>
                      <button
                        onClick={() =>
                          handleExampleClick('Show me mill utilization for all mills last week')
                        }
                        className="text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-sm text-brown-700 transition-colors"
                      >
                        🏭 Show me mill utilization for all mills last week
                      </button>
                      <button
                        onClick={() =>
                          handleExampleClick('Which recipes are used for Superior flour?')
                        }
                        className="text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-sm text-brown-700 transition-colors"
                      >
                        🥖 Which recipes are used for Superior flour?
                      </button>
                      <button
                        onClick={() =>
                          handleExampleClick(
                            'What is the bulk flour demand for Bakery flour in January 2020?'
                          )
                        }
                        className="text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-sm text-brown-700 transition-colors"
                      >
                        📦 What is the bulk flour demand for Bakery flour in January 2020?
                      </button>
                      <button
                        onClick={() =>
                          handleExampleClick(
                            'Show me the production schedule for M1 mill on 2020-01-01'
                          )
                        }
                        className="text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-sm text-brown-700 transition-colors"
                      >
                        ⚙️ Show me the production schedule for M1 mill on 2020-01-01
                      </button>
                      <button
                        onClick={() =>
                          handleExampleClick('What is the wheat price in Saudi Arabia?')
                        }
                        className="text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-sm text-brown-700 transition-colors"
                      >
                        🌾 What is the wheat price in Saudi Arabia?
                      </button>
                      <button
                        onClick={() =>
                          handleExampleClick('Show me overload hours for all mills in 2020')
                        }
                        className="text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-sm text-brown-700 transition-colors"
                      >
                        ⚠️ Show me overload hours for all mills in 2020
                      </button>
                      <button
                        onClick={() =>
                          handleExampleClick('What recipes can produce Bakery flour?')
                        }
                        className="text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-sm text-brown-700 transition-colors"
                      >
                        🔄 What recipes can produce Bakery flour?
                      </button>
                    </div>
                  </div>
                )}
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                          : 'bg-brown-50 text-brown-900 border border-brown-200'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.role === 'assistant' && (
                          <UserCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        )}
                        {message.role === 'user' && (
                          <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          {message.sql && (
                            <details className="mt-2">
                              <summary className="text-xs opacity-75 cursor-pointer hover:opacity-100">
                                View SQL
                              </summary>
                              <pre className="mt-1 text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-x-auto">
                                {message.sql}
                              </pre>
                            </details>
                          )}
                          {message.data && message.data.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs opacity-75 cursor-pointer hover:opacity-100">
                                View Data ({message.data.length} rows)
                              </summary>
                              <div className="mt-1 text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr>
                                      {Object.keys(message.data[0]).map((key) => (
                                        <th key={key} className="font-semibold pr-2 border-b">
                                          {key}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {message.data.slice(0, 10).map((row, i) => (
                                      <tr key={i} className="border-b">
                                        {Object.values(row).map((val, j) => (
                                          <td key={j} className="pr-2 py-1">
                                            {String(val)}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {message.data.length > 10 && (
                                  <p className="text-xs mt-2 text-brown-600">
                                    Showing first 10 of {message.data.length} rows
                                  </p>
                                )}
                              </div>
                            </details>
                          )}
                          {(message.chart || message.viz) && (
                            <div className="mt-3">
                              <img
                                src={`data:${message.mime || 'image/png'};base64,${message.chart || message.viz}`}
                                alt="Generated visualization"
                                className="max-w-full rounded-lg border"
                              />
                            </div>
                          )}
                          {message.role === 'assistant' && message.question && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => handleEmailInsight(idx)}
                                disabled={emailing === idx}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-500/10 text-orange-600 rounded-md hover:bg-orange-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Mail className={`w-3.5 h-3.5 ${emailing === idx ? 'animate-pulse' : ''}`} />
                                {emailing === idx ? 'Sending...' : 'Email this insight'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-brown-50 border border-brown-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <UserCircle className="w-4 h-4 animate-pulse text-orange-500" />
                        <span className="text-sm text-brown-700">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="h-16 border-t border-brown-200 p-4 flex-shrink-0 bg-brown-50">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(undefined)}
                    placeholder="Ask about forecasts, recipes, capacity..."
                    className="flex-1 px-3 py-2 border border-brown-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm text-brown-700 bg-white"
                    disabled={loading}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={loading || !input.trim()}
                    className="p-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-brown-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
