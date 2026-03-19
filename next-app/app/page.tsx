import { KnowledgeChat } from "@/components/knowledge-chat";

export default function Home() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">UNFPA Partnership Catalyst</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Prepare for conversations with potential funding organisations. Pitch UNFPA programmes, draft briefing notes,
          match projects to partner interests, and frame UNFPA&apos;s work for climate and humanitarian funding. Grounded in
          the{" "}
          <a href="/knowledge" className="text-blue-600 hover:underline">knowledge base</a>.
        </p>
      </div>
      <KnowledgeChat />
    </main>
  );
}
