import { ChatPlayground } from "@/components/demo/ChatPlayground";
import { loadSchemaCatalog } from "@/lib/conversation/schema-catalog";

export default async function Home() {
  const schemas = await loadSchemaCatalog();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-12">
        <ChatPlayground schemas={schemas} />
      </div>
    </main>
  );
}
