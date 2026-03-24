"use client";

import { Play } from "lucide-react";

export function AboutSection() {
  return (
    <section id="about" className="w-full" style={{ backgroundColor: "#0F0F0F" }}>
      <div className="flex flex-col lg:flex-row min-h-[600px] lg:min-h-[700px]">
        {/* Left: Video */}
        <div className="lg:w-1/2 h-[400px] lg:h-auto relative overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover mix-blend-lighten"
          >
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_132809_d6ea910f-d700-44f7-afea-27d517487177.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Right: Content */}
        <div className="lg:w-1/2 flex items-center">
          <div className="px-8 py-16 md:px-16 lg:px-20 xl:px-28 max-w-lg">
            <p className="text-xs font-medium tracking-[0.3em] text-neutral-500 uppercase mb-8 md:mb-10">
              About PitGPT
            </p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-light tracking-tight text-white leading-[1.05] mb-10 md:mb-12">
              AI RACE<br />ENGINEERING
            </h2>

            <div className="flex flex-wrap gap-3 mb-8">
              {["Telemetry", "Coaching", "Real-time"].map((tag) => (
                <span
                  key={tag}
                  className="px-5 py-2 rounded-full border border-neutral-700 text-sm text-neutral-300 hover:border-neutral-500 transition-colors"
                >
                  {tag}
                </span>
              ))}
            </div>

            <p className="text-sm md:text-base text-neutral-400 leading-relaxed max-w-md mb-10">
              Two challenges solved — from debugging a sort comparator to building a telemetry API from raw 10Hz frames. Plus a production architecture with SSE streaming, binary codecs, and a schema registry. Everything below is interactive.
            </p>

            <div className="flex items-center gap-6">
              <a
                href="#easy"
                className="bg-neutral-800 text-white text-sm font-medium rounded px-7 py-3.5 hover:bg-neutral-700 transition-colors"
              >
                Start Exploring
              </a>
              <a
                href="#architecture"
                className="flex items-center gap-3 text-sm text-neutral-300 hover:text-white transition-colors"
              >
                <span className="w-10 h-10 rounded-full border border-neutral-700 flex items-center justify-center hover:border-neutral-500 transition-colors">
                  <Play className="w-3.5 h-3.5 ml-0.5" />
                </span>
                Live Telemetry
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
