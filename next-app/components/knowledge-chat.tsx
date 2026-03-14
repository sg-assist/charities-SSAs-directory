"use client";

import { useState, useRef, useEffect } from "react";
import { Send, BookOpen, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; slug: string }>;
}

const STARTER_QUESTIONS = [
  "What are UNFPA's three transformative results and how are they measured?",
  "What does the evidence say about UNFPA's impact on maternal mortality?",
  "How does UNFPA's China programme work and why is it controversial?",
  "What is the difference between UNFPA and PMNCH?",
  "How has US defunding affected UNFPA's programmes?",
];

export function KnowledgeChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
          Ask questions grounded in the UNFPA &amp; PMNCH knowledge base
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center mt-6">
            <p className="text-sm text-slate-500 mb-4">Start with a question, or try one of these:</p>
            <div className="space-y-2">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="block w-full text-left px-4 py-2.5 text-sm border border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors rounded"
                >
                  {q}
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
                  ? "px-4 py-3 text-white"
                  : "bg-white border border-slate-200 text-slate-900 px-4 py-3"
              }`}
              style={message.role === "user" ? { backgroundColor: "#003366" } : {}}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

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
                        {source.title}
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
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-lg">
              <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
            </div>
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
            placeholder="Ask about UNFPA programmes, maternal health, family planning, funding…"
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
