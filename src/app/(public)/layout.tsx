import type { ReactNode } from "react";
import "./public.css";

export const metadata = { title: "Book a car | Tex Cars & Leasing" };

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="pub-header">
        <div className="wrap">
          <a className="logo" href="https://tex-cars.com" style={{ color: "#fff", textDecoration: "none" }}>
            TEX<b>CARS</b>
          </a>
          <span className="tag">We bring the car to you</span>
        </div>
      </header>
      {children}
    </>
  );
}
