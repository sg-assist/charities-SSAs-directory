"use client";

import { useState, useRef, useEffect } from "react";
import { Send, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; slug: string }>;
}

const STARTER_PROMPTS: { label: string; icon: string; prompt: string }[] = [
  {
    label: "Ask a research question",
    icon: "🔍",
    prompt: "What PPP models are most relevant for humanitarian resilience in Asia?",
  },
  {
    label: "Summarise an issue",
    icon: "📋",
    prompt: "Summarise the key evidence on how climate change affects sexual and reproductive health in Asia.",
  },
  {
    label: "Draft meeting notes",
    icon: "📝",
    prompt: "Draft a set of discussion questions and key points for a meeting with Singapore family office representatives about funding resilience programmes.",
  },
  {
    label: "Generate a briefing",
    icon: "📄",
    prompt: "Write a one-page briefing on Singapore's financial ecosystem for resilience initiatives, suitable for a senior UNFPA official.",
  },
  {
    label: "Compare options",
    icon: "⚖️",
    prompt: "Compare blended finance vehicles and development impact bonds as mechanisms for funding community resilience in the Pacific.",
  },
  {
    label: "Explore UNFPA's mandate",
    icon: "🌐",
    prompt: "How does UNFPA's mandate on SRHR relate to climate and humanitarian response in Asia?",
  },
];

const LOADING_WORDS = [
  "resilience", "partnerships", "SRHR", "climate", "blended finance",
  "community", "UNFPA", "Asia-Pacific", "humanitarian", "co-design",
  "maternal health", "PPP", "Singapore", "solidarity", "evidence",
  "financing", "advocacy", "policy", "family offices", "vulnerability",
  "adaptation", "GBV", "health systems", "impact", "coordination",
];

function LoadingPulse() {
  const [wordIndex, setWordIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % LOADING_WORDS.length);
        setVisible(true);
      }, 200);
    }, 1200);
    return () => clearInterval(cycle);
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span
        className="text-xs font-medium transition-opacity duration-200"
        style={{ color: "#009EDB", opacity: visible ? 1 : 0 }}
      >
        {LOADING_WORDS[wordIndex]}
      </span>
    </div>
  );
}

export function KnowledgeChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text?: string) => {
    const userMessage = (text ?? input).trim();
    if (!userMessage || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            sources: data.sources?.length ? data.sources : undefined,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Sorry, something went wrong. Please try again.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Could not reach the server. Please check your connection and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200" style={{ backgroundColor: "#003366" }}>
        <h2 className="font-semibold text-white flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          UNFPA Knowledge Assistant
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "#a8c8e8" }}>
          Grounded in research on PPP models, climate resilience, SRHR, and Singapore&apos;s finance ecosystem
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50">
        {messages.length === 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              What would you like to do?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p.prompt}
                  onClick={() => sendMessage(p.prompt)}
                  className="flex items-start gap-3 text-left px-4 py-3 border border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors rounded-lg group"
                >
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">{p.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-slate-900">{p.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-2">{p.prompt}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg ${
                message.role === "user"
                  ? "px-4 py-3 text-white text-sm"
                  : "bg-white border border-slate-200 text-slate-900 px-4 py-3"
              }`}
              style={message.role === "user" ? { backgroundColor: "#003366" } : {}}
            >
              {message.role === "assistant" ? (
                <div className="prose max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm leading-relaxed">{message.content}</p>
              )}

              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    Sources from knowledge base
                  </p>
                  <ul className="space-y-1">
                    {message.sources.map((source, i) => (
                      <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                        <span
                          className="mt-1.5 h-1 w-1 rounded-full flex-shrink-0"
                          style={{ backgroundColor: "#009EDB" }}
                        />
                        <a href={`/knowledge/${source.slug}`} className="hover:underline hover:text-blue-600">
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <LoadingPulse />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question, request a briefing, draft meeting notes…"
            className="flex-1 resize-none border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:border-blue-600"
            style={{ "--tw-ring-color": "#009EDB" } as React.CSSProperties}
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            className="px-4 text-white rounded hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium transition-opacity"
            style={{ backgroundColor: "#009EDB" }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
