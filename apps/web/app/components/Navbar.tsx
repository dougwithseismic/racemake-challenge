"use client";

import { useState } from "react";
import { Search, Menu, X } from "lucide-react";

const navLinks = [
  { href: "#about", label: "About" },
  { href: "#easy", label: "Challenge 1" },
  { href: "#hard", label: "Challenge 2" },
  { href: "#architecture", label: "Architecture" },
  { href: "#irl", label: "IRL" },
  { href: "#portfolio", label: "Portfolio" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="relative z-10 flex items-center justify-between px-5 py-4 md:px-12 md:py-6">
      {/* Left: Logo + Links */}
      <div className="flex items-center gap-12">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff00] shadow-[0_0_6px_#00ff00] animate-pulse" />
          <span className="font-mono text-sm font-semibold tracking-widest uppercase text-neutral-900">PitGPT</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* Right: Search + Mobile toggle */}
      <div className="flex items-center gap-3">
        <div className="hidden md:block relative">
          <input
            type="text"
            placeholder="I am looking for..."
            className="w-72 rounded-full border border-neutral-300 bg-transparent px-5 py-2.5 pr-12 text-sm text-neutral-600 placeholder:text-neutral-400 outline-none focus:border-neutral-500 transition-colors"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden w-10 h-10 rounded-full border border-neutral-300 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#FBFDFD] border-b border-neutral-200 z-50 md:hidden">
          <div className="flex flex-col">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-5 py-3.5 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 border-b border-neutral-100 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="px-5 py-3.5 text-sm text-[#00ff00] hover:bg-neutral-50 border-b border-neutral-100 transition-colors"
            >
              API Docs
            </a>
          </div>
          <div className="p-4">
            <div className="relative">
              <input
                type="text"
                placeholder="I am looking for..."
                className="w-full rounded-full border border-neutral-300 bg-transparent px-5 py-2.5 pr-12 text-sm text-neutral-600 placeholder:text-neutral-400 outline-none"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
