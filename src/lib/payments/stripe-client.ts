/**
 * Stripe SDK isolation. The rest of the app talks to Stripe ONLY through this
 * module, so the network surface is one file and the charge math / webhook
 * reducer stay pure and testable. Pinned API version for reproducibility.
 */
import Stripe from "stripe";
import { env } from "@/env";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    if (!env.STRIPE_SECRET_KEY) {
      // Reachable only in PAYMENT_MODE="desk" (a bug — callers must guard
      // first) or a misconfigured stripe-mode deployment (env.ts should have
      // already refused to boot in that case). Either way, fail loudly rather
      // than construct a Stripe client with an empty key.
      throw new Error(
        "Stripe is not configured (STRIPE_SECRET_KEY is empty). getStripe() must not be called when PAYMENT_MODE=\"desk\".",
      );
    }
    client = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia", // matches the pinned SDK version
      typescript: true,
    });
  }
  return client;
}
