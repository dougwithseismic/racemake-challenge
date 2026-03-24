"use client";

import { Link } from "lucide-react";

export function HeroSection() {
  const apiDocsUrl = "/docs";

  return (
    <div className="relative z-10 flex-1 flex flex-col justify-between px-5 pt-8 pb-20 md:px-12 md:pt-16 md:pb-36">
      {/* Top label */}
      <p className="text-xs font-medium tracking-[0.3em] text-neutral-500 uppercase">
        Racemake / Product Engineer
      </p>

      {/* Main heading */}
      <div className="mt-8 md:mt-0">
        <div className="flex gap-4">
          <span className="text-sm text-neutral-400 mt-2 md:mt-4">01</span>
          <div>
            <h1 className="text-[2.75rem] md:text-[5.5rem] leading-[0.95] font-light tracking-tight text-neutral-900">
              YOUR AI<br />RACE ENGINEER
            </h1>
            <div className="flex items-center gap-6 mt-6">
              <a
                href="#easy"
                className="bg-neutral-900 text-white text-sm font-medium rounded px-6 py-3 md:px-8 md:py-3.5 hover:bg-neutral-800 transition-colors"
              >
                Explore Challenges
              </a>
              <a
                href={apiDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                API Docs
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Middle stat */}
      <div className="hero-stat-group flex flex-col items-start md:items-center mt-10 md:mt-0">
        <p className="text-[2.75rem] md:text-[3.5rem] font-light tracking-tight text-neutral-900">10Hz</p>
        <p className="text-sm text-neutral-500 -mt-1">Telemetry</p>
      </div>

      {/* Bottom bar */}
      <div className="flex flex-col md:flex-row md:justify-between mt-10 md:mt-0 gap-8 md:gap-0">
        {/* Left: Track info */}
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs font-medium tracking-wider text-neutral-500 uppercase mb-2">Track Details</p>
            <div className="flex items-center gap-3">
              {[
                { label: "SPA", sub: "Track" },
                { label: "963", sub: "Car" },
                { label: "DRY", sub: "24°C" },
                { label: "10Hz", sub: "Rate" },
              ].map((item) => (
                <div key={item.label} className="w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-neutral-200 bg-neutral-100 flex items-center justify-center">
                  <span className="text-[8px] md:text-[9px] font-semibold text-neutral-600 tracking-wide">{item.label}</span>
                </div>
              ))}
              <span className="text-sm font-medium text-neutral-600 ml-1">Spa-Francorchamps</span>
            </div>
          </div>
        </div>

        {/* Right: Description */}
        <div className="hero-description-group flex items-start gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-neutral-300 flex items-center justify-center shrink-0">
            <Link className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-xs md:text-sm text-neutral-500 max-w-[200px] md:max-w-sm">
            PitGPT analyzes sim racing telemetry and delivers real-time coaching feedback — from debugging a sort comparator to building a full telemetry API from raw 10Hz frames.
          </p>
        </div>
      </div>
    </div>
  );
}
