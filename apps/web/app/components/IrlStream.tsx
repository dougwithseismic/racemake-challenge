"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { TrackMap } from "./TrackMap";

interface Frame { ts: number; lap: number; pos: number; spd: number; sector: number }
interface Sector { lap: number; sector: number; time: number; frames: number; maxSpeed: number; avgThrottle: number }
interface LapComplete { lapNumber: number; lapTime: number; sectors: { sector: number; time: number }[]; avgSpeed: number; maxSpeed: number }
interface Coaching { bestLap: number; worstLap: number; problemSector: number; issue: string; delta: number; coachingMessage: string }
interface LapSkipped { lap: number; reason: string }
interface Done { totalLaps: number; message: string }

type StreamEvent =
  | { type: "frame"; data: Frame }
  | { type: "sector"; data: Sector }
  | { type: "lap_complete"; data: LapComplete }
  | { type: "coaching"; data: Coaching }
  | { type: "lap_skipped"; data: LapSkipped }
  | { type: "done"; data: Done };

export function IrlStream({ streamUrl = "/api/v2/irl/stream" }: { streamUrl?: string }) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [latestFrame, setLatestFrame] = useState<Frame | null>(null);
  const [laps, setLaps] = useState<LapComplete[]>([]);
  const [coaching, setCoaching] = useState<Coaching | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [events, scrollToBottom]);

  const connect = () => {
    if (esRef.current) return;
    setEvents([]);
    setLatestFrame(null);
    setLaps([]);
    setCoaching(null);
    setDone(null);
    setFrameCount(0);
    setConnected(true);

    const es = new EventSource(streamUrl);
    esRef.current = es;

    es.addEventListener("frame", (e) => {
      const data: Frame = JSON.parse(e.data);
      setLatestFrame(data);
      setFrameCount((c) => c + 1);
    });

    es.addEventListener("sector", (e) => {
      const data: Sector = JSON.parse(e.data);
      setEvents((prev) => [...prev, { type: "sector", data }]);
    });

    es.addEventListener("lap_complete", (e) => {
      const data: LapComplete = JSON.parse(e.data);
      setLaps((prev) => [...prev, data]);
      setEvents((prev) => [...prev, { type: "lap_complete", data }]);
    });

    es.addEventListener("coaching", (e) => {
      const data: Coaching = JSON.parse(e.data);
      setCoaching(data);
      setEvents((prev) => [...prev, { type: "coaching", data }]);
    });

    es.addEventListener("lap_skipped", (e) => {
      const data: LapSkipped = JSON.parse(e.data);
      setEvents((prev) => [...prev, { type: "lap_skipped", data }]);
    });

    es.addEventListener("done", (e) => {
      const data: Done = JSON.parse(e.data);
      setDone(data);
      setEvents((prev) => [...prev, { type: "done", data }]);
      es.close();
      esRef.current = null;
      setConnected(false);
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  };

  const disconnect = () => {
    esRef.current?.close();
    esRef.current = null;
    setConnected(false);
  };

  const sectorBar = (pos: number) => {
    const pct = Math.round(pos * 100);
    return (
      <div className="flex-1 h-1.5 bg-black border border-border overflow-hidden">
        <div className="h-full bg-lime transition-all duration-100" style={{ width: `${pct}%` }} />
      </div>
    );
  };

  return (
    <div className="pb-px">
      <div className="border border-border bg-bg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-t2">Live Telemetry Stream</span>
          <div className="flex items-center gap-3">
            {connected && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-lime">
                <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
                LIVE
              </span>
            )}
            <button
              onClick={connected ? disconnect : connect}
              className={`font-mono text-[11px] font-medium tracking-wider uppercase px-4 py-2 border transition-colors ${
                connected
                  ? "border-danger text-danger hover:bg-danger-dim"
                  : "border-lime bg-lime text-black hover:bg-[#00dd00]"
              }`}
            >
              {connected ? "Disconnect" : done ? "Replay" : "Connect"}
            </button>
          </div>
        </div>

        {/* Track map */}
        <TrackMap
          carPos={latestFrame?.pos ?? 0}
          speed={latestFrame?.spd ?? 0}
          sector={latestFrame?.sector ?? 1}
          lap={latestFrame?.lap ?? 0}
          active={connected}
        />

        {/* Live gauges */}
        {(latestFrame || done) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border-b border-border">
            <div className="bg-bg px-5 py-4 text-center">
              <p className="font-mono text-xl font-semibold tabular-nums mb-1">{frameCount}</p>
              <p className="font-mono text-[10px] tracking-widest uppercase text-t4">Frames</p>
            </div>
            <div className="bg-bg px-5 py-4 text-center">
              <p className="font-mono text-xl font-semibold tabular-nums mb-1 text-lime">{laps.length}</p>
              <p className="font-mono text-[10px] tracking-widest uppercase text-t4">Laps</p>
            </div>
            <div className="bg-bg px-5 py-4 text-center">
              <p className="font-mono text-xl font-semibold tabular-nums mb-1">{latestFrame ? `${latestFrame.spd}` : "—"}<span className="text-sm text-t3"> kph</span></p>
              <p className="font-mono text-[10px] tracking-widest uppercase text-t4">Speed</p>
            </div>
            <div className="bg-bg px-5 py-4 text-center">
              <p className="font-mono text-xl font-semibold tabular-nums mb-1">S{latestFrame?.sector ?? "—"}</p>
              <p className="font-mono text-[10px] tracking-widest uppercase text-t4">Sector</p>
            </div>
          </div>
        )}

        {/* Track position bar */}
        {latestFrame && connected && (
          <div className="px-6 py-3 border-b border-border flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-wider text-t4 shrink-0">POS</span>
            {sectorBar(latestFrame.pos)}
            <span className="font-mono text-[11px] tabular-nums text-t3 shrink-0 w-12 text-right">{(latestFrame.pos * 100).toFixed(1)}%</span>
          </div>
        )}

        {/* Lap table */}
        {laps.length > 0 && (
          <div className="border-b border-border overflow-x-auto">
            <table className="w-full font-mono text-[13px] border-collapse min-w-[500px]">
              <thead>
                <tr>
                  {["Lap", "Time", "S1", "S2", "S3", "Avg", "Max"].map((h, i) => (
                    <th key={h} className={`${i > 0 ? "text-right" : "text-left"} px-4 sm:px-6 py-2.5 text-[10px] font-semibold tracking-widest uppercase text-t4 border-b border-border`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-t2">
                {laps.map((lap) => {
                  const best = laps.length > 1 && lap.lapTime === Math.min(...laps.map((l) => l.lapTime));
                  return (
                    <tr key={lap.lapNumber}>
                      <td className="px-4 sm:px-6 py-2.5 border-b border-border">
                        {lap.lapNumber}
                        {best && <span className="ml-2 font-mono text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 border text-lime border-lime/20 bg-lime-dim">Best</span>}
                      </td>
                      <td className={`text-right px-4 sm:px-6 py-2.5 border-b border-border tabular-nums ${best ? "text-lime" : ""}`}>{lap.lapTime.toFixed(3)}s</td>
                      {lap.sectors.map((s) => (
                        <td key={s.sector} className="text-right px-4 sm:px-6 py-2.5 border-b border-border tabular-nums">{s.time.toFixed(3)}s</td>
                      ))}
                      <td className="text-right px-4 sm:px-6 py-2.5 border-b border-border tabular-nums">{lap.avgSpeed} kph</td>
                      <td className="text-right px-4 sm:px-6 py-2.5 border-b border-border tabular-nums">{lap.maxSpeed} kph</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Coaching message */}
        {coaching && (
          <div className="p-5 border-b border-border">
            <div className="p-5 bg-black border border-border border-l-2 border-l-lime relative italic text-sm font-light text-t2 leading-relaxed">
              <span className="absolute -top-2.5 left-4 font-mono text-[10px] font-semibold tracking-widest text-lime bg-bg px-2 not-italic uppercase">PitGPT — Live</span>
              <p className="mb-2">{coaching.coachingMessage}</p>
              <p className="not-italic font-mono text-[11px] text-t3">
                Problem: S{coaching.problemSector} — {coaching.issue.replace("_", " ")} — +{coaching.delta.toFixed(3)}s vs best
              </p>
            </div>
          </div>
        )}

        {/* Event log */}
        {events.length > 0 && (
          <div className="border-b border-border">
            <div className="px-6 py-2.5 border-b border-border">
              <span className="font-mono text-[10px] font-semibold tracking-widest uppercase text-t4">Event Log</span>
            </div>
            <div ref={logRef} className="max-h-48 overflow-y-auto font-mono text-[12px] leading-relaxed">
              {events.map((ev, i) => {
                let icon = "";
                let color = "text-t3";
                let text = "";
                switch (ev.type) {
                  case "sector":
                    icon = "◆"; color = "text-t2";
                    text = `Lap ${ev.data.lap} S${ev.data.sector} — ${ev.data.time.toFixed(3)}s — max ${ev.data.maxSpeed} kph`;
                    break;
                  case "lap_complete":
                    icon = "✓"; color = "text-lime";
                    text = `Lap ${ev.data.lapNumber} complete — ${ev.data.lapTime.toFixed(3)}s`;
                    break;
                  case "coaching":
                    icon = "▶"; color = "text-warn";
                    text = `Coaching: S${ev.data.problemSector} ${ev.data.issue.replace("_", " ")} (+${ev.data.delta.toFixed(3)}s)`;
                    break;
                  case "lap_skipped":
                    icon = "✕"; color = "text-t4";
                    text = `Lap ${ev.data.lap} skipped — ${ev.data.reason}`;
                    break;
                  case "done":
                    icon = "■"; color = "text-info";
                    text = `Stream complete — ${ev.data.totalLaps} laps processed`;
                    break;
                }
                return (
                  <div key={i} className={`px-6 py-1.5 border-b border-border last:border-b-0 ${color}`}>
                    <span className="inline-block w-4">{icon}</span> {text}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!latestFrame && !done && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm font-light text-t3">Connect to stream real-time telemetry from the server. Frames arrive at 20Hz with live sector analysis and coaching.</p>
          </div>
        )}
      </div>
    </div>
  );
}
