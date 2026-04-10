"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, BookOpen, Globe, Search, Brain, Pencil, Download, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    label: "Find eldercare services",
    icon: "🏠",
    prompt: "What eldercare services are available in Singapore? I'm looking for options for my elderly parent who needs daily assistance — nursing homes, day care centres, and home care services.",
  },
  {
    label: "Financial assistance for caregivers",
    icon: "💰",
    prompt: "What financial assistance and subsidies are available for caregivers in Singapore? I need help with the costs of caring for my elderly parent.",
  },
  {
    label: "Mental health support",
    icon: "🧠",
    prompt: "What mental health support organisations are available in Singapore? I'm looking for counselling services and support groups for someone dealing with anxiety and depression.",
  },
  {
    label: "Nursing home subsidies",
    icon: "📋",
    prompt: "How do I apply for subsidies for nursing home care in Singapore? What are the eligibility criteria and what government schemes are available?",
  },
  {
    label: "Disability support services",
    icon: "♿",
    prompt: "What disability support services are available for children in Singapore? I need information about early intervention, special education, and therapy services.",
  },
  {
    label: "Palliative care options",
    icon: "💜",
    prompt: "What palliative care and hospice options are available in Singapore? I need to understand the different types of end-of-life care and how to access them.",
  },
];

const PHASE_ICONS: Record<string, typeof Brain> = {
  thinking: Brain,
  researching: Globe,
  searching: Search,
  writing: Pencil,
};

function StatusIndicator({ status }: { status: StatusUpdate }) {
  const Icon = PHASE_ICONS[status.phase] || Brain;
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 animate-pulse" style={{ color: "#0891B2" }} />
        <span className="text-xs font-medium" style={{ color: "#0891B2" }}>
          {status.message}
        </span>
      </div>
    </div>
  );
}

function ExportButton({
  messages,
  disabled,
}: {
  messages: Message[];
  disabled: boolean;
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            sources: m.sources,
          })),
          format: "docx",
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(err.error || "Export failed. Please try again.");
        return;
      }

      // Client-side integrity verification
      const blob = await response.blob();
      const contentLength = response.headers.get("Content-Length");
      const integrity = response.headers.get("X-File-Integrity");

      if (integrity !== "verified") {
        alert("Export file did not pass server integrity check. Please try again.");
        return;
      }

      if (contentLength && blob.size !== Number(contentLength)) {
        alert(
          `Download incomplete: received ${blob.size} bytes but expected ${contentLength}. ` +
          "The file may be corrupted. Please try again."
        );
        return;
      }

      if (blob.size < 1024) {
        alert("Export file appears too small and may be incomplete. Please try again.");
        return;
      }

      // Verify magic bytes (DOCX = ZIP archive PK\x03\x04)
      const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      const expected = [0x50, 0x4b, 0x03, 0x04];
      if (!expected.every((b, i) => header[i] === b)) {
        alert("Downloaded file has an invalid header and may be corrupted. Please try again.");
        return;
      }

      // All checks passed — trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().split("T")[0];
      a.download = `directory-report-${timestamp}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please check your connection and try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || exporting}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        color: "#FFFFFF",
        borderColor: "rgba(255,255,255,0.4)",
        backgroundColor: exporting ? "rgba(255,255,255,0.15)" : "transparent",
      }}
      title="Export conversation as Word document"
    >
      {exporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {exporting ? "Exporting..." : "Export Word"}
    </button>
  );
}

export function KnowledgeChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<StatusUpdate | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasConversation = messages.length > 0;

  // Restore chat history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("directory-chat-messages");
      if (stored) setMessages(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Persist chat history to localStorage whenever messages change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem("directory-chat-messages", JSON.stringify(messages));
      }
    } catch { /* ignore */ }
  }, [messages]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setStreamingText("");
    setCurrentStatus(null);
    try { localStorage.removeItem("directory-chat-messages"); } catch { /* ignore */ }
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

  const sendMessage = useCallback(
    async (text?: string) => {
      const userMessage = (text ?? input).trim();
      if (!userMessage || isLoading) return;

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
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.error || "Sorry, something went wrong. Please try again.",
            },
          ]);
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
                    const { sources, fullText } = data;
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
    [input, isLoading, messages]
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
        <div className="px-5 py-4 border-b border-slate-200" style={{ backgroundColor: "#0891B2" }}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                The Directory
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#ccfbf1" }}>
                Find charities, SSAs, and caregiving resources in Singapore
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasConversation && (
                <button
                  onClick={handleNewChat}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-white/30 text-white/80 hover:bg-white/10 disabled:opacity-40 transition-colors"
                  title="Start a new conversation"
                >
                  <Pencil className="h-3 w-3" />
                  New Chat
                </button>
              )}
              {hasConversation && !isLoading && (
                <ExportButton messages={messages} disabled={messages.length === 0} />
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50">
          {!hasConversation && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                How can I help you today?
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
                style={message.role === "user" ? { backgroundColor: "#111827" } : {}}
              >
                {message.role === "assistant" ? (
                  <div className="prose prose-slate max-w-none prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
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
                            style={{ backgroundColor: "#0891B2" }}
                          />
                          <a href={`/knowledge/${source.slug}`} className="hover:underline hover:text-teal-600">
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
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
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your caregiving needs, search for organisations..."
              className="flex-1 resize-none border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:border-teal-600"
              style={{ "--tw-ring-color": "#0891B2" } as React.CSSProperties}
              rows={2}
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="px-4 text-white rounded hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium transition-opacity"
              style={{ backgroundColor: "#0891B2" }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-400">
              Press Enter to send · Shift+Enter for new line
            </p>
            {isLoading && (
              <p className="text-xs text-slate-400">
                Searching knowledge base & web — comprehensive answers may take up to a minute
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
