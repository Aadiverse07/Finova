import Link from 'next/link';

export function ModulePlaceholder({ title }: { title: string }) {
  return (
    <main className="min-h-screen p-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="text-sm text-slate-500 underline">
          Back to workspace
        </Link>
        <h1 className="mt-3 text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-slate-500">This module is a foundation placeholder; the screen is not built yet.</p>
      </div>
    </main>
  );
}
