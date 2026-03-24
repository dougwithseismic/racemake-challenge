import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  filterFrames,
  getCompletedLaps,
  computeLapSummary,
  detectSectorIssue,
  generateCoachingMessage,
  getSector,
  type TelemetryFrame,
} from "@repo/challenge-hard";
import { telemetry } from "@repo/challenge-hard/telemetry";

/**
 * IRL Route — demonstrates production-optimized approaches:
 *
 * 1. Streaming ingestion with real-time sector analysis (SSE)
 * 2. Incremental lap detection without buffering full sessions
 * 3. Per-car isolation pattern
 * 4. Backpressure-aware frame processing
 *
 * This is how you'd actually build it for 20+ cars at 120 Hz.
 */

const irl = new Hono();

// ============================================================
// STREAMING ANALYSIS — Process frames as they arrive via SSE
// ============================================================

/**
 * GET /stream — Simulates real-time telemetry ingestion
 *
 * Replays the built-in telemetry as a stream, processing each frame
 * incrementally. Emits sector completions and coaching as they happen,
 * rather than waiting for the full session to complete.
 *
 * This is the pattern you'd use in production:
 * - Frames arrive from the Tauri recorder over WebSocket
 * - Each frame is processed immediately
 * - Sector boundaries trigger analysis
 * - Coaching messages emit to the driver's overlay in real-time
 */
irl.get("/stream", (c) => {
  return streamSSE(c, async (stream) => {
    const filtered = filterFrames(telemetry);

    // Track state per car (single car here, but pattern scales to N)
    const carState = {
      currentLap: -1,
      currentSector: -1,
      sectorFrames: [] as TelemetryFrame[],
      lapStart: 0,
      sectorStart: 0,
      completedLaps: new Map<number, TelemetryFrame[]>(),
      lapFrames: [] as TelemetryFrame[],
    };

    for (let i = 0; i < filtered.length; i++) {
      const frame = filtered[i]!;
      const sector = getSector(frame.pos);

      // New lap detected
      if (frame.lap !== carState.currentLap) {
        // Finalize previous lap if it was complete
        if (carState.currentLap >= 0 && carState.lapFrames.length > 0) {
          const firstFrame = carState.lapFrames[0]!;
          const startsNearStart = firstFrame.pos < 0.05;
          const lastFrame = carState.lapFrames[carState.lapFrames.length - 1]!;
          const endsNearEnd = lastFrame.pos > 0.95;

          if (startsNearStart && endsNearEnd) {
            carState.completedLaps.set(carState.currentLap, [...carState.lapFrames]);

            const summary = computeLapSummary(carState.currentLap, carState.lapFrames);
            await stream.writeSSE({
              event: "lap_complete",
              data: JSON.stringify(summary),
            });

            // If we have 2+ completed laps, emit live analysis
            if (carState.completedLaps.size >= 2) {
              const summaries = [...carState.completedLaps.entries()]
                .map(([num, frames]) => computeLapSummary(num, frames))
                .sort((a, b) => a.lapTime - b.lapTime);

              const best = summaries[0]!;
              const worst = summaries[summaries.length - 1]!;

              if (worst.lapNumber !== best.lapNumber) {
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

                const worstLapFrames = carState.completedLaps.get(worst.lapNumber)!;
                const worstSectorFrames = worstLapFrames.filter((f) => getSector(f.pos) === worstSectorNum);
                const issue = detectSectorIssue(worstSectorFrames);
                const coachingMessage = generateCoachingMessage(worstSectorNum, issue, delta);

                await stream.writeSSE({
                  event: "coaching",
                  data: JSON.stringify({
                    bestLap: best.lapNumber,
                    worstLap: worst.lapNumber,
                    problemSector: worstSectorNum,
                    issue,
                    delta,
                    coachingMessage,
                  }),
                });
              }
            }
          } else {
            await stream.writeSSE({
              event: "lap_skipped",
              data: JSON.stringify({
                lap: carState.currentLap,
                reason: !carState.lapFrames[0] || carState.lapFrames[0].pos > 0.05 ? "out-lap" : "incomplete",
              }),
            });
          }
        }

        carState.currentLap = frame.lap;
        carState.lapFrames = [];
        carState.sectorFrames = [];
        carState.lapStart = frame.ts;
        carState.currentSector = sector;
        carState.sectorStart = frame.ts;
      }

      // Sector boundary crossing
      if (sector !== carState.currentSector && carState.sectorFrames.length > 0) {
        const sectorTime = +(frame.ts - carState.sectorStart).toFixed(3);
        await stream.writeSSE({
          event: "sector",
          data: JSON.stringify({
            lap: carState.currentLap,
            sector: carState.currentSector,
            time: sectorTime,
            frames: carState.sectorFrames.length,
            maxSpeed: Math.max(...carState.sectorFrames.map((f) => f.spd)),
            avgThrottle: +(carState.sectorFrames.reduce((s, f) => s + f.thr, 0) / carState.sectorFrames.length).toFixed(3),
          }),
        });

        carState.currentSector = sector;
        carState.sectorStart = frame.ts;
        carState.sectorFrames = [];
      }

      carState.lapFrames.push(frame);
      carState.sectorFrames.push(frame);

      // Emit raw frame at 100ms intervals to simulate real-time
      await stream.writeSSE({
        event: "frame",
        data: JSON.stringify({
          ts: frame.ts,
          lap: frame.lap,
          pos: frame.pos,
          spd: frame.spd,
          thr: frame.thr,
          brk: frame.brk,
          str: frame.str,
          gear: frame.gear,
          rpm: frame.rpm,
          sector,
        }),
      });

      // Simulate real-time delay (50ms between frames for demo)
      await stream.sleep(50);
    }

    await stream.writeSSE({
      event: "done",
      data: JSON.stringify({
        totalLaps: carState.completedLaps.size,
        message: "Stream complete. In production, this runs indefinitely at 120 Hz per car.",
      }),
    });
  });
});

// ============================================================
// ARCHITECTURE OVERVIEW
// ============================================================

irl.get("/", (c) => {
  return c.json({
    title: "IRL Challenge — Production Telemetry Pipeline",
    description: "How you'd actually build this for 20+ cars at 120 Hz",
    endpoints: {
      "GET /stream": "SSE stream — real-time telemetry replay with incremental analysis",
    },
    architecture: {
      ingestion: {
        pattern: "Stream processing — frames processed on arrival, never buffered in full",
        transport: "WebSocket from Tauri recorder → server",
        backpressure: "At 120 Hz × 20 cars = 2,400 frames/sec. Drop intermediate frames if consumer can't keep up. Telemetry at 120 Hz is redundant — 10 Hz is sufficient for sector analysis.",
      },
      isolation: {
        pattern: "Per-car workers — each car's analysis runs in its own isolate",
        why: "If one car's data is malformed, it doesn't poison the session. Workers can be scaled independently.",
        implementation: "Node.js worker_threads or Cloudflare Workers for edge deployment",
      },
      storage: {
        hotPath: "ClickHouse — append-only time-series, partitioned by session_id + car_id",
        coldPath: "S3/R2 with Parquet for historical analysis and ML training",
        realTime: "Redis Streams for the live coaching pipeline",
      },
      analysis: {
        trigger: "Sector boundary crossing, not every frame",
        caching: "Reference lap computed once per session, cached by session_id",
        coaching: "Debounced — max one message per sector per lap to avoid radio spam",
      },
      schemaResilience: {
        problem: "Game updates break telemetry offsets",
        solution: "Runtime schema extraction from game binaries (see dezlock-dump). Offsets resolve dynamically, not hardcoded.",
        fallback: "Pattern signatures (byte sequences) survive minor patches. Version-tagged schema caches for diffing.",
        ci: "Game update detected → inject → extract → diff → PR → deploy. Automated.",
      },
    },
  });
});

export { irl };
