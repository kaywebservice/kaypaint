/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createCheckout } from "@/lib/creem";

export const maxDuration = 30;
export const runtime = "nodejs";

interface Body {
  productId: string;
  name: string;
  description: string;
  price: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  try {
    const result = await createCheckout(body);
    return NextResponse.json(result);
  } catch (e: any) {
    const msg = e?.message ?? "checkout error";
    const status = /CEERM_API_KEY is not configured/.test(msg) ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
