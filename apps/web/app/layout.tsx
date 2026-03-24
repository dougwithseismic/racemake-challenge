import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { MobileNav } from "./components/MobileNav";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "PitGPT — RACEMAKE Challenge",
  description:
    "AI race engineer challenge solution. Telemetry analysis, coaching, and production architecture for sim racing at scale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiDocsUrl = "/docs";

  const links = [
    ["#easy", "Challenge 1"],
    ["#hard", "Challenge 2"],
    ["#architecture", "Architecture"],
    ["#irl", "IRL"],
    ["#portfolio", "Previous Work"],
  ];

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <nav className="sticky top-0 z-50 bg-black border-b border-border relative">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-lime shadow-[0_0_6px_var(--color-lime)] animate-pulse" />
              PitGPT
            </div>
            <ul className="hidden lg:flex">
              {links.map(([href, label]) => (
                <li key={href} className="border-l border-border">
                  <a href={href} className="block px-5 h-12 leading-[48px] text-t3 hover:text-t1 hover:bg-surface font-mono text-[11px] tracking-wider uppercase transition-colors">
                    {label}
                  </a>
                </li>
              ))}
              <li className="border-l border-border">
                <a href={apiDocsUrl} target="_blank" rel="noopener noreferrer" className="block px-5 h-12 leading-[48px] text-lime hover:text-lime font-mono text-[11px] tracking-wider uppercase transition-colors">
                  API Docs
                </a>
              </li>
            </ul>
            <MobileNav links={links} apiDocsUrl={apiDocsUrl} />
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
