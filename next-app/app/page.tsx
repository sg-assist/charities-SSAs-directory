import { KnowledgeChat } from "@/components/knowledge-chat";

export default function Home() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">The Directory</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Find charities, social service agencies, and caregiving resources in Singapore.
          Ask about eldercare, disability support, mental health services, financial assistance,
          and more. Grounded in the{" "}
          <a href="/knowledge" className="text-teal-600 hover:underline">knowledge base</a>
          {" and "}
          <a href="/directory" className="text-teal-600 hover:underline">organisation directory</a>.
        </p>
      </div>
      <KnowledgeChat />
    </main>
  );
}
