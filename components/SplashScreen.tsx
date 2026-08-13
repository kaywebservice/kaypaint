"use client";

import { useEffect, useState } from "react";
import { Sparkles, MousePointerClick } from "lucide-react";

const TIPS = [
  "Press Ctrl + scroll to zoom the canvas",
  "Press the play button in the Timeline to see your animation",
  "Select an object, scrub the playhead, then press + Keyframe to animate it",
  "Remove backgrounds instantly from the Image menu",
  "Single-letter keys switch tools fast (B brush, T text, M marquee…)",
  "Press V to drag objects, Ctrl+D to duplicate",
];

export default function SplashScreen() {
  const [progress, setProgress] = useState(0);
  const [tip, setTip] = useState(0);
  const [fade, setFade] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const tipTimer = setInterval(
      () => setTip((t) => (t + 1) % TIPS.length),
      850
    );

    const DURATION = 2600;
    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      setProgress(p * 100);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(() => setFade(true), 400);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      clearInterval(tipTimer);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!fade) return;
    const t = setTimeout(() => setDone(true), 650);
    return () => clearTimeout(t);
  }, [fade]);

  const skip = () => {
    setProgress(100);
    setFade(true);
  };

  if (done) return null;

  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${
        fade ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse at 50% 38%, rgba(99,102,241,0.16) 0%, transparent 62%), radial-gradient(ellipse at 82% 88%, rgba(192,132,252,0.12) 0%, transparent 55%), #0b0e14",
      }}
    >
      {/* Decorative orbs */}
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-fuchsia-600/15 blur-3xl" />

      {/* Logo */}
      <div className="relative mb-7">
        <div className="absolute inset-0 -m-4 rounded-3xl accent-gradient opacity-40 blur-xl" />
        <div className="relative w-16 h-16 rounded-2xl accent-gradient flex items-center justify-center shadow-2xl shadow-indigo-500/40 ring-1 ring-white/20">
          <Sparkles size={28} strokeWidth={2.2} className="text-white" />
        </div>
      </div>

      <h1 className="text-4xl font-extrabold tracking-tight text-gradient select-none">
        KayPaint
      </h1>
      <p className="mt-2 text-[13px] text-gray-400 tracking-wide select-none">
        The browser-based design studio
      </p>

      {/* Progress bar */}
      <div className="mt-10 w-72">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden relative">
          <div
            className="h-full rounded-full accent-gradient transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute inset-y-0 w-1/3 bg-white/50 blur-md animate-[barflow_1.1s_linear_infinite]"
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-gray-500">
          <span>{Math.round(progress)}%</span>
          <button
            onClick={skip}
            className="uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Cycling tips */}
      <div
        key={tip}
        className="mt-9 flex items-center gap-2 text-xs text-gray-400 tip-in select-none"
      >
        <MousePointerClick size={13} className="text-indigo-300/70" />
        <span>
          {TIPS[tip]}
        </span>
      </div>

      <div className="absolute bottom-6 text-[10px] text-gray-600 select-none">
        Loading workspace…
      </div>
    </div>
  );
}