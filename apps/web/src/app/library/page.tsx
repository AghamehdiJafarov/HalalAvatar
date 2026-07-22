"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Conv { id: string; title: string; createdAt: string }

export default function LibraryPage() {
  const [convs, setConvs] = useState<Conv[]>([]);
  useEffect(() => { fetch("/api/conversations").then((r) => r.ok ? r.json() : { conversations: [] }).then((d) => setConvs(d.conversations ?? [])); }, []);
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Диалоги</h1>
      <ul className="flex flex-col gap-2">
        {convs.map((c) => (
          <li key={c.id}><Link href="/chat" className="block rounded-lg border border-neutral-200 px-3 py-2 hover:border-neutral-400">{c.title}</Link></li>
        ))}
        {!convs.length && <li className="text-neutral-500">Пока нет диалогов.</li>}
      </ul>
    </main>
  );
}
