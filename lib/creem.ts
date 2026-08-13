/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Server-only Creem checkout helper.
 * Reads CEERM_API_KEY from process.env — call from App Router route handlers only,
 * never from client components.
 *
 * Creem Checkout API (v2): POST https://api.creem.live/v2/checkouts
 * Docs: https://docs.creem.live
 */

export interface CheckoutParams {
  productId: string;
  name: string;
  description: string;
  price: number;
  currency?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  checkoutUrl: string;
  id: string;
}

export async function createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
  const apiKey = process.env.CEERM_API_KEY;
  if (!apiKey) {
    throw new Error("CEERM_API_KEY is not configured");
  }

  const body: any = {
    product_id: params.productId,
    name: params.name,
    description: params.description,
    price: params.price,
    currency: params.currency ?? "USD",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    payment_method_types: ["card"],
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };

  const res = await fetch("https://api.creem.live/v2/checkouts", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Creem checkout failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { id: string; checkout_url?: string; hosted_url?: string };
  return {
    id: data.id,
    checkoutUrl: data.checkout_url ?? data.hosted_url ?? "",
  };
}
