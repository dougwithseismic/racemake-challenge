"use client";

import { useState } from "react";

export function MobileNav({ links, apiDocsUrl }: { links: string[][]; apiDocsUrl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 flex items-center justify-center text-t2 hover:text-t1 transition-colors"
        aria-label="Toggle menu"
      >
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none" className={open ? "hidden" : "block"}>
          <path d="M0 0h18v2H0zM0 5h18v2H0zM0 10h18v2H0z" fill="currentColor" />
        </svg>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={open ? "block" : "hidden"}>
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-12 left-0 right-0 bg-black border-b border-border z-50">
          <ul className="flex flex-col">
            {links.map(([href, label]) => (
              <li key={href} className="border-b border-border">
                <a
                  href={href}
                  onClick={() => setOpen(false)}
                  className="block px-6 h-12 leading-[48px] text-t3 hover:text-t1 hover:bg-surface font-mono text-[11px] tracking-wider uppercase transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
            <li className="border-b border-border">
              <a
                href={apiDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-6 h-12 leading-[48px] text-lime hover:text-lime font-mono text-[11px] tracking-wider uppercase transition-colors"
              >
                API Docs
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
