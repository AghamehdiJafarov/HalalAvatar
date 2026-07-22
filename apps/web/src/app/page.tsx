import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Безликий AI-аватар</h1>
      <p className="text-neutral-600">Диалог с ассистентом в виде плоского 2D-персонажа без черт лица. Речь, жесты, видео — без генерации изображений.</p>
      <div className="flex gap-3">
        <Link href="/chat" className="rounded-lg bg-neutral-900 px-5 py-2 text-white">Начать чат</Link>
        <Link href="/studio" className="rounded-lg border border-neutral-300 px-5 py-2">Студия</Link>
      </div>
    </main>
  );
}
