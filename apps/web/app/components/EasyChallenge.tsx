"use client";

import { useState } from "react";

interface SectorFinding { sector: number; delta: number; issue: string; details: string }
interface LapAnalysis { findings: SectorFinding[]; totalDelta: number }
interface CoachingOutput { problemSector: number; issue: string; timeLost: number; coachingMessage: string }
interface StintTrend { sector: number; issue: string; trend: "worsening" | "stable" | "improving"; deltaProgression: number[] }

interface AnalyzeRes { lap: { totalTime: number }; analysis: LapAnalysis; coaching: CoachingOutput }
interface StintRes { stint: { lapAnalyses: { lapLabel: string; analysis: LapAnalysis; coaching: CoachingOutput }[]; trends: StintTrend[]; stintSummary: string } }
interface DataRes { referenceLap: { totalTime: number } }

const trendColors = { worsening: "text-danger border-danger/20 bg-danger-dim", improving: "text-lime border-lime/20 bg-lime-dim", stable: "text-t4 border-border bg-surface" };
const trendArrows = { worsening: "↑", improving: "↓", stable: "→" };

export function EasyChallenge() {
  const [codeView, setCodeView] = useState<"buggy" | "fixed">("buggy");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showStint, setShowStint] = useState(false);
  const [analyzeData, setAnalyzeData] = useState<AnalyzeRes | null>(null);
  const [stintData, setStintData] = useState<StintRes | null>(null);
  const [lapData, setLapData] = useState<DataRes | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    if (analyzeData) { setShowAnalysis(true); return; }
    setLoading("analyze");
    try {
      const [a, d] = await Promise.all([fetch("/api/v2/easy/analyze"), fetch("/api/v2/easy/data")]);
      setAnalyzeData(await a.json()); setLapData(await d.json()); setShowAnalysis(true);
    } catch (e) { console.error(e); } finally { setLoading(null); }
  };

  const fetchStint = async () => {
    if (stintData) { setShowStint(true); return; }
    setLoading("stint");
    try { const r = await fetch("/api/v2/easy/stint"); setStintData(await r.json()); setShowStint(true); }
    catch (e) { console.error(e); } finally { setLoading(null); }
  };

  const a = analyzeData?.analysis;
  const c = analyzeData?.coaching;
  const s = stintData?.stint;

  return (
    <div className="pb-px">
      {/* Bug card */}
      <div className="border border-border bg-bg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-t2">Level 1 — Find & fix the bug</span>
          <span className="font-mono text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 border text-danger border-danger/20 bg-danger-dim">Bug</span>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm font-light text-t2 leading-relaxed">
            The analysis pipeline runs but validation fails. <code className="font-mono text-xs bg-surface border border-border px-1.5 py-0.5">generateCoaching</code> picks <code className="font-mono text-xs bg-surface border border-border px-1.5 py-0.5">findings[0]</code> as the worst sector — but the sort puts the smallest delta first.
          </p>
        </div>
      </div>

      {/* Code tabs + block */}
      <div className="flex border border-border border-t-0">
        <button onClick={() => setCodeView("buggy")} className={`flex-1 py-3 font-mono text-xs tracking-wider uppercase text-center border-r border-border transition-colors ${codeView === "buggy" ? "bg-bg text-danger" : "bg-black text-t4 hover:text-t3"}`}>Original (Buggy)</button>
        <button onClick={() => setCodeView("fixed")} className={`flex-1 py-3 font-mono text-xs tracking-wider uppercase text-center transition-colors ${codeView === "fixed" ? "bg-bg text-lime" : "bg-black text-t4 hover:text-t3"}`}>Fixed</button>
      </div>
      <div className="border border-border border-t-0 bg-black">
        <div className="flex justify-between px-5 py-3 border-b border-border font-mono text-[11px] tracking-wider uppercase text-t4">
          <span>challenge.ts — analyzeLap()</span>
          <span>{codeView === "buggy" ? "Line 42" : "Line 42 (fixed)"}</span>
        </div>
        <pre className="p-5 font-mono text-[13px] leading-loose text-t2 overflow-x-auto">
          {codeView === "buggy" ? (
            <>{"  // Sort by time lost — worst sector first\n"}<span className="block -mx-5 px-5 bg-danger-dim text-danger">{"  findings.sort((a, b) => a.delta - b.delta);"}</span>{"\n  // ↑ ascending sort → smallest delta first\n  // findings[0] is sector 3 (+0.070s) not sector 2 (+1.198s)\n  // generateCoaching picks the wrong sector"}</>
          ) : (
            <>{"  // Sort by time lost — worst sector first\n"}<span className="block -mx-5 px-5 bg-lime-dim text-lime">{"  findings.sort((a, b) => b.delta - a.delta);"}</span>{"\n  // ↑ descending sort → largest delta first\n  // findings[0] is now sector 2 (+1.198s) ✓\n  // One-line fix. Ship it."}</>
          )}
        </pre>
      </div>

      {/* Analysis */}
      <div className="border border-border border-t-0 bg-bg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-t2">Live analysis output</span>
          <button onClick={() => showAnalysis ? setShowAnalysis(false) : fetchAnalysis()} disabled={loading === "analyze"}
            className={`font-mono text-[11px] font-medium tracking-wider uppercase px-4 py-2 border transition-colors ${showAnalysis ? "border-border bg-bg text-t2 hover:text-t1" : "border-lime bg-lime text-black hover:bg-[#00dd00]"}`}>
            {loading === "analyze" ? "Loading..." : showAnalysis ? "Hide" : "Run Analysis"}
          </button>
        </div>

        {showAnalysis && a && c && lapData && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
              {[
                { v: `${lapData.referenceLap.totalTime.toFixed(3)}s`, l: "Reference", color: "text-t3" },
                { v: `${analyzeData!.lap.totalTime.toFixed(3)}s`, l: "Driver Lap", color: "text-t1" },
                { v: `+${a.totalDelta.toFixed(3)}s`, l: "Total Delta", color: "text-danger" },
                { v: `S${c.problemSector}`, l: "Problem Sector", color: "text-warn" },
              ].map((s) => (
                <div key={s.l} className="bg-bg px-5 py-4 text-center">
                  <p className={`font-mono text-xl font-semibold tabular-nums mb-1 ${s.color}`}>{s.v}</p>
                  <p className="font-mono text-[10px] tracking-widest uppercase text-t4">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="p-5 flex flex-col gap-1">
              {a.findings.map((f) => {
                const max = Math.max(...a.findings.map((x) => x.delta));
                const pct = (f.delta / max) * 100;
                const bg = f.delta > 1 ? "bg-danger" : f.delta > 0.3 ? "bg-warn" : "bg-lime";
                return (
                  <div key={f.sector} className="flex items-center gap-3">
                    <span className="font-mono text-[10px] tracking-wider text-t4 w-5 shrink-0">S{f.sector}</span>
                    <div className="flex-1 h-6 bg-black border border-border overflow-hidden">
                      <div className={`h-full ${bg} flex items-center justify-end pr-2 font-mono text-[10px] font-medium text-black min-w-[60px] transition-all duration-500`} style={{ width: `${Math.max(pct, 15)}%` }}>
                        {f.issue.replace("_", " ")}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-danger w-16 text-right shrink-0">+{f.delta.toFixed(3)}s</span>
                  </div>
                );
              })}
            </div>
            <div className="mx-5 mb-5 p-5 bg-black border border-border border-l-2 border-l-lime relative italic text-sm font-light text-t2 leading-relaxed">
              <span className="absolute -top-2.5 left-4 font-mono text-[10px] font-semibold tracking-widest text-lime bg-bg px-2 not-italic uppercase">PitGPT</span>
              {c.coachingMessage}
            </div>
          </>
        )}
      </div>

      {/* Stint */}
      <div className="border border-border border-t-0 bg-bg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-t2">Level 2 — Stint analysis</span>
          <button onClick={() => showStint ? setShowStint(false) : fetchStint()} disabled={loading === "stint"}
            className={`font-mono text-[11px] font-medium tracking-wider uppercase px-4 py-2 border transition-colors ${showStint ? "border-border bg-bg text-t2 hover:text-t1" : "border-lime bg-lime text-black hover:bg-[#00dd00]"}`}>
            {loading === "stint" ? "Loading..." : showStint ? "Hide" : "Analyze Stint"}
          </button>
        </div>
        {!showStint && (
          <div className="px-6 py-5">
            <p className="text-sm font-light text-t2 leading-relaxed">Two laps from the same stint: Lap 1 (fresh tyres) vs Lap 14 (degraded). Detect how issues evolve as the stint progresses.</p>
          </div>
        )}
        {showStint && s && (
          <>
            <div className="grid grid-cols-2 gap-px bg-border">
              {s.lapAnalyses.map((la) => (
                <div key={la.lapLabel} className="bg-bg px-5 py-4">
                  <p className="font-mono text-[11px] font-semibold tracking-wider uppercase mb-1">{la.lapLabel}</p>
                  <p className="font-mono text-[11px] text-t3">Delta: <span className="text-danger">+{la.analysis.totalDelta.toFixed(3)}s</span></p>
                  <p className="font-mono text-[11px] text-t3">Worst: S{la.coaching.problemSector} — {la.coaching.issue.replace("_", " ")}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
            <table className="w-full font-mono text-[13px] border-collapse min-w-[500px]">
              <thead>
                <tr>
                  {["Sector", "Issue", "Trend", "Lap 1", "Lap 14"].map((h, i) => (
                    <th key={h} className={`${i >= 3 ? "text-right" : "text-left"} px-4 sm:px-6 py-3 text-[10px] font-semibold tracking-widest uppercase text-t4 border-b border-border`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-t2">
                {s.trends.map((t) => (
                  <tr key={t.sector}>
                    <td className="px-4 sm:px-6 py-3 border-b border-border">S{t.sector}</td>
                    <td className="px-4 sm:px-6 py-3 border-b border-border">{t.issue.replace("_", " ")}</td>
                    <td className="px-4 sm:px-6 py-3 border-b border-border">
                      <span className={`font-mono text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 border ${trendColors[t.trend]}`}>
                        {trendArrows[t.trend]} {t.trend}
                      </span>
                    </td>
                    <td className="text-right px-4 sm:px-6 py-3 border-b border-border text-danger tabular-nums">+{t.deltaProgression[0]?.toFixed(3)}s</td>
                    <td className="text-right px-4 sm:px-6 py-3 border-b border-border text-danger tabular-nums">+{t.deltaProgression[t.deltaProgression.length - 1]?.toFixed(3)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="p-5">
              <div className="p-5 bg-black border border-border border-l-2 border-l-lime relative italic text-sm font-light text-t2 leading-relaxed">
                <span className="absolute -top-2.5 left-4 font-mono text-[10px] font-semibold tracking-widest text-lime bg-bg px-2 not-italic uppercase">PitGPT</span>
                {s.stintSummary}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
