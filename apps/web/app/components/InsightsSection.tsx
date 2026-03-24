"use client";

import { useState } from "react";

const tabs = [
  {
    label: "SSE Streaming",
    title: "Real-Time Telemetry via Server-Sent Events",
    description:
      "Live telemetry replay at 20Hz with incremental sector analysis, lap detection, and AI coaching at sector boundaries. Edge cases handled — out-laps, incomplete laps, stationary frames.",
    date: "Production Ready",
    author: "Hono + EventSource",
  },
  {
    label: "Binary Codec",
    title: "85% Wire Size Reduction with Lossless Roundtrip",
    description:
      "v1: fixed 19-byte frames vs ~131 bytes JSON. v2: delta-encoded at ~6 bytes average. Schema-versioned with forward compatibility — new fields don't break old decoders.",
    date: "v1 + v2 Delta",
    author: "Custom Wire Format",
  },
  {
    label: "Schema Registry",
    title: "Runtime Schema Extraction for Patch-Proof Pipelines",
    description:
      "Instead of hardcoding offsets that break every game update, extract the schema from the game itself at runtime. Field offsets resolve dynamically — the resolution mechanism survives patches.",
    date: "Reverse Engineering",
    author: "DLL Injection + RTTI",
  },
];

export function InsightsSection() {
  const [activeTab, setActiveTab] = useState(0);
  const tab = tabs[activeTab]!;

  return (
    <section style={{ backgroundColor: "#0F0F0F" }} className="px-8 md:px-16 lg:px-20 xl:px-28 pt-24 pb-32">
      {/* Large heading */}
      <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5rem] font-light italic tracking-tight text-white leading-[1.05] max-w-5xl mb-20 md:mb-28">
        PRODUCTION ARCHITECTURE BEYOND THE CHALLENGE
      </h2>

      {/* Tabs + Content */}
      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
        {/* Tab buttons */}
        <div className="flex lg:flex-col gap-2 lg:gap-0 lg:w-[160px] xl:w-[200px] shrink-0">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActiveTab(i)}
              className={`text-left text-sm lg:text-base py-2 lg:py-3 transition-colors ${
                i === activeTab ? "text-white font-medium" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12 flex-1">
          {/* Visual */}
          <div className="lg:w-[420px] xl:w-[480px] shrink-0">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-900 flex items-center justify-center">
              <div className="text-center px-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full border border-neutral-700 flex items-center justify-center">
                  <span className="text-2xl font-light text-white">{activeTab + 1}</span>
                </div>
                <p className="text-sm text-neutral-400">{tab.label}</p>
                <p className="text-xs text-neutral-600 mt-2">{tab.author}</p>
              </div>
            </div>
          </div>

          {/* Text */}
          <div className="flex flex-col justify-between">
            <div>
              <h3 className="text-2xl md:text-3xl font-light text-white leading-snug max-w-sm mb-6">
                {tab.title}
              </h3>
              <p className="text-sm md:text-base text-neutral-400 leading-relaxed max-w-sm mb-6">
                {tab.description}
              </p>
              <a href="#architecture" className="text-sm text-white font-medium underline underline-offset-4 hover:text-neutral-300 transition-colors">
                See It Live
              </a>
            </div>
            <div className="mt-8 pt-4 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-sm text-neutral-500">{tab.date}</span>
              <span className="text-sm text-neutral-500">{tab.author}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
