/**
 * Integration test — starts the server, ingests telemetry, and tests all endpoints.
 * Run: npx tsx packages/challenge-hard/src/test.ts
 */
import { serve } from "@hono/node-server";
import { app, PORT } from "./index.js";
import { telemetry } from "./telemetry.js";

const BASE = `http://localhost:${PORT}`;

async function main() {
  const server = serve({ fetch: app.fetch, port: PORT });

  // Give server a moment to bind
  await new Promise((r) => setTimeout(r, 200));

  console.log("\n=== POST /ingest ===");
  const ingestRes = await fetch(`${BASE}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(telemetry),
  });
  const ingestData = await ingestRes.json();
  console.log(JSON.stringify(ingestData, null, 2));

  console.log("\n=== GET /laps ===");
  const lapsRes = await fetch(`${BASE}/laps`);
  const lapsData = (await lapsRes.json()) as { lapNumber: number; lapTime: number; sectors: { sector: number; time: number }[]; avgSpeed: number; maxSpeed: number }[];
  console.log(JSON.stringify(lapsData, null, 2));

  console.log("\n=== GET /analysis ===");
  const analysisRes = await fetch(`${BASE}/analysis`);
  const analysisData = (await analysisRes.json()) as {
    bestLap: { lapNumber: number; lapTime: number };
    worstLap: { lapNumber: number; lapTime: number; delta: number };
    problemSector: number;
    issue: string;
    coachingMessage: string;
  };
  console.log(JSON.stringify(analysisData, null, 2));

  // Validation
  console.log("\n=== VALIDATION ===");

  const checks = [
    { name: "bestLap is 1 or 2", pass: [1, 2].includes(analysisData.bestLap.lapNumber) },
    { name: "worstLap is 3", pass: analysisData.worstLap.lapNumber === 3 },
    { name: "problemSector is 2", pass: analysisData.problemSector === 2 },
    { name: "issue is tyre_overheat", pass: analysisData.issue === "tyre_overheat" },
    { name: "laps excluded out-lap (lap 0)", pass: !lapsData.some((l) => l.lapNumber === 0) },
    { name: "laps excluded incomplete lap 4", pass: !lapsData.some((l) => l.lapNumber === 4) },
    { name: "3 completed laps", pass: lapsData.length === 3 },
    { name: "coaching message exists", pass: analysisData.coachingMessage.length > 20 },
  ];

  checks.forEach((c) => console.log(`${c.pass ? "✅" : "❌"} ${c.name}`));

  if (checks.every((c) => c.pass)) {
    console.log("\n✅ All checks passed.");
  } else {
    console.log("\n❌ Some checks failed.");
  }

  server.close();
  process.exit(0);
}

main().catch(console.error);
