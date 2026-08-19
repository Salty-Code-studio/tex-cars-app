/**
 * Public brand configuration. Values come from NEXT_PUBLIC_* env vars, which
 * Next.js inlines at build time, so this module is safe in client AND server
 * code. A white-label deploy becomes an env change instead of string surgery.
 *
 * Fallback defaults below are TEX CARS values, not FleetDesk's: without the
 * env vars set, Tex must still render its own brand everywhere siteConfig is
 * used (public header, emails, Stripe checkout product names).
 */
function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tex-cars.com";
const whatsappDigits = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/[^0-9]/g, "");

/** Human-readable phone from the wa.me digits. Aruba numbers (297 + 7 local
 *  digits) get the local 3+4 grouping ("+297 594 5454"); any other country
 *  renders as plain +digits, since per-country grouping rules are not worth
 *  carrying here. Null when no number is configured. */
function formatPhoneDisplay(digits: string): string | null {
  if (!digits) return null;
  const aruba = /^297(\d{3})(\d{4})$/.exec(digits);
  return aruba ? `+297 ${aruba[1]} ${aruba[2]}` : `+${digits}`;
}

export interface SiteConfig {
  siteName: string;
  siteUrl: string;
  backLinkLabel: string;
  whatsappHref: string | null;
  /** Written-out contact number for email/print surfaces ("+297 594 5454").
   *  Derived from NEXT_PUBLIC_WHATSAPP_NUMBER; unlike whatsappHref (which
   *  stays null so UIs can drop their button), this falls back to the Tex
   *  number, per this file's Tex-defaults convention above: a contact line
   *  in a sent email must never render empty. */
  whatsappDisplay: string;
}

export const siteConfig: SiteConfig = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Tex Cars",
  siteUrl,
  backLinkLabel: `Back to ${hostOf(siteUrl)}`,
  whatsappHref: whatsappDigits ? `https://wa.me/${whatsappDigits}` : null,
  whatsappDisplay: formatPhoneDisplay(whatsappDigits) ?? "+297 594 5454",
};
