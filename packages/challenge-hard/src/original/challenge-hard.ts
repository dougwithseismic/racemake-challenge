/**
 * 🏁 RACEMAKE PRODUCT ENGINEER CHALLENGE — HARD 🏁
 * ==================================================
 *
 * CONTEXT
 * -------
 * PitGPT is an AI race engineer. Our data recorder captures telemetry
 * from racing simulators at 10 Hz and sends it to our provider API.
 * The API processes raw frames into lap analysis and coaching insights.
 *
 * Below is a raw telemetry dump from a short stint at Spa-Francorchamps
 * in Le Mans Ultimate (Porsche 963 LMdh, dry, 24°C track).
 *
 * The data is what our Rust/Tauri recorder actually sends — timestamped
 * frames with speed, throttle, brake, steering, gear, RPM, tyre temps,
 * lap number, and normalized track position (0.0 = start/finish, 1.0 = full lap).
 *
 *
 * YOUR TASK
 * ---------
 * Build a Bun/Hono API that ingests this data and returns analysis.
 *
 * 1. POST /ingest
 *    Accepts the raw telemetry array. Stores it in memory.
 *    Returns: { laps: number, frames: number }
 *
 * 2. GET /laps
 *    Returns a summary of each completed lap:
 *    { lapNumber, lapTime, sectors: [{ sector, time }], avgSpeed, maxSpeed }
 *
 *    Sector boundaries at Spa are:
 *      S1 → S2 at trackPosition ≈ 0.333
 *      S2 → S3 at trackPosition ≈ 0.667
 *
 * 3. GET /analysis
 *    Compare each lap to the best lap in the stint. For the worst sector
 *    of the worst lap, identify the primary issue from telemetry clues:
 *
 *    - "heavy_braking"  — brake > 0.8 while speed is still high (> 200)
 *    - "low_throttle"   — avg throttle in sector < 0.6
 *    - "tyre_overheat"  — any tyre temp > 110
 *    - "inconsistency"  — large speed variance (stddev > 40)
 *
 *    Return:
 *    {
 *      bestLap: { lapNumber, lapTime },
 *      worstLap: { lapNumber, lapTime, delta },
 *      problemSector: number,
 *      issue: string,
 *      coachingMessage: string   // use pitgpt voice (see below)
 *    }
 *
 * 4. Edge cases your API must handle:
 *    - The first lap is an out-lap (starts mid-track, not from 0.0) — exclude it
 *    - The last lap may be incomplete (no return to ~0.0) — exclude it
 *    - Frames where speed < 5 and trackPosition doesn't change = pit stop / stationary — skip them
 *
 *
 * COACHING VOICE
 * --------------
 * When generating coachingMessage, use the PitGPT voice:
 * Direct, short sentences. Like a race engineer on the radio.
 * "Sector 2 is killing your lap — you're overheating the fronts
 * and the throttle trace shows it. Smooth inputs on exit."
 *
 *
 * HOW TO RUN
 * ----------
 *   bun install hono
 *   bun run challenge-hard.ts
 *
 * Test with:
 *   curl -X POST http://localhost:3000/ingest -H "Content-Type: application/json" -d @telemetry.json
 *   curl http://localhost:3000/laps
 *   curl http://localhost:3000/analysis
 *
 *
 * WHAT WE'RE LOOKING FOR
 * ----------------------
 * - Can you build a working API from raw data with no scaffolding?
 * - Do you handle the messy parts (out-lap, incomplete lap, stationary frames)?
 * - Is your code structured like it belongs in a real codebase?
 * - Does the analysis actually make sense for the data?
 *
 * Use whatever tools you want — AI, docs, whatever. We expect it.
 * We care whether you understand what you shipped.
 *
 *
 * SUBMIT
 * ------
 * Send your code + example curl output to weare@racemake.com
 * Subject: RACEMAKE – Engineer – [Your Name]
 *
 * If we see the signal, we'll be in touch within 48 hours.
 */

// ============================================================
// RAW TELEMETRY DATA
// ============================================================
// Sampled at key points, Spa-Francorchamps, Porsche 963 LMdh
// Fields: timestamp (seconds), lapNumber, trackPosition (0-1),
//         speed (km/h), throttle (0-1), brake (0-1),
//         steering (-1 to 1), gear, rpm,
//         tyreTemps { fl, fr, rl, rr }

export interface TelemetryFrame {
  ts: number;
  lap: number;
  pos: number;       // trackPosition 0.0 - 1.0
  spd: number;       // km/h
  thr: number;       // 0-1
  brk: number;       // 0-1
  str: number;       // -1 to 1
  gear: number;
  rpm: number;
  tyres: { fl: number; fr: number; rl: number; rr: number };
}

export const telemetry: TelemetryFrame[] = [
  // === OUT-LAP (lap 0) — starts mid-track, should be excluded ===
  { ts: 0.0,    lap: 0, pos: 0.541, spd: 78,  thr: 0.4,  brk: 0.0, str: 0.02,  gear: 3, rpm: 6200,  tyres: { fl: 68, fr: 70, rl: 65, rr: 66 } },
  { ts: 2.5,  lap: 0, pos: 0.548, spd: 112, thr: 0.7,  brk: 0.0, str: 0.01,  gear: 4, rpm: 7100,  tyres: { fl: 72, fr: 74, rl: 69, rr: 70 } },
  { ts: 5.0,  lap: 0, pos: 0.556, spd: 148, thr: 0.9,  brk: 0.0, str: -0.03, gear: 5, rpm: 7800,  tyres: { fl: 76, fr: 78, rl: 73, rr: 74 } },
  { ts: 7.5,  lap: 0, pos: 0.567, spd: 189, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 5, rpm: 8400,  tyres: { fl: 79, fr: 81, rl: 76, rr: 77 } },
  { ts: 10.0,  lap: 0, pos: 0.581, spd: 221, thr: 1.0,  brk: 0.0, str: -0.01, gear: 6, rpm: 8100,  tyres: { fl: 81, fr: 83, rl: 78, rr: 79 } },
  { ts: 12.5,  lap: 0, pos: 0.598, spd: 247, thr: 1.0,  brk: 0.0, str: 0.00,  gear: 6, rpm: 8600,  tyres: { fl: 83, fr: 85, rl: 80, rr: 81 } },
  { ts: 15.0,  lap: 0, pos: 0.620, spd: 261, thr: 1.0,  brk: 0.0, str: -0.02, gear: 7, rpm: 7900,  tyres: { fl: 84, fr: 86, rl: 81, rr: 82 } },
  { ts: 17.5,  lap: 0, pos: 0.644, spd: 272, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 7, rpm: 8300,  tyres: { fl: 85, fr: 87, rl: 82, rr: 83 } },
  { ts: 20.0,  lap: 0, pos: 0.663, spd: 265, thr: 0.8,  brk: 0.1, str: -0.08, gear: 7, rpm: 8100,  tyres: { fl: 86, fr: 88, rl: 83, rr: 84 } },
  { ts: 22.5,  lap: 0, pos: 0.678, spd: 241, thr: 0.3,  brk: 0.6, str: -0.14, gear: 6, rpm: 7400,  tyres: { fl: 87, fr: 89, rl: 84, rr: 85 } },
  { ts: 25.0, lap: 0, pos: 0.690, spd: 198, thr: 0.0,  brk: 0.9, str: -0.11, gear: 5, rpm: 6800,  tyres: { fl: 88, fr: 90, rl: 85, rr: 86 } },
  { ts: 27.5, lap: 0, pos: 0.700, spd: 162, thr: 0.2,  brk: 0.4, str: 0.06,  gear: 4, rpm: 7200,  tyres: { fl: 88, fr: 90, rl: 85, rr: 86 } },
  { ts: 30.0, lap: 0, pos: 0.712, spd: 171, thr: 0.6,  brk: 0.0, str: 0.03,  gear: 4, rpm: 7600,  tyres: { fl: 89, fr: 91, rl: 86, rr: 87 } },
  { ts: 32.5, lap: 0, pos: 0.728, spd: 195, thr: 0.9,  brk: 0.0, str: -0.01, gear: 5, rpm: 7900,  tyres: { fl: 89, fr: 91, rl: 86, rr: 87 } },
  { ts: 35.0, lap: 0, pos: 0.748, spd: 218, thr: 1.0,  brk: 0.0, str: 0.02,  gear: 5, rpm: 8400,  tyres: { fl: 90, fr: 92, rl: 87, rr: 88 } },
  { ts: 37.5, lap: 0, pos: 0.772, spd: 243, thr: 1.0,  brk: 0.0, str: -0.03, gear: 6, rpm: 8100,  tyres: { fl: 90, fr: 92, rl: 87, rr: 88 } },
  { ts: 40.0, lap: 0, pos: 0.801, spd: 259, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 6, rpm: 8500,  tyres: { fl: 90, fr: 92, rl: 87, rr: 88 } },
  { ts: 42.5, lap: 0, pos: 0.834, spd: 268, thr: 1.0,  brk: 0.0, str: -0.01, gear: 7, rpm: 8000,  tyres: { fl: 91, fr: 93, rl: 88, rr: 89 } },
  { ts: 45.0, lap: 0, pos: 0.870, spd: 274, thr: 1.0,  brk: 0.0, str: 0.00,  gear: 7, rpm: 8300,  tyres: { fl: 91, fr: 93, rl: 88, rr: 89 } },
  { ts: 47.5, lap: 0, pos: 0.909, spd: 278, thr: 1.0,  brk: 0.0, str: 0.02,  gear: 7, rpm: 8500,  tyres: { fl: 91, fr: 93, rl: 88, rr: 89 } },
  { ts: 50.0, lap: 0, pos: 0.941, spd: 269, thr: 0.6,  brk: 0.3, str: -0.12, gear: 7, rpm: 8100,  tyres: { fl: 92, fr: 94, rl: 89, rr: 90 } },
  { ts: 52.5, lap: 0, pos: 0.960, spd: 218, thr: 0.0,  brk: 0.9, str: -0.22, gear: 5, rpm: 7200,  tyres: { fl: 92, fr: 94, rl: 89, rr: 90 } },
  { ts: 55.0, lap: 0, pos: 0.974, spd: 162, thr: 0.0,  brk: 0.8, str: 0.18,  gear: 4, rpm: 6800,  tyres: { fl: 93, fr: 95, rl: 90, rr: 91 } },
  { ts: 57.5, lap: 0, pos: 0.985, spd: 121, thr: 0.3,  brk: 0.3, str: 0.25,  gear: 3, rpm: 7100,  tyres: { fl: 93, fr: 95, rl: 90, rr: 91 } },
  { ts: 60.0, lap: 0, pos: 0.994, spd: 98,  thr: 0.5,  brk: 0.0, str: 0.15,  gear: 3, rpm: 7400,  tyres: { fl: 93, fr: 95, rl: 90, rr: 91 } },

  // === LAP 1 — clean lap, good reference ===
  // Sector 1: La Source → Eau Rouge → Raidillon → Kemmel Straight
  { ts: 60.0,  lap: 1, pos: 0.003, spd: 107, thr: 0.7,  brk: 0.0, str: -0.05, gear: 3, rpm: 7600,  tyres: { fl: 93, fr: 95, rl: 90, rr: 91 } },
  { ts: 63.2,  lap: 1, pos: 0.012, spd: 138, thr: 0.9,  brk: 0.0, str: -0.02, gear: 4, rpm: 7800,  tyres: { fl: 93, fr: 95, rl: 90, rr: 91 } },
  { ts: 66.3,  lap: 1, pos: 0.025, spd: 172, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 5, rpm: 7900,  tyres: { fl: 94, fr: 96, rl: 91, rr: 92 } },
  { ts: 69.5,  lap: 1, pos: 0.041, spd: 201, thr: 1.0,  brk: 0.0, str: -0.04, gear: 5, rpm: 8400,  tyres: { fl: 94, fr: 96, rl: 91, rr: 92 } },
  { ts: 72.7,  lap: 1, pos: 0.060, spd: 234, thr: 1.0,  brk: 0.0, str: -0.08, gear: 6, rpm: 8200,  tyres: { fl: 94, fr: 96, rl: 91, rr: 92 } },
  { ts: 75.9,  lap: 1, pos: 0.082, spd: 258, thr: 1.0,  brk: 0.0, str: -0.06, gear: 6, rpm: 8600,  tyres: { fl: 95, fr: 97, rl: 92, rr: 93 } },
  { ts: 79.0,  lap: 1, pos: 0.108, spd: 274, thr: 1.0,  brk: 0.0, str: -0.03, gear: 7, rpm: 8100,  tyres: { fl: 95, fr: 97, rl: 92, rr: 93 } },
  { ts: 82.2,  lap: 1, pos: 0.137, spd: 281, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 7, rpm: 8400,  tyres: { fl: 95, fr: 97, rl: 92, rr: 93 } },
  { ts: 85.4,  lap: 1, pos: 0.168, spd: 286, thr: 1.0,  brk: 0.0, str: 0.00,  gear: 7, rpm: 8600,  tyres: { fl: 95, fr: 97, rl: 92, rr: 93 } },
  { ts: 88.5,  lap: 1, pos: 0.200, spd: 289, thr: 1.0,  brk: 0.0, str: -0.01, gear: 7, rpm: 8700,  tyres: { fl: 96, fr: 98, rl: 93, rr: 94 } },
  { ts: 91.7,  lap: 1, pos: 0.234, spd: 291, thr: 1.0,  brk: 0.0, str: 0.00,  gear: 7, rpm: 8700,  tyres: { fl: 96, fr: 98, rl: 93, rr: 94 } },
  { ts: 94.9,  lap: 1, pos: 0.268, spd: 288, thr: 0.9,  brk: 0.0, str: -0.02, gear: 7, rpm: 8600,  tyres: { fl: 96, fr: 98, rl: 93, rr: 94 } },
  { ts: 98.1,  lap: 1, pos: 0.298, spd: 262, thr: 0.3,  brk: 0.5, str: -0.06, gear: 6, rpm: 8000,  tyres: { fl: 96, fr: 98, rl: 93, rr: 94 } },
  { ts: 101.2,  lap: 1, pos: 0.318, spd: 218, thr: 0.0,  brk: 0.8, str: -0.14, gear: 5, rpm: 7200,  tyres: { fl: 97, fr: 99, rl: 94, rr: 95 } },
  // Sector 2: Les Combes → Rivage → Pouhon → Fagnes
  { ts: 104.4,  lap: 1, pos: 0.338, spd: 178, thr: 0.2,  brk: 0.4, str: 0.08,  gear: 4, rpm: 7500,  tyres: { fl: 97, fr: 99, rl: 94, rr: 95 } },
  { ts: 107.6,  lap: 1, pos: 0.355, spd: 192, thr: 0.7,  brk: 0.0, str: 0.03,  gear: 5, rpm: 7800,  tyres: { fl: 97, fr: 99, rl: 94, rr: 95 } },
  { ts: 110.7,  lap: 1, pos: 0.374, spd: 214, thr: 0.9,  brk: 0.0, str: -0.02, gear: 5, rpm: 8300,  tyres: { fl: 98, fr: 100, rl: 95, rr: 96 } },
  { ts: 113.9,  lap: 1, pos: 0.396, spd: 238, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 6, rpm: 8100,  tyres: { fl: 98, fr: 100, rl: 95, rr: 96 } },
  { ts: 117.1,  lap: 1, pos: 0.418, spd: 241, thr: 0.8,  brk: 0.1, str: -0.09, gear: 6, rpm: 8200,  tyres: { fl: 98, fr: 100, rl: 95, rr: 96 } },
  { ts: 120.3,  lap: 1, pos: 0.436, spd: 212, thr: 0.2,  brk: 0.6, str: -0.16, gear: 5, rpm: 7500,  tyres: { fl: 99, fr: 101, rl: 96, rr: 97 } },
  { ts: 123.4,  lap: 1, pos: 0.451, spd: 174, thr: 0.4,  brk: 0.2, str: 0.11,  gear: 4, rpm: 7800,  tyres: { fl: 99, fr: 101, rl: 96, rr: 97 } },
  { ts: 126.6,  lap: 1, pos: 0.468, spd: 198, thr: 0.8,  brk: 0.0, str: 0.04,  gear: 5, rpm: 8000,  tyres: { fl: 99, fr: 101, rl: 96, rr: 97 } },
  { ts: 129.8,  lap: 1, pos: 0.489, spd: 224, thr: 1.0,  brk: 0.0, str: -0.03, gear: 5, rpm: 8500,  tyres: { fl: 100, fr: 102, rl: 97, rr: 98 } },
  { ts: 132.9,  lap: 1, pos: 0.513, spd: 248, thr: 1.0,  brk: 0.0, str: -0.07, gear: 6, rpm: 8300,  tyres: { fl: 100, fr: 102, rl: 97, rr: 98 } },
  { ts: 136.1,  lap: 1, pos: 0.541, spd: 261, thr: 1.0,  brk: 0.0, str: -0.11, gear: 6, rpm: 8600,  tyres: { fl: 100, fr: 102, rl: 97, rr: 98 } },
  { ts: 139.3,  lap: 1, pos: 0.571, spd: 268, thr: 0.9,  brk: 0.0, str: -0.09, gear: 7, rpm: 8000,  tyres: { fl: 101, fr: 103, rl: 98, rr: 99 } },
  { ts: 142.5,  lap: 1, pos: 0.601, spd: 271, thr: 1.0,  brk: 0.0, str: -0.04, gear: 7, rpm: 8200,  tyres: { fl: 101, fr: 103, rl: 98, rr: 99 } },
  { ts: 145.6,  lap: 1, pos: 0.632, spd: 265, thr: 0.8,  brk: 0.1, str: -0.08, gear: 7, rpm: 8100,  tyres: { fl: 101, fr: 103, rl: 98, rr: 99 } },
  { ts: 148.8,  lap: 1, pos: 0.656, spd: 239, thr: 0.3,  brk: 0.6, str: -0.15, gear: 6, rpm: 7400,  tyres: { fl: 102, fr: 104, rl: 99, rr: 100 } },
  // Sector 3: Stavelot → Blanchimont → Bus Stop
  { ts: 152.0,  lap: 1, pos: 0.672, spd: 196, thr: 0.3,  brk: 0.4, str: 0.06,  gear: 5, rpm: 7000,  tyres: { fl: 102, fr: 104, rl: 99, rr: 100 } },
  { ts: 155.1,  lap: 1, pos: 0.688, spd: 178, thr: 0.6,  brk: 0.0, str: 0.04,  gear: 4, rpm: 7600,  tyres: { fl: 102, fr: 104, rl: 99, rr: 100 } },
  { ts: 158.3,  lap: 1, pos: 0.706, spd: 202, thr: 0.9,  brk: 0.0, str: -0.01, gear: 5, rpm: 8000,  tyres: { fl: 102, fr: 104, rl: 99, rr: 100 } },
  { ts: 161.5,  lap: 1, pos: 0.728, spd: 231, thr: 1.0,  brk: 0.0, str: 0.02,  gear: 5, rpm: 8500,  tyres: { fl: 102, fr: 104, rl: 99, rr: 100 } },
  { ts: 164.7,  lap: 1, pos: 0.755, spd: 256, thr: 1.0,  brk: 0.0, str: -0.03, gear: 6, rpm: 8300,  tyres: { fl: 102, fr: 104, rl: 99, rr: 100 } },
  { ts: 167.8,  lap: 1, pos: 0.786, spd: 271, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 6, rpm: 8600,  tyres: { fl: 103, fr: 105, rl: 100, rr: 101 } },
  { ts: 171.0,  lap: 1, pos: 0.820, spd: 278, thr: 1.0,  brk: 0.0, str: -0.02, gear: 7, rpm: 8100,  tyres: { fl: 103, fr: 105, rl: 100, rr: 101 } },
  { ts: 174.2,  lap: 1, pos: 0.856, spd: 282, thr: 1.0,  brk: 0.0, str: -0.05, gear: 7, rpm: 8300,  tyres: { fl: 103, fr: 105, rl: 100, rr: 101 } },
  { ts: 177.3,  lap: 1, pos: 0.891, spd: 279, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 7, rpm: 8400,  tyres: { fl: 103, fr: 105, rl: 100, rr: 101 } },
  { ts: 180.5,  lap: 1, pos: 0.924, spd: 275, thr: 0.7,  brk: 0.2, str: -0.10, gear: 7, rpm: 8200,  tyres: { fl: 103, fr: 105, rl: 100, rr: 101 } },
  { ts: 183.7,  lap: 1, pos: 0.948, spd: 228, thr: 0.0,  brk: 0.9, str: -0.20, gear: 5, rpm: 7400,  tyres: { fl: 104, fr: 106, rl: 101, rr: 102 } },
  { ts: 186.9,  lap: 1, pos: 0.966, spd: 172, thr: 0.0,  brk: 0.7, str: 0.16,  gear: 4, rpm: 6900,  tyres: { fl: 104, fr: 106, rl: 101, rr: 102 } },
  { ts: 190.0,  lap: 1, pos: 0.981, spd: 128, thr: 0.3,  brk: 0.3, str: 0.22,  gear: 3, rpm: 7200,  tyres: { fl: 104, fr: 106, rl: 101, rr: 102 } },
  { ts: 193.2,  lap: 1, pos: 0.993, spd: 102, thr: 0.5,  brk: 0.0, str: 0.12,  gear: 3, rpm: 7500,  tyres: { fl: 104, fr: 106, rl: 101, rr: 102 } },

  // === LAP 2 — good lap, similar to lap 1 ===
  { ts: 193.2,  lap: 2, pos: 0.004, spd: 109, thr: 0.7,  brk: 0.0, str: -0.04, gear: 3, rpm: 7600,  tyres: { fl: 95, fr: 97, rl: 92, rr: 93 } },
  { ts: 196.4,  lap: 2, pos: 0.013, spd: 141, thr: 0.9,  brk: 0.0, str: -0.01, gear: 4, rpm: 7900,  tyres: { fl: 95, fr: 97, rl: 92, rr: 93 } },
  { ts: 199.5,  lap: 2, pos: 0.026, spd: 175, thr: 1.0,  brk: 0.0, str: 0.02,  gear: 5, rpm: 8000,  tyres: { fl: 96, fr: 98, rl: 93, rr: 94 } },
  { ts: 202.7,  lap: 2, pos: 0.043, spd: 205, thr: 1.0,  brk: 0.0, str: -0.03, gear: 5, rpm: 8500,  tyres: { fl: 96, fr: 98, rl: 93, rr: 94 } },
  { ts: 205.8,  lap: 2, pos: 0.063, spd: 237, thr: 1.0,  brk: 0.0, str: -0.07, gear: 6, rpm: 8200,  tyres: { fl: 96, fr: 98, rl: 93, rr: 94 } },
  { ts: 209.0,  lap: 2, pos: 0.086, spd: 261, thr: 1.0,  brk: 0.0, str: -0.05, gear: 6, rpm: 8600,  tyres: { fl: 97, fr: 99, rl: 94, rr: 95 } },
  { ts: 212.2,  lap: 2, pos: 0.112, spd: 277, thr: 1.0,  brk: 0.0, str: -0.02, gear: 7, rpm: 8200,  tyres: { fl: 97, fr: 99, rl: 94, rr: 95 } },
  { ts: 215.3,  lap: 2, pos: 0.141, spd: 284, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 7, rpm: 8500,  tyres: { fl: 97, fr: 99, rl: 94, rr: 95 } },
  { ts: 218.5,  lap: 2, pos: 0.172, spd: 288, thr: 1.0,  brk: 0.0, str: 0.00,  gear: 7, rpm: 8600,  tyres: { fl: 97, fr: 99, rl: 94, rr: 95 } },
  { ts: 221.7,  lap: 2, pos: 0.204, spd: 290, thr: 1.0,  brk: 0.0, str: -0.01, gear: 7, rpm: 8700,  tyres: { fl: 98, fr: 100, rl: 95, rr: 96 } },
  { ts: 224.8,  lap: 2, pos: 0.238, spd: 292, thr: 1.0,  brk: 0.0, str: 0.00,  gear: 7, rpm: 8700,  tyres: { fl: 98, fr: 100, rl: 95, rr: 96 } },
  { ts: 228.0,  lap: 2, pos: 0.272, spd: 289, thr: 0.9,  brk: 0.0, str: -0.01, gear: 7, rpm: 8600,  tyres: { fl: 98, fr: 100, rl: 95, rr: 96 } },
  { ts: 231.1,  lap: 2, pos: 0.302, spd: 264, thr: 0.3,  brk: 0.5, str: -0.05, gear: 6, rpm: 8000,  tyres: { fl: 98, fr: 100, rl: 95, rr: 96 } },
  { ts: 234.3,  lap: 2, pos: 0.322, spd: 221, thr: 0.0,  brk: 0.8, str: -0.13, gear: 5, rpm: 7200,  tyres: { fl: 99, fr: 101, rl: 96, rr: 97 } },
  // S2
  { ts: 237.5,  lap: 2, pos: 0.341, spd: 181, thr: 0.2,  brk: 0.4, str: 0.07,  gear: 4, rpm: 7500,  tyres: { fl: 99, fr: 101, rl: 96, rr: 97 } },
  { ts: 240.6,  lap: 2, pos: 0.358, spd: 195, thr: 0.7,  brk: 0.0, str: 0.02,  gear: 5, rpm: 7800,  tyres: { fl: 99, fr: 101, rl: 96, rr: 97 } },
  { ts: 243.8,  lap: 2, pos: 0.377, spd: 217, thr: 0.9,  brk: 0.0, str: -0.01, gear: 5, rpm: 8300,  tyres: { fl: 100, fr: 102, rl: 97, rr: 98 } },
  { ts: 247.0,  lap: 2, pos: 0.399, spd: 240, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 6, rpm: 8100,  tyres: { fl: 100, fr: 102, rl: 97, rr: 98 } },
  { ts: 250.1,  lap: 2, pos: 0.421, spd: 244, thr: 0.8,  brk: 0.1, str: -0.08, gear: 6, rpm: 8200,  tyres: { fl: 100, fr: 102, rl: 97, rr: 98 } },
  { ts: 253.3,  lap: 2, pos: 0.439, spd: 215, thr: 0.2,  brk: 0.6, str: -0.15, gear: 5, rpm: 7500,  tyres: { fl: 101, fr: 103, rl: 98, rr: 99 } },
  { ts: 256.4,  lap: 2, pos: 0.454, spd: 177, thr: 0.4,  brk: 0.2, str: 0.10,  gear: 4, rpm: 7800,  tyres: { fl: 101, fr: 103, rl: 98, rr: 99 } },
  { ts: 259.6,  lap: 2, pos: 0.471, spd: 201, thr: 0.8,  brk: 0.0, str: 0.03,  gear: 5, rpm: 8000,  tyres: { fl: 101, fr: 103, rl: 98, rr: 99 } },
  { ts: 262.8,  lap: 2, pos: 0.492, spd: 227, thr: 1.0,  brk: 0.0, str: -0.02, gear: 5, rpm: 8500,  tyres: { fl: 102, fr: 104, rl: 99, rr: 100 } },
  { ts: 265.9,  lap: 2, pos: 0.516, spd: 251, thr: 1.0,  brk: 0.0, str: -0.06, gear: 6, rpm: 8300,  tyres: { fl: 102, fr: 104, rl: 99, rr: 100 } },
  { ts: 269.1,  lap: 2, pos: 0.544, spd: 264, thr: 1.0,  brk: 0.0, str: -0.10, gear: 6, rpm: 8600,  tyres: { fl: 102, fr: 104, rl: 99, rr: 100 } },
  { ts: 272.2,  lap: 2, pos: 0.574, spd: 271, thr: 0.9,  brk: 0.0, str: -0.08, gear: 7, rpm: 8100,  tyres: { fl: 103, fr: 105, rl: 100, rr: 101 } },
  { ts: 275.4,  lap: 2, pos: 0.604, spd: 274, thr: 1.0,  brk: 0.0, str: -0.03, gear: 7, rpm: 8200,  tyres: { fl: 103, fr: 105, rl: 100, rr: 101 } },
  { ts: 278.6,  lap: 2, pos: 0.635, spd: 268, thr: 0.8,  brk: 0.1, str: -0.07, gear: 7, rpm: 8100,  tyres: { fl: 103, fr: 105, rl: 100, rr: 101 } },
  { ts: 281.7,  lap: 2, pos: 0.659, spd: 242, thr: 0.3,  brk: 0.5, str: -0.14, gear: 6, rpm: 7400,  tyres: { fl: 104, fr: 106, rl: 101, rr: 102 } },
  // S3
  { ts: 284.9,  lap: 2, pos: 0.675, spd: 199, thr: 0.3,  brk: 0.4, str: 0.05,  gear: 5, rpm: 7000,  tyres: { fl: 104, fr: 106, rl: 101, rr: 102 } },
  { ts: 288.1,  lap: 2, pos: 0.691, spd: 181, thr: 0.6,  brk: 0.0, str: 0.03,  gear: 4, rpm: 7600,  tyres: { fl: 104, fr: 106, rl: 101, rr: 102 } },
  { ts: 291.2,  lap: 2, pos: 0.709, spd: 205, thr: 0.9,  brk: 0.0, str: -0.01, gear: 5, rpm: 8000,  tyres: { fl: 104, fr: 106, rl: 101, rr: 102 } },
  { ts: 294.4, lap: 2, pos: 0.731, spd: 234, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 5, rpm: 8500,  tyres: { fl: 104, fr: 106, rl: 101, rr: 102 } },
  { ts: 297.5, lap: 2, pos: 0.758, spd: 259, thr: 1.0,  brk: 0.0, str: -0.02, gear: 6, rpm: 8300,  tyres: { fl: 104, fr: 106, rl: 101, rr: 102 } },
  { ts: 300.7, lap: 2, pos: 0.789, spd: 274, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 6, rpm: 8600,  tyres: { fl: 105, fr: 107, rl: 102, rr: 103 } },
  { ts: 303.9, lap: 2, pos: 0.823, spd: 281, thr: 1.0,  brk: 0.0, str: -0.01, gear: 7, rpm: 8100,  tyres: { fl: 105, fr: 107, rl: 102, rr: 103 } },
  { ts: 307.0, lap: 2, pos: 0.859, spd: 284, thr: 1.0,  brk: 0.0, str: -0.04, gear: 7, rpm: 8300,  tyres: { fl: 105, fr: 107, rl: 102, rr: 103 } },
  { ts: 310.2, lap: 2, pos: 0.894, spd: 281, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 7, rpm: 8400,  tyres: { fl: 105, fr: 107, rl: 102, rr: 103 } },
  { ts: 313.4, lap: 2, pos: 0.927, spd: 277, thr: 0.7,  brk: 0.2, str: -0.09, gear: 7, rpm: 8200,  tyres: { fl: 105, fr: 107, rl: 102, rr: 103 } },
  { ts: 316.5, lap: 2, pos: 0.951, spd: 231, thr: 0.0,  brk: 0.9, str: -0.19, gear: 5, rpm: 7400,  tyres: { fl: 106, fr: 108, rl: 103, rr: 104 } },
  { ts: 319.7, lap: 2, pos: 0.969, spd: 175, thr: 0.0,  brk: 0.7, str: 0.15,  gear: 4, rpm: 6900,  tyres: { fl: 106, fr: 108, rl: 103, rr: 104 } },
  { ts: 322.8, lap: 2, pos: 0.984, spd: 131, thr: 0.3,  brk: 0.3, str: 0.21,  gear: 3, rpm: 7200,  tyres: { fl: 106, fr: 108, rl: 103, rr: 104 } },
  { ts: 326.0, lap: 2, pos: 0.996, spd: 104, thr: 0.5,  brk: 0.0, str: 0.11,  gear: 3, rpm: 7500,  tyres: { fl: 106, fr: 108, rl: 103, rr: 104 } },

  // === LAP 3 — bad lap, degraded tyres, pushing too hard in S2 ===
  { ts: 326.0, lap: 3, pos: 0.005, spd: 105, thr: 0.7,  brk: 0.0, str: -0.05, gear: 3, rpm: 7500,  tyres: { fl: 101, fr: 104, rl: 98, rr: 100 } },
  { ts: 329.2, lap: 3, pos: 0.014, spd: 136, thr: 0.9,  brk: 0.0, str: -0.02, gear: 4, rpm: 7700,  tyres: { fl: 102, fr: 105, rl: 99, rr: 101 } },
  { ts: 332.4, lap: 3, pos: 0.027, spd: 168, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 5, rpm: 7800,  tyres: { fl: 103, fr: 106, rl: 100, rr: 102 } },
  { ts: 335.6, lap: 3, pos: 0.042, spd: 196, thr: 1.0,  brk: 0.0, str: -0.04, gear: 5, rpm: 8300,  tyres: { fl: 103, fr: 106, rl: 100, rr: 102 } },
  { ts: 338.8, lap: 3, pos: 0.060, spd: 228, thr: 1.0,  brk: 0.0, str: -0.08, gear: 6, rpm: 8100,  tyres: { fl: 104, fr: 107, rl: 101, rr: 103 } },
  { ts: 342.0, lap: 3, pos: 0.081, spd: 252, thr: 1.0,  brk: 0.0, str: -0.06, gear: 6, rpm: 8500,  tyres: { fl: 104, fr: 107, rl: 101, rr: 103 } },
  { ts: 345.2, lap: 3, pos: 0.105, spd: 268, thr: 1.0,  brk: 0.0, str: -0.03, gear: 7, rpm: 8000,  tyres: { fl: 105, fr: 108, rl: 102, rr: 104 } },
  { ts: 348.4, lap: 3, pos: 0.132, spd: 276, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 7, rpm: 8300,  tyres: { fl: 105, fr: 108, rl: 102, rr: 104 } },
  { ts: 351.6, lap: 3, pos: 0.162, spd: 281, thr: 1.0,  brk: 0.0, str: 0.00,  gear: 7, rpm: 8500,  tyres: { fl: 106, fr: 109, rl: 103, rr: 105 } },
  { ts: 354.8, lap: 3, pos: 0.193, spd: 284, thr: 1.0,  brk: 0.0, str: -0.01, gear: 7, rpm: 8600,  tyres: { fl: 106, fr: 109, rl: 103, rr: 105 } },
  { ts: 358.0, lap: 3, pos: 0.226, spd: 286, thr: 1.0,  brk: 0.0, str: 0.00,  gear: 7, rpm: 8700,  tyres: { fl: 107, fr: 110, rl: 104, rr: 106 } },
  { ts: 361.1, lap: 3, pos: 0.259, spd: 283, thr: 0.9,  brk: 0.0, str: -0.02, gear: 7, rpm: 8600,  tyres: { fl: 107, fr: 110, rl: 104, rr: 106 } },
  { ts: 364.3, lap: 3, pos: 0.290, spd: 258, thr: 0.3,  brk: 0.5, str: -0.06, gear: 6, rpm: 7900,  tyres: { fl: 108, fr: 111, rl: 105, rr: 107 } },
  { ts: 367.5, lap: 3, pos: 0.312, spd: 214, thr: 0.0,  brk: 0.8, str: -0.15, gear: 5, rpm: 7100,  tyres: { fl: 108, fr: 111, rl: 105, rr: 107 } },
  // S2 — here the driver pushes too hard, tyres overheat, loses time
  { ts: 370.7, lap: 3, pos: 0.335, spd: 172, thr: 0.2,  brk: 0.5, str: 0.09,  gear: 4, rpm: 7400,  tyres: { fl: 109, fr: 112, rl: 106, rr: 108 } },
  { ts: 373.9, lap: 3, pos: 0.351, spd: 184, thr: 0.6,  brk: 0.0, str: 0.04,  gear: 5, rpm: 7600,  tyres: { fl: 109, fr: 112, rl: 106, rr: 108 } },
  { ts: 377.1, lap: 3, pos: 0.369, spd: 204, thr: 0.8,  brk: 0.0, str: -0.02, gear: 5, rpm: 8100,  tyres: { fl: 110, fr: 113, rl: 107, rr: 109 } },
  { ts: 380.3, lap: 3, pos: 0.389, spd: 226, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 6, rpm: 7900,  tyres: { fl: 110, fr: 113, rl: 107, rr: 109 } },
  { ts: 383.5, lap: 3, pos: 0.410, spd: 231, thr: 0.7,  brk: 0.2, str: -0.10, gear: 6, rpm: 8000,  tyres: { fl: 111, fr: 114, rl: 108, rr: 110 } },
  { ts: 386.7, lap: 3, pos: 0.427, spd: 198, thr: 0.1,  brk: 0.7, str: -0.18, gear: 5, rpm: 7200,  tyres: { fl: 111, fr: 114, rl: 108, rr: 110 } },
  { ts: 389.9, lap: 3, pos: 0.440, spd: 158, thr: 0.3,  brk: 0.3, str: 0.14,  gear: 4, rpm: 7500,  tyres: { fl: 112, fr: 115, rl: 109, rr: 111 } },
  { ts: 393.1, lap: 3, pos: 0.455, spd: 176, thr: 0.7,  brk: 0.0, str: 0.06,  gear: 4, rpm: 7900,  tyres: { fl: 112, fr: 115, rl: 109, rr: 111 } },
  { ts: 396.3, lap: 3, pos: 0.474, spd: 198, thr: 0.9,  brk: 0.0, str: -0.02, gear: 5, rpm: 8200,  tyres: { fl: 113, fr: 116, rl: 110, rr: 112 } },
  { ts: 399.5, lap: 3, pos: 0.497, spd: 218, thr: 0.9,  brk: 0.0, str: -0.06, gear: 5, rpm: 8400,  tyres: { fl: 113, fr: 116, rl: 110, rr: 112 } },
  { ts: 402.7, lap: 3, pos: 0.522, spd: 234, thr: 0.8,  brk: 0.0, str: -0.10, gear: 6, rpm: 8100,  tyres: { fl: 114, fr: 117, rl: 111, rr: 113 } },
  { ts: 405.9, lap: 3, pos: 0.548, spd: 241, thr: 0.7,  brk: 0.0, str: -0.09, gear: 6, rpm: 8200,  tyres: { fl: 114, fr: 117, rl: 111, rr: 113 } },
  { ts: 409.1, lap: 3, pos: 0.575, spd: 248, thr: 0.8,  brk: 0.0, str: -0.05, gear: 6, rpm: 8400,  tyres: { fl: 115, fr: 118, rl: 112, rr: 114 } },
  { ts: 412.3, lap: 3, pos: 0.603, spd: 252, thr: 0.7,  brk: 0.1, str: -0.08, gear: 6, rpm: 8300,  tyres: { fl: 115, fr: 118, rl: 112, rr: 114 } },
  { ts: 415.5, lap: 3, pos: 0.629, spd: 238, thr: 0.4,  brk: 0.4, str: -0.13, gear: 6, rpm: 7800,  tyres: { fl: 116, fr: 119, rl: 113, rr: 115 } },
  { ts: 418.7, lap: 3, pos: 0.651, spd: 208, thr: 0.2,  brk: 0.6, str: -0.16, gear: 5, rpm: 7200,  tyres: { fl: 116, fr: 119, rl: 113, rr: 115 } },
  // S3
  { ts: 421.9, lap: 3, pos: 0.670, spd: 178, thr: 0.2,  brk: 0.5, str: 0.08,  gear: 4, rpm: 6800,  tyres: { fl: 110, fr: 113, rl: 107, rr: 109 } },
  { ts: 425.1, lap: 3, pos: 0.685, spd: 164, thr: 0.5,  brk: 0.0, str: 0.05,  gear: 4, rpm: 7400,  tyres: { fl: 109, fr: 112, rl: 106, rr: 108 } },
  { ts: 428.3, lap: 3, pos: 0.701, spd: 188, thr: 0.8,  brk: 0.0, str: -0.01, gear: 5, rpm: 7800,  tyres: { fl: 108, fr: 111, rl: 105, rr: 107 } },
  { ts: 431.4, lap: 3, pos: 0.722, spd: 215, thr: 1.0,  brk: 0.0, str: 0.02,  gear: 5, rpm: 8300,  tyres: { fl: 107, fr: 110, rl: 104, rr: 106 } },
  { ts: 434.6, lap: 3, pos: 0.748, spd: 241, thr: 1.0,  brk: 0.0, str: -0.03, gear: 6, rpm: 8100,  tyres: { fl: 107, fr: 110, rl: 104, rr: 106 } },
  { ts: 437.8, lap: 3, pos: 0.778, spd: 261, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 6, rpm: 8500,  tyres: { fl: 106, fr: 109, rl: 103, rr: 105 } },
  { ts: 441.0, lap: 3, pos: 0.811, spd: 272, thr: 1.0,  brk: 0.0, str: -0.02, gear: 7, rpm: 8000,  tyres: { fl: 106, fr: 109, rl: 103, rr: 105 } },
  { ts: 444.2, lap: 3, pos: 0.847, spd: 277, thr: 1.0,  brk: 0.0, str: -0.05, gear: 7, rpm: 8200,  tyres: { fl: 105, fr: 108, rl: 102, rr: 104 } },
  { ts: 447.4, lap: 3, pos: 0.882, spd: 274, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 7, rpm: 8300,  tyres: { fl: 105, fr: 108, rl: 102, rr: 104 } },
  { ts: 450.6, lap: 3, pos: 0.916, spd: 270, thr: 0.6,  brk: 0.3, str: -0.11, gear: 7, rpm: 8100,  tyres: { fl: 105, fr: 108, rl: 102, rr: 104 } },
  { ts: 453.8, lap: 3, pos: 0.942, spd: 221, thr: 0.0,  brk: 0.9, str: -0.21, gear: 5, rpm: 7300,  tyres: { fl: 106, fr: 109, rl: 103, rr: 105 } },
  { ts: 457.0, lap: 3, pos: 0.961, spd: 168, thr: 0.0,  brk: 0.8, str: 0.17,  gear: 4, rpm: 6800,  tyres: { fl: 106, fr: 109, rl: 103, rr: 105 } },
  { ts: 460.2, lap: 3, pos: 0.977, spd: 124, thr: 0.3,  brk: 0.3, str: 0.23,  gear: 3, rpm: 7100,  tyres: { fl: 105, fr: 108, rl: 102, rr: 104 } },
  { ts: 463.4, lap: 3, pos: 0.991, spd: 96,  thr: 0.5,  brk: 0.0, str: 0.14,  gear: 3, rpm: 7300,  tyres: { fl: 105, fr: 108, rl: 102, rr: 104 } },

  // === LAP 4 (incomplete) — only sector 1, should be excluded ===
  { ts: 463.4, lap: 4, pos: 0.003, spd: 101, thr: 0.6,  brk: 0.0, str: -0.04, gear: 3, rpm: 7400,  tyres: { fl: 104, fr: 107, rl: 101, rr: 103 } },
  { ts: 467.4, lap: 4, pos: 0.012, spd: 132, thr: 0.8,  brk: 0.0, str: -0.02, gear: 4, rpm: 7600,  tyres: { fl: 104, fr: 107, rl: 101, rr: 103 } },
  { ts: 471.4, lap: 4, pos: 0.024, spd: 161, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 5, rpm: 7700,  tyres: { fl: 105, fr: 108, rl: 102, rr: 104 } },
  { ts: 475.4, lap: 4, pos: 0.039, spd: 189, thr: 1.0,  brk: 0.0, str: -0.04, gear: 5, rpm: 8200,  tyres: { fl: 105, fr: 108, rl: 102, rr: 104 } },
  { ts: 479.4, lap: 4, pos: 0.056, spd: 218, thr: 1.0,  brk: 0.0, str: -0.07, gear: 6, rpm: 8000,  tyres: { fl: 106, fr: 109, rl: 103, rr: 105 } },
  { ts: 483.4, lap: 4, pos: 0.076, spd: 244, thr: 1.0,  brk: 0.0, str: -0.05, gear: 6, rpm: 8400,  tyres: { fl: 106, fr: 109, rl: 103, rr: 105 } },
  { ts: 487.4, lap: 4, pos: 0.099, spd: 262, thr: 1.0,  brk: 0.0, str: -0.03, gear: 7, rpm: 7900,  tyres: { fl: 107, fr: 110, rl: 104, rr: 106 } },
  { ts: 491.4, lap: 4, pos: 0.125, spd: 271, thr: 1.0,  brk: 0.0, str: 0.01,  gear: 7, rpm: 8200,  tyres: { fl: 107, fr: 110, rl: 104, rr: 106 } },

  // === STATIONARY FRAMES — car stopped, should be filtered ===
  { ts: 503.4, lap: 4, pos: 0.125, spd: 3,   thr: 0.0,  brk: 1.0, str: 0.00,  gear: 1, rpm: 2100,  tyres: { fl: 98, fr: 101, rl: 95, rr: 97 } },
  { ts: 504.4, lap: 4, pos: 0.125, spd: 0,   thr: 0.0,  brk: 1.0, str: 0.00,  gear: 0, rpm: 800,   tyres: { fl: 95, fr: 98, rl: 92, rr: 94 } },
  { ts: 505.4, lap: 4, pos: 0.125, spd: 0,   thr: 0.0,  brk: 0.0, str: 0.00,  gear: 0, rpm: 800,   tyres: { fl: 92, fr: 95, rl: 89, rr: 91 } },
];
