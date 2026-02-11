import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Sparkles, ExternalLink, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatbotQuery, emailChatbotInsight, type ChatbotResponse } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  chart?: string; // base64 image
  sqlQuery?: string;
  data?: Record<string, unknown>[];
  question?: string; // Store the original question for email
  actions?: { label: string; icon: "link" | "email" }[];
}

const starterMessages: Message[] = [
  {
    role: "assistant",
    content:
      "Hi! I'm your MC4 AI Assistant powered by Text2SQL. Ask me anything about your mill data — demand forecasts, capacity, wheat prices, waste metrics, and more.",
    actions: [
      { label: "View supporting data", icon: "link" },
      { label: "Email this insight", icon: "email" },
    ],
  },
];

interface AIAssistantProps {
  open: boolean;
  onClose: () => void;
}

export function AIAssistant({ open, onClose }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [emailing, setEmailing] = useState<number | null>(null); // Track which message is being emailed
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    const question = input;
    setInput("");
    setIsTyping(true);

    try {
      const result: ChatbotResponse = await chatbotQuery(question);

      const assistantMsg: Message = {
        role: "assistant",
        content:
          result.answer ||
          (result.data && result.data.length > 0
            ? `Found ${result.data.length} result(s). Here is a summary of the data.`
            : result.error || "I could not find an answer for that question."),
        chart: result.chart,
        sqlQuery: result.sql_query,
        data: result.data,
        question: question, // Store the original question for email
        actions: [
          { label: "View supporting data", icon: "link" },
          { label: "Email this insight", icon: "email" },
        ],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      // Fallback: if chatbot service is not available, give a helpful message
      const errorContent = err.message?.includes("503")
        ? "The AI chatbot service is not available on the server. Make sure the Text2SQL module is installed and the OPENAI_API_KEY is configured."
        : `Error: ${err.message}`;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorContent,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleEmailInsight = async (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message.question || message.role !== "assistant") return;

    setEmailing(messageIndex);
    try {
      await emailChatbotInsight({
        question: message.question,
        answer: message.content,
        sql_query: message.sqlQuery,
        data: message.data,
        chart: message.chart,
      });
      
      // Show success feedback
      alert("Email sent successfully!");
    } catch (err: any) {
      console.error("Error sending email:", err);
      alert(err.message || "Failed to send email. Please check your email configuration.");
    } finally {
      setEmailing(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 z-[60] flex h-full w-[400px] flex-col border-l border-border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Assistant</h3>
            <p className="text-[10px] text-muted-foreground">Text2SQL &bull; MC4 Planning</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "")}>
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                msg.role === "assistant" ? "bg-primary/10" : "bg-muted"
              )}
            >
              {msg.role === "assistant" ? (
                <Bot className="h-3.5 w-3.5 text-primary" />
              ) : (
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed",
                msg.role === "assistant"
                  ? "bg-accent/50 text-foreground"
                  : "bg-primary text-primary-foreground"
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* SQL Query (collapsible) */}
              {msg.sqlQuery && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] font-medium text-primary">Show SQL</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-[10px] font-mono text-muted-foreground">
                    {msg.sqlQuery}
                  </pre>
                </details>
              )}

              {/* Chart image */}
              {msg.chart && (
                <img
                  src={`data:image/png;base64,${msg.chart}`}
                  alt="Chart"
                  className="mt-2 w-full rounded-md border border-border"
                />
              )}

              {msg.actions && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.actions.map((action, actionIdx) => {
                    const messageIndex = messages.findIndex((m) => m === msg);
                    const isEmailing = emailing === messageIndex && action.icon === "email";
                    
                    return (
                      <button
                        key={action.label}
                        onClick={() => {
                          if (action.icon === "email" && messageIndex >= 0) {
                            handleEmailInsight(messageIndex);
                          } else if (action.icon === "link" && msg.data) {
                            // Open data in new window or show modal
                            console.log("View supporting data:", msg.data);
                            // You can implement a modal or new window here
                          }
                        }}
                        disabled={isEmailing}
                        className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {action.icon === "link" ? (
                          <ExternalLink className="h-2.5 w-2.5" />
                        ) : (
                          <Mail className={cn("h-2.5 w-2.5", isEmailing && "animate-pulse")} />
                        )}
                        {isEmailing ? "Sending..." : action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="rounded-xl bg-accent/50 px-3.5 py-2.5 text-xs text-muted-foreground">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about capacity, recipes, costs..."
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
