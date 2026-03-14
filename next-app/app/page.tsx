import { KnowledgeChat } from "@/components/knowledge-chat";

export default function Home() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Ask the Knowledge Base</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Semantic search across 32 research documents on UNFPA&apos;s mandate, programmes, and contested areas.
          Answers are grounded in the documents —{" "}
          <a href="/knowledge" className="text-blue-600 hover:underline">browse them directly</a> if you prefer.
        </p>
      </div>
      <KnowledgeChat />
    </main>
  );
}
