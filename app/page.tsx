import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black text-white">
      <main className="flex max-w-xl flex-col items-center gap-8 text-center px-6">
        <h1 className="text-6xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          KayPaint
        </h1>

        <p className="text-lg text-zinc-400">
          A Photoshop-style image editor in your browser — brushes, text,
          shapes, layers, filters, gradients, crop and AI background removal.
        </p>

        <Link
          href="/editor"
          className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold hover:bg-blue-500 transition"
        >
          Open Editor
        </Link>

        <div className="text-sm text-zinc-500">
          <span className="font-mono">V</span> Move ·{" "}
          <span className="font-mono">B</span> Brush ·{" "}
          <span className="font-mono">E</span> Eraser ·{" "}
          <span className="font-mono">T</span> Text ·{" "}
          <span className="font-mono">U</span> Shape ·{" "}
          <span className="font-mono">C</span> Crop ·{" "}
          <span className="font-mono monospace">Ctrl+Z</span> Undo
        </div>
      </main>
    </div>
  );
}