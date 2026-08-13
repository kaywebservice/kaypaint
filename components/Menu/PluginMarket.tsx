"use client";

import { useMemo, useState } from "react";
import {
  Blend,
  BookMarked,
  Box,
  Brain,
  Brush,
  Calculator,
  Check,
  Code,
  Cpu,
  Crown,
  Download,
  Droplets,
  FileText,
  Filter,
  FolderOpen,
  Grid3x3,
  LayoutTemplate,
  ListChecks,
  MessagesSquare,
  Palette,
  PenLine,
  PenTool,
  Play,
  Printer,
  Search,
  Shapes,
  Shirt,
  Sparkles,
  Star,
  Type,
  Video,
  Wand2,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ALL_ACCESS, PLUGIN_CATALOG, PLUGIN_CATEGORIES, formatPrice, type PluginDef } from "@/engine/pluginCatalog";
import { usePluginStore } from "@/store/pluginStore";
import { isSignedIn } from "@/engine/licensing";
import { isPluginShipped } from "@/engine/pluginRuntime";

const ICONS: Record<string, LucideIcon> = {
  Filter,
  Zap,
  Palette,
  Brush,
  Grid3x3,
  Droplets,
  ListChecks,
  Cpu,
  Download,
  LayoutTemplate,
  PenTool,
  Brain,
  FileText,
  BookMarked,
  Calculator,
  Workflow,
  Shirt,
  FolderOpen,
  Blend,
  Code,
  Type,
  Box,
  MessagesSquare,
  Wand2,
  Printer,
  Shapes,
  Play,
  PenLine,
  Video,
  Crown,
};

function categoryOf(id: string) {
  return PLUGIN_CATEGORIES.find((c) => c.id === id);
}

function CatIcon({ id, size = 18 }: { id: string; size?: number }) {
  const I = ICONS[id] ?? Sparkles;
  return <I size={size} className="shrink-0" />;
}

export default function PluginMarket() {
  const marketOpen = usePluginStore((s) => s.marketOpen);
  const bundleFocus = usePluginStore((s) => s.bundleFocus);
  const closeMarket = usePluginStore((s) => s.closeMarket);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [selected, setSelected] = useState<PluginDef | "bundle" | null>(null);
  const [checkout, setCheckout] = useState<PluginDef | "bundle" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setQ("");
    setCat("all");
    setSelected(null);
    setCheckout(null);
    setSuccess(false);
    closeMarket();
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PLUGIN_CATALOG.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.tagline.toLowerCase().includes(needle) ||
        p.features.some((f) => f.toLowerCase().includes(needle))
      );
    });
  }, [q, cat]);

  if (!marketOpen) return null;

  const effectiveSelected: PluginDef | "bundle" | null =
    selected ?? (bundleFocus ? "bundle" : null);

  const owned = (id: string) => usePluginStore.getState().owns(id);

  const doCheckout = (target: PluginDef | "bundle") => {
    setCheckout(target);
    setSuccess(false);
  };

  const complete = () => {
    const target = checkout;
    if (!target) return;
    setProcessing(true);
    setTimeout(() => {
      const store = usePluginStore.getState();
      if (target === "bundle") store.purchaseBundle();
      else store.purchase(target.id);
      setProcessing(false);
      setSuccess(true);
    }, 900);
  };

  const finish = () => {
    setCheckout(null);
    setSelected(null);
    setSuccess(false);
  };

  const renderPrice = (price: { kind: string; amount?: number; monthly?: number }) =>
    price.kind === "sub" ? `$${price.monthly?.toFixed(2)}/mo` : `$${price.amount?.toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[86vh] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/70 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
          <span className="flex items-center gap-2 font-bold text-white">
            <Crown size={16} className="text-amber-300" />
            Plugin Market
          </span>
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search 92 plugins…"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-400/50"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-gray-400 border border-white/10 bg-white/5 rounded-md px-2 py-1">
              Simulated checkout · Creem ready
            </span>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Category chips */}
        <div className="px-5 py-3 border-b border-white/5 flex gap-1.5 overflow-x-auto shrink-0">
          <button
            onClick={() => setCat("all")}
            className={
              "px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors " +
              (cat === "all" ? "bg-indigo-500/20 text-indigo-200 border border-indigo-400/30" : "text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent")
            }
          >
            All
          </button>
          {PLUGIN_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(cat === c.id ? "all" : c.id)}
              className={
                "px-3 py-1.5 rounded-lg text-xs whitespace-nowrap inline-flex items-center gap-1.5 transition-colors " +
                (cat === c.id ? "bg-indigo-500/20 text-indigo-200 border border-indigo-400/30" : "text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent")
              }
            >
              <CatIcon id={c.icon} size={12} />
              {c.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Bundle banner */}
          {!usePluginStore.getState().bundleOwned && (!effectiveSelected || effectiveSelected === "bundle") && (
            <button
              onClick={() => setSelected("bundle")}
              className="w-full mb-5 text-left rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-amber-500/10 hover:border-amber-400/60 transition-colors p-5 flex items-center gap-4"
            >
              <span className="p-3 rounded-xl bg-amber-400/15 text-amber-300">
                <Crown size={22} />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-white">All-Access Bundle — {formatPrice(ALL_ACCESS.price)}</span>
                <span className="block text-xs text-gray-400 mt-0.5">Every plugin + all future releases. {ALL_ACCESS.tagline}</span>
              </span>
              <span className="text-indigo-300 text-xs border border-indigo-400/30 bg-indigo-500/10 rounded-lg px-3 py-1.5">View Bundle</span>
            </button>
          )}

          {effectiveSelected === "bundle" ? (
            <BundleDetail onBack={() => setSelected(null)} onBuy={() => doCheckout("bundle")} />
          ) : effectiveSelected ? (
            <PluginDetail p={effectiveSelected} onBack={() => setSelected(null)} onBuy={() => doCheckout(effectiveSelected)} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {list.map((p) => {
                const isOwned = owned(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="text-left rounded-xl border border-white/10 bg-white/5 hover:border-indigo-400/40 hover:bg-white/[0.07] transition-colors p-4 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="p-2 rounded-lg bg-indigo-500/15 text-indigo-300">
                        <CatIcon id={categoryOf(p.category)?.icon ?? ""} size={16} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-white truncate">{p.name}</span>
                        <span className="block text-[11px] text-gray-500">{categoryOf(p.category)?.label}</span>
                      </span>
                      {p.popular && (
                        <span className="text-[10px] text-amber-300 flex items-center gap-0.5">
                          <Star size={10} /> Hot
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 leading-snug line-clamp-2">{p.tagline}</span>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <span className="text-sm font-bold text-white">{formatPrice(p.price)}</span>
                      {isOwned ? (
                        <span className="text-[11px] text-emerald-300 flex items-center gap-1">
                          <Check size={12} /> Owned
                        </span>
                      ) : isPluginShipped(p.id) ? (
                        <span className="text-[11px] text-indigo-300 border border-indigo-400/30 bg-indigo-500/10 rounded-md px-2 py-0.5">
                          Buy
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-500 border border-white/10 bg-white/5 rounded-md px-2 py-0.5">
                          Soon
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {list.length === 0 && (
                <div className="col-span-full text-center py-16 text-gray-500 text-sm">No plugins match your search.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Checkout modal */}
      {checkout && !success && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <span className="font-semibold text-white">Checkout</span>
              <button onClick={() => setCheckout(null)} className="text-gray-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-300">
                  {checkout === "bundle" ? <Crown size={18} /> : <CatIcon id={categoryOf(checkout.category)?.icon ?? ""} size={18} />}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{checkout === "bundle" ? ALL_ACCESS.name : checkout.name}</div>
                  <div className="text-xs text-gray-400">
                    {checkout === "bundle" ? "One-time lifetime license" : renderPrice(checkout.price)}
                  </div>
                </div>
                <div className="text-lg font-bold text-white">
                  {checkout === "bundle" ? renderPrice(ALL_ACCESS.price) : renderPrice(checkout.price)}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                {[
                  { k: "Card number", v: "4242 4242 4242 4242" },
                  { k: "Cardholder", v: "Demo User" },
                  { k: "Expiry / CVC", v: "12 / 34 · 123" },
                ].map((f) => (
                  <div key={f.k} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{f.k}</span>
                    <span className="text-gray-200 font-mono">{f.v}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                  <span>Tax</span>
                  <span>$0.00</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span>Total</span>
                  <span>{checkout === "bundle" ? renderPrice(ALL_ACCESS.price) : renderPrice(checkout.price)}</span>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-gray-500 border border-indigo-400/20 bg-indigo-500/5 rounded-lg p-3">
                This is a <span className="text-indigo-300">simulated checkout</span>. No real payment is taken.
                When the store goes live, payments run through Creem Checkout and your licenses arrive on your account.
              </p>

              <button
                onClick={complete}
                disabled={processing}
                className="w-full py-2.5 rounded-xl font-semibold text-sm bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-60 transition-colors"
              >
                {processing ? "Processing…" : "Complete Purchase"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {checkout && success && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-800 border border-white/10 rounded-2xl shadow-2xl p-8 text-center space-y-4">
            <span className="inline-flex p-3.5 rounded-full bg-emerald-500/15 text-emerald-300">
              <Check size={26} />
            </span>
            <div className="font-bold text-white text-lg">Purchase Complete</div>
            <p className="text-xs text-gray-400">
              {checkout === "bundle" ? "All-Access Bundle" : checkout.name} is now installed and enabled.
              {isSignedIn() ? " License saved to your account — available on any device." : " License saved on this device. Sign in to sync it across devices."}
            </p>
            <button
              onClick={finish}
              className="w-full py-2.5 rounded-xl font-semibold text-sm bg-indigo-500 hover:bg-indigo-400 text-white transition-colors"
            >
              Explore Plugins
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BundleDetail({ onBack, onBuy }: { onBack: () => void; onBuy: () => void }) {
  const bundleOwned = usePluginStore((s) => s.bundleOwned);
  return (
    <DetailShell
      icon="Crown"
      iconClass="bg-amber-400/15 text-amber-300"
      name={ALL_ACCESS.name}
      tagline={ALL_ACCESS.tagline}
      price={formatPrice(ALL_ACCESS.price)}
      features={[...ALL_ACCESS.features, "Includes all 92 catalog plugins"]}
      owned={bundleOwned}
      onBack={onBack}
      onBuy={onBuy}
    />
  );
}

function PluginDetail({ p, onBack, onBuy }: { p: PluginDef; onBack: () => void; onBuy: () => void }) {
  const owns = usePluginStore((s) => s.purchased[p.id] || s.bundleOwned);
  const enabled = usePluginStore((s) => !!s.enabled[p.id]);
  const toggleEnabled = usePluginStore((s) => s.toggleEnabled);
  return (
    <DetailShell
      icon={categoryOf(p.category)?.icon ?? ""}
      iconClass="bg-indigo-500/15 text-indigo-300"
      name={p.name}
      tagline={p.tagline}
      price={formatPrice(p.price)}
      features={p.features}
      owned={owns}
      shipped={isPluginShipped(p.id)}
      badge={categoryOf(p.category)?.label}
      onBack={onBack}
      onBuy={onBuy}
      enabled={enabled}
      onToggle={() => toggleEnabled(p.id)}
    />
  );
}

function DetailShell({
  icon,
  iconClass,
  name,
  tagline,
  price,
  features,
  owned,
  onBack,
  onBuy,
  badge,
  enabled,
  onToggle,
  shipped = true,
}: {
  icon: string;
  iconClass: string;
  name: string;
  tagline: string;
  price: string;
  features: string[];
  owned: boolean;
  onBack: () => void;
  onBuy: () => void;
  badge?: string;
  enabled?: boolean;
  onToggle?: () => void;
  shipped?: boolean;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-white mb-4 inline-flex items-center gap-1">
        ← Back to market
      </button>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
        <div className="flex items-start gap-4">
          <span className={`p-4 rounded-2xl ${iconClass}`}>
            <CatIcon id={icon} size={28} />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{name}</h2>
              {badge && <span className="text-[10px] text-gray-400 border border-white/10 bg-white/5 rounded-md px-2 py-0.5">{badge}</span>}
            </div>
            <p className="text-sm text-gray-400 mt-1">{tagline}</p>
            <div className="mt-2 text-lg font-bold text-white">{price}</div>
          </div>
        </div>
        <div className="pt-4 border-t border-white/10">
          <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">What it can do</div>
          <ul className="space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2.5 pt-2">
          {owned ? (
            shipped ? (
              <>
                <button
                  onClick={onToggle}
                  className={
                    "flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors border " +
                    (enabled
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/25"
                      : "text-gray-300 border-white/15 hover:bg-white/10")
                  }
                >
                  {enabled ? "Enabled — Disable" : "Enable"}
                </button>
                <button onClick={onBack} className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-white/10 text-white hover:bg-white/15 transition-colors">
                  Back to market
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 py-2.5 rounded-xl text-center text-sm font-semibold text-gray-400 border border-white/10 bg-white/5">
                  Owned — code ships in a future update
                </div>
                <button onClick={onBack} className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-white/10 text-white hover:bg-white/15 transition-colors">
                  Back to market
                </button>
              </>
            )
          ) : shipped ? (
            <button onClick={onBuy} className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-indigo-500 hover:bg-indigo-400 text-white transition-colors">
              Buy for {price}
            </button>
          ) : (
            <div className="flex-1 py-2.5 rounded-xl text-center text-sm font-semibold text-gray-400 border border-white/10 bg-white/5">
              Coming soon — not yet available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}