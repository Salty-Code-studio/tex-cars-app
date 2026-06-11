import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { resolveSession } from "@/lib/auth/sessions";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { getDb } from "@/lib/db/client";
import { adminUsers } from "@/lib/db/schema";
import { LogoutButton } from "./logout-button";
import "../admin.css";

export const metadata = { title: "Tex Cars Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The gate for everything inside the shell: a live, fully-authenticated admin
 * session with MFA enrolled. Anything less bounces to login/MFA server-side,
 * before any dashboard data is rendered.
 */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = await resolveSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || session.subjectType !== "admin") redirect("/admin/login");
  if (session.mfaPending) redirect("/admin/mfa");

  const db = await getDb();
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.subjectId));
  if (!admin) redirect("/admin/login");
  if (!admin.mfaEnabled) redirect("/admin/mfa"); // enrollment is mandatory

  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">TEX<b>CARS</b> Admin</div>
        <a href="/admin" className="active">Dashboard</a>
        <a href="#" className="soon">Bookings (Plan 04)</a>
        <a href="#" className="soon">Fleet (Plan 03)</a>
        <a href="#" className="soon">Settings (Plan 03)</a>
        <div className="foot">{admin.email} · {admin.role}</div>
      </aside>
      <main className="main">
        <div className="topbar">
          <LogoutButton />
        </div>
        {children}
      </main>
    </div>
  );
}
