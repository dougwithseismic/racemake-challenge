import { Hono } from "hono";
import type { TelemetryFrame } from "./telemetry.js";

export type { TelemetryFrame };

// ============================================================
// TYPES
// ============================================================

export interface SectorSummary {
  sector: number;
  time: number;
}

export interface LapSummary {
  lapNumber: number;
  lapTime: number;
  sectors: SectorSummary[];
  avgSpeed: number;
  maxSpeed: number;
}

export type Issue = "heavy_braking" | "low_throttle" | "tyre_overheat" | "inconsistency";

export interface AnalysisResult {
  bestLap: { lapNumber: number; lapTime: number };
  worstLap: { lapNumber: number; lapTime: number; delta: number };
  problemSector: number;
  issue: Issue;
  coachingMessage: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const S1_S2_BOUNDARY = 0.333;
const S2_S3_BOUNDARY = 0.667;

// ============================================================
// STORE
// ============================================================

let frames: TelemetryFrame[] = [];

// ============================================================
// HELPERS
// ============================================================

export function isStationary(frame: TelemetryFrame, prevFrame?: TelemetryFrame): boolean {
  if (frame.spd < 5 && prevFrame && Math.abs(frame.pos - prevFrame.pos) < 0.001) {
    return true;
  }
  return false;
}

export function getSector(pos: number): number {
  if (pos < S1_S2_BOUNDARY) return 1;
  if (pos < S2_S3_BOUNDARY) return 2;
  return 3;
}

export function filterFrames(raw: TelemetryFrame[]): TelemetryFrame[] {
  const filtered: TelemetryFrame[] = [];
  for (let i = 0; i < raw.length; i++) {
    const frame = raw[i]!;
    const prev = i > 0 ? raw[i - 1] : undefined;
    if (!isStationary(frame, prev)) {
      filtered.push(frame);
    }
  }
  return filtered;
}

/**
 * Group frames by lap number, then determine which laps are complete.
 * - Out-lap: first frame doesn't start near 0.0 (pos > 0.05) — exclude
 * - Incomplete lap: last frame doesn't reach near 1.0 (pos < 0.95) — exclude
 */
export function getCompletedLaps(filtered: TelemetryFrame[]): Map<number, TelemetryFrame[]> {
  const byLap = new Map<number, TelemetryFrame[]>();

  for (const frame of filtered) {
    const existing = byLap.get(frame.lap);
    if (existing) {
      existing.push(frame);
    } else {
      byLap.set(frame.lap, [frame]);
    }
  }

  const completedLaps = new Map<number, TelemetryFrame[]>();

  for (const [lapNum, lapFrames] of byLap) {
    if (lapFrames.length < 2) continue;

    const firstFrame = lapFrames[0]!;
    const lastFrame = lapFrames[lapFrames.length - 1]!;

    // Out-lap check: must start near the start/finish line
    const startsNearStart = firstFrame.pos < 0.05;
    // Completion check: must end near the start/finish line
    const endsNearEnd = lastFrame.pos > 0.95;

    if (startsNearStart && endsNearEnd) {
      completedLaps.set(lapNum, lapFrames);
    }
  }

  return completedLaps;
}

export function computeLapSummary(lapNum: number, lapFrames: TelemetryFrame[]): LapSummary {
  const firstTs = lapFrames[0]!.ts;
  const lastTs = lapFrames[lapFrames.length - 1]!.ts;
  const lapTime = +(lastTs - firstTs).toFixed(3);

  // Sector splits by finding boundary crossings
  const sectorFrames: TelemetryFrame[][] = [[], [], []];
  for (const frame of lapFrames) {
    const sector = getSector(frame.pos);
    sectorFrames[sector - 1]!.push(frame);
  }

  const sectors: SectorSummary[] = [];
  for (let s = 0; s < 3; s++) {
    const sf = sectorFrames[s]!;
    if (sf.length >= 2) {
      const sectorTime = +(sf[sf.length - 1]!.ts - sf[0]!.ts).toFixed(3);
      sectors.push({ sector: s + 1, time: sectorTime });
    } else if (sf.length === 1) {
      sectors.push({ sector: s + 1, time: 0 });
    }
  }

  // Speed metrics
  const speeds = lapFrames.map((f) => f.spd);
  const avgSpeed = +(speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1);
  const maxSpeed = Math.max(...speeds);

  return { lapNumber: lapNum, lapTime, sectors, avgSpeed, maxSpeed };
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function detectSectorIssue(sectorFrames: TelemetryFrame[]): Issue {
  // Check tyre overheat: any tyre > 110
  const hasOverheat = sectorFrames.some(
    (f) => f.tyres.fl > 110 || f.tyres.fr > 110 || f.tyres.rl > 110 || f.tyres.rr > 110
  );
  if (hasOverheat) return "tyre_overheat";

  // Check heavy braking: brake > 0.8 while speed > 200
  const hasHeavyBraking = sectorFrames.some((f) => f.brk > 0.8 && f.spd > 200);
  if (hasHeavyBraking) return "heavy_braking";

  // Check low throttle: avg throttle < 0.6
  const avgThrottle = sectorFrames.reduce((sum, f) => sum + f.thr, 0) / sectorFrames.length;
  if (avgThrottle < 0.6) return "low_throttle";

  // Check inconsistency: speed stddev > 40
  const speeds = sectorFrames.map((f) => f.spd);
  if (stddev(speeds) > 40) return "inconsistency";

  // Default fallback
  return "low_throttle";
}

export function generateCoachingMessage(sector: number, issue: Issue, delta: number): string {
  const d = delta.toFixed(3);

  switch (issue) {
    case "tyre_overheat":
      return `Sector ${sector} is killing your lap — ${d}s lost. You're overheating the tyres through the middle of the sector. The grip isn't there anymore. Smooth inputs on exit, stop leaning on the fronts.`;
    case "heavy_braking":
      return `Sector ${sector}, ${d}s off the pace. You're standing on the brakes too deep with too much speed. Trail-brake earlier, carry the speed through the apex instead of scrubbing it at the entry.`;
    case "low_throttle":
      return `${d}s gone in sector ${sector}. Your throttle trace is flat — you're not getting on the power. Trust the rear, roll into it earlier. The exit speed is where the lap time lives.`;
    case "inconsistency":
      return `Sector ${sector} is all over the place — ${d}s lost. Your speed trace looks like a heartbeat monitor. Pick a line, commit to it, and be consistent through the phase.`;
  }
}

// ============================================================
// APP
// ============================================================

const app = new Hono();

app.post("/ingest", async (c) => {
  const body = await c.req.json<TelemetryFrame[]>();

  if (!Array.isArray(body)) {
    return c.json({ error: "Expected an array of telemetry frames" }, 400);
  }

  frames = body;

  const lapNumbers = new Set(body.map((f) => f.lap));

  return c.json({
    laps: lapNumbers.size,
    frames: body.length,
  });
});

app.get("/laps", (c) => {
  if (frames.length === 0) {
    return c.json({ error: "No telemetry data. POST to /ingest first." }, 400);
  }

  const filtered = filterFrames(frames);
  const completedLaps = getCompletedLaps(filtered);

  const summaries: LapSummary[] = [];
  for (const [lapNum, lapFrames] of completedLaps) {
    summaries.push(computeLapSummary(lapNum, lapFrames));
  }

  summaries.sort((a, b) => a.lapNumber - b.lapNumber);

  return c.json(summaries);
});

app.get("/analysis", (c) => {
  if (frames.length === 0) {
    return c.json({ error: "No telemetry data. POST to /ingest first." }, 400);
  }

  const filtered = filterFrames(frames);
  const completedLaps = getCompletedLaps(filtered);

  if (completedLaps.size < 2) {
    return c.json({ error: "Need at least 2 completed laps for comparison" }, 400);
  }

  // Compute summaries
  const summaries: LapSummary[] = [];
  for (const [lapNum, lapFrames] of completedLaps) {
    summaries.push(computeLapSummary(lapNum, lapFrames));
  }

  // Find best and worst lap by lap time
  summaries.sort((a, b) => a.lapTime - b.lapTime);
  const best = summaries[0]!;
  const worst = summaries[summaries.length - 1]!;
  const delta = +(worst.lapTime - best.lapTime).toFixed(3);

  // Find worst sector of worst lap (biggest time diff vs best lap's sectors)
  let worstSectorNum = 1;
  let worstSectorDelta = -Infinity;

  for (const worstSector of worst.sectors) {
    const bestSector = best.sectors.find((s) => s.sector === worstSector.sector);
    if (bestSector) {
      const sectorDelta = worstSector.time - bestSector.time;
      if (sectorDelta > worstSectorDelta) {
        worstSectorDelta = sectorDelta;
        worstSectorNum = worstSector.sector;
      }
    }
  }

  // Get frames for the worst sector of the worst lap to detect the issue
  const worstLapFrames = completedLaps.get(worst.lapNumber)!;
  const worstSectorFrames = worstLapFrames.filter(
    (f) => getSector(f.pos) === worstSectorNum
  );

  const issue = detectSectorIssue(worstSectorFrames);
  const coachingMessage = generateCoachingMessage(worstSectorNum, issue, delta);

  const result: AnalysisResult = {
    bestLap: { lapNumber: best.lapNumber, lapTime: best.lapTime },
    worstLap: { lapNumber: worst.lapNumber, lapTime: worst.lapTime, delta },
    problemSector: worstSectorNum,
    issue,
    coachingMessage,
  };

  return c.json(result);
});

// ============================================================
// SERVER
// ============================================================

const PORT = 3111;

console.log(`PitGPT Telemetry API running on http://localhost:${PORT}`);
console.log("Endpoints:");
console.log("  POST /ingest    — send raw telemetry");
console.log("  GET  /laps      — lap summaries");
console.log("  GET  /analysis  — coaching analysis");

// Bun uses the default export to start the server
export default {
  port: PORT,
  fetch: app.fetch,
};

// Node/tsx fallback: use @hono/node-server or the built-in serve
export { app, PORT };
