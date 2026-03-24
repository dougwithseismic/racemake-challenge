import { Hono } from "hono";
import {
  app as challengeHardApp,
  filterFrames,
  getCompletedLaps,
  computeLapSummary,
  detectSectorIssue,
  generateCoachingMessage,
  getSector,
  type TelemetryFrame,
  type LapSummary,
  type AnalysisResult,
} from "@repo/challenge-hard";
import { telemetry } from "@repo/challenge-hard/telemetry";

const hard = new Hono();

// In-memory store for this route's telemetry
let frames: TelemetryFrame[] = [];

// POST /ingest — accept raw telemetry
hard.post("/ingest", async (c) => {
  let body: TelemetryFrame[];
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!Array.isArray(body)) {
    return c.json({ error: "Expected an array of telemetry frames" }, 400);
  }
  frames = body;
  const lapNumbers = new Set(body.map((f) => f.lap));
  return c.json({ laps: lapNumbers.size, frames: body.length });
});

// GET /laps — completed lap summaries
hard.get("/laps", (c) => {
  const data = frames.length > 0 ? frames : telemetry;
  const filtered = filterFrames(data);
  const completedLaps = getCompletedLaps(filtered);

  const summaries: LapSummary[] = [];
  for (const [lapNum, lapFrames] of completedLaps) {
    summaries.push(computeLapSummary(lapNum, lapFrames));
  }
  summaries.sort((a, b) => a.lapNumber - b.lapNumber);
  return c.json(summaries);
});

// GET /analysis — compare laps, coaching output
hard.get("/analysis", (c) => {
  const data = frames.length > 0 ? frames : telemetry;
  const filtered = filterFrames(data);
  const completedLaps = getCompletedLaps(filtered);

  if (completedLaps.size < 2) {
    return c.json({ error: "Need at least 2 completed laps" }, 400);
  }

  const summaries: LapSummary[] = [];
  for (const [lapNum, lapFrames] of completedLaps) {
    summaries.push(computeLapSummary(lapNum, lapFrames));
  }

  summaries.sort((a, b) => a.lapTime - b.lapTime);
  const best = summaries[0]!;
  const worst = summaries[summaries.length - 1]!;
  const delta = +(worst.lapTime - best.lapTime).toFixed(3);

  let worstSectorNum = 1;
  let worstSectorDelta = -Infinity;
  for (const ws of worst.sectors) {
    const bs = best.sectors.find((s) => s.sector === ws.sector);
    if (bs) {
      const sd = ws.time - bs.time;
      if (sd > worstSectorDelta) { worstSectorDelta = sd; worstSectorNum = ws.sector; }
    }
  }

  const worstLapFrames = completedLaps.get(worst.lapNumber)!;
  const worstSectorFrames = worstLapFrames.filter((f) => getSector(f.pos) === worstSectorNum);
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

// GET /data — return the raw telemetry for inspection
hard.get("/data", (c) => {
  return c.json({
    frames: frames.length > 0 ? frames.length : telemetry.length,
    source: frames.length > 0 ? "ingested" : "built-in",
    telemetry: frames.length > 0 ? frames : telemetry,
  });
});

export { hard };
