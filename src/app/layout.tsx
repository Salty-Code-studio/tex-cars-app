import type { ReactNode } from "react";

export const metadata = {
  title: "Hardened API Starter",
  description: "Secure-by-default Next.js Route Handlers API.",
};

// Minimal root layout so the App Router is satisfied. This starter is API-first;
// there is no client UI to attack-surface here.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
