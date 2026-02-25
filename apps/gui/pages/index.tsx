export default function LandingPage() {
  return (
    <main className="min-h-screen px-6 py-16 md:px-12">
      <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur">
        <p className="text-sm uppercase tracking-[0.24em] text-cyan-700">DataFlow Studio</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-900 md:text-6xl">
          AI-powered collaborative database studio
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-600">
          Scaffolded landing page placeholder. Workspace dashboard pages live under
          <code className="ml-1 rounded bg-slate-100 px-2 py-1 text-sm">/workspace/[workspace-id]</code>.
        </p>
      </section>
    </main>
  );
}
