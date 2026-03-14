import { KnowledgeChat } from "@/components/knowledge-chat";

export default function Home() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">UNFPA Research Assistant</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Research tool for the LKYSPP Policy Innovation Lab team. Ask questions about UNFPA&apos;s work, PPP models,
          climate resilience, humanitarian response, and Singapore&apos;s finance ecosystem. Answers are grounded in
          the knowledge base —{" "}
          <a href="/knowledge" className="text-blue-600 hover:underline">browse documents</a> directly if you prefer.
        </p>
      </div>
      <KnowledgeChat />
    </main>
  );
}
