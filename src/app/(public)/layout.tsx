import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Inter } from "next/font/google";
import { siteConfig } from "@/lib/site-config";
import "./public.css";

// Fonts self-host at build time via next/font/google. They serve from 'self'
// with inline @font-face, so they pass the strict UI CSP. No external loads.
const display = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

const body = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

// Kept literal (not siteConfig.siteName): matches the root app shell's title
// ("Tex Cars & Leasing" in src/app/layout.tsx), which siteConfig's short brand
// name does not carry.
export const metadata: Metadata = { title: "Book a car | Tex Cars & Leasing" };

const fontVars = `${display.variable} ${mono.variable} ${body.variable}`;

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`pub ${fontVars}`}>
      <header className="pub-header">
        <div className="pub-header-inner">
          {/* href/aria-label are env-driven (siteConfig); the two-tone TEX/CARS
              wordmark stays Tex's own styled mark, not siteConfig's plain text. */}
          <a className="pub-brand" href={siteConfig.siteUrl} aria-label={`${siteConfig.siteName} home`}>
            <span className="pub-brand-mark" aria-hidden="true">
              ~&lt;
            </span>
            <span className="pub-brand-word">TEX<b>CARS</b></span>
          </a>
          <span className="pub-tag">We bring the car to you</span>
        </div>
      </header>
      {children}
    </div>
  );
}
