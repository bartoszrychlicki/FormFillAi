import { ChatPlayground } from "@/components/demo/ChatPlayground";
import { loadSchemaCatalog } from "@/lib/conversation/schema-catalog";

export default async function Home() {
  const schemas = await loadSchemaCatalog();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12 lg:flex-row lg:gap-16 lg:px-12">
        <div className="flex-1">
          <ChatPlayground schemas={schemas} />
        </div>
      </div>
    </main>
  );
}
