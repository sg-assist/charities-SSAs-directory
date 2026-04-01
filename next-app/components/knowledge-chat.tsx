"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, BookOpen, Globe, Search, Brain, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; slug: string }>;
}

interface StatusUpdate {
  phase: "thinking" | "researching" | "searching" | "writing";
  message: string;
}

const STARTER_PROMPTS: { label: string; icon: string; prompt: string }[] = [
  {
    label: "Prepare a funder pitch",
    icon: "🎯",
    prompt: "Help me prepare a pitch for a Singapore-based family office interested in climate adaptation. How can I position UNFPA's maternal health and resilience work to match their investment thesis?",
  },
  {
    label: "Draft a briefing note",
    icon: "📄",
    prompt: "Draft a one-page briefing note on UNFPA's climate-SRHR work in Asia-Pacific, suitable for sharing with a potential philanthropic partner before a first meeting.",
  },
  {
    label: "Prepare meeting talking points",
    icon: "📝",
    prompt: "I have a meeting with a development finance institution interested in blended finance for health systems. Draft talking points that connect UNFPA's programmes to their priorities.",
  },
  {
    label: "Match projects to funders",
    icon: "🔗",
    prompt: "A corporate foundation focused on gender equity and women's empowerment wants to fund programmes in Southeast Asia. Which UNFPA projects and programme areas would be the best match?",
  },
  {
    label: "Frame for climate funding",
    icon: "🌏",
    prompt: "How can I frame UNFPA's SRHR mandate to access climate and humanitarian funding streams? What evidence links climate change to sexual and reproductive health outcomes in Asia?",
  },
  {
    label: "Compare financing models",
    icon: "⚖️",
    prompt: "Compare blended finance vehicles, development impact bonds, and South-South cooperation as mechanisms for funding UNFPA's community resilience work. Which would appeal most to Singapore-based investors?",
  },
];

const PHASE_ICONS: Record<string, typeof Brain> = {
  thinking: Brain,
  researching: Globe,
  searching: Search,
  writing: Pencil,
};

const DAILY_LIMIT = 20;

function StatusIndicator({ status }: { status: StatusUpdate }) {
  const Icon = PHASE_ICONS[status.phase] || Brain;
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 animate-pulse" style={{ color: "#009EDB" }} />
        <span className="text-xs font-medium" style={{ color: "#009EDB" }}>
          {status.message}
        </span>
      </div>
    </div>
  );
}

export function KnowledgeChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number>(DAILY_LIMIT);
  const [currentStatus, setCurrentStatus] = useState<StatusUpdate | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasConversation = messages.length > 0;

  // Fetch server-side global quota on mount
  useEffect(() => {
    fetch("/api/quota")
      .then((r) => r.json())
      .then((d) => setRemaining(d.remaining ?? DAILY_LIMIT))
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingText]);

  // Focus textarea when a starter prompt populates the input
  useEffect(() => {
    if (input && !hasConversation) {
      textareaRef.current?.focus();
    }
  }, [input, hasConversation]);

  const isAtLimit = remaining <= 0;

  const sendMessage = useCallback(
    async (text?: string) => {
      const userMessage = (text ?? input).trim();
      if (!userMessage || isLoading || isAtLimit) return;

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
      setIsLoading(true);
      setStreamingText("");
      setCurrentStatus({ phase: "thinking", message: "Analyzing your question..." });

      // Abort any previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

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
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (response.status === 429) {
            setRemaining(0);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  data.error ||
                  `Daily limit of ${DAILY_LIMIT} queries reached. Resets at midnight UTC.`,
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
          return;
        }

        // Process SSE stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep incomplete line in buffer

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ") && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (currentEvent) {
                  case "status":
                    setCurrentStatus(data as StatusUpdate);
                    break;

                  case "text_delta":
                    accumulatedText += data.text;
                    setStreamingText(accumulatedText);
                    setCurrentStatus(null); // hide status once text starts flowing
                    break;

                  case "done": {
                    const { sources, remaining: rem, fullText } = data;
                    // Use fullText if available for accuracy
                    const finalContent = fullText || accumulatedText;
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: finalContent,
                        sources: sources?.length ? sources : undefined,
                      },
                    ]);
                    setStreamingText("");
                    if (typeof rem === "number") setRemaining(rem);
                    break;
                  }

                  case "error":
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: data.message || "An error occurred. Please try again.",
                      },
                    ]);
                    setStreamingText("");
                    break;
                }
              } catch {
                // ignore malformed JSON
              }
              currentEvent = "";
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Could not reach the server. Please check your connection and try again.",
            },
          ]);
        }
      } finally {
        setIsLoading(false);
        setCurrentStatus(null);
        setStreamingText("");
        abortControllerRef.current = null;
      }
    },
    [input, isLoading, isAtLimit, messages]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Populate input from starter prompt without submitting
  const handleStarterClick = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      textareaRef.current?.focus();
      const ta = textareaRef.current;
      if (ta) ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 0);
  };

  return (
    // Outer wrapper expands horizontally once conversation starts
    <div
      className="transition-all duration-700 ease-in-out"
      style={hasConversation ? { margin: "0 calc(-1 * max(0px, (100vw - 900px) / 2 - 2rem))" } : {}}
    >
      <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200" style={{ backgroundColor: "#003366" }}>
          <h2 className="font-semibold text-white flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            UNFPA Partnership Catalyst
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#a8c8e8" }}>
            Prepare for funding conversations — pitch UNFPA programmes, draft briefings, and match projects to partners
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50">
          {!hasConversation && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                How can I help you prepare?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p.prompt}
                    onClick={() => handleStarterClick(p.prompt)}
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
                  <div className="prose prose-slate max-w-none prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:text-sm">
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

          {/* Streaming text (assistant response being built) */}
          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg bg-white border border-slate-200 text-slate-900 px-4 py-3">
                <div className="prose prose-slate max-w-none prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:text-sm">
                  <ReactMarkdown>{streamingText}</ReactMarkdown>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[10px] text-slate-400">Writing...</span>
                </div>
              </div>
            </div>
          )}

          {/* Status indicator (thinking/searching phases) */}
          {isLoading && currentStatus && !streamingText && (
            <div className="flex justify-start">
              <StatusIndicator status={currentStatus} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200 bg-white">
          {isAtLimit ? (
            <div className="text-center py-3 text-sm text-slate-500 bg-slate-50 rounded border border-slate-200">
              Daily limit of {DAILY_LIMIT} queries reached. Resets at midnight.
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Prepare a pitch, draft a briefing, match projects to funders…"
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
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-400">
                  Press Enter to send · Shift+Enter for new line
                </p>
                <p className="text-xs text-slate-400">
                  {isLoading
                    ? "Searching knowledge base & web — comprehensive answers may take up to a minute"
                    : `${remaining} of ${DAILY_LIMIT} queries remaining today`}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
