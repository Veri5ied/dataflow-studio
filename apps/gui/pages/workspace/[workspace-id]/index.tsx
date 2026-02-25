import { useRouter } from "next/router";

export default function WorkspaceOverviewPage() {
  const { query } = useRouter();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Workspace {query["workspace-id"]}</h1>
      <p className="mt-3 text-slate-600">Dashboard scaffold.</p>
    </main>
  );
}
