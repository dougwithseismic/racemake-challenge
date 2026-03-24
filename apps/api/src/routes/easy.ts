import { Hono } from "hono";
import {
  referenceLap,
  driverLap,
  driverLap2,
  analyzeLap,
  generateCoaching,
  analyzeStint,
  type Config,
  type DriverLap,
  type ReferenceLap,
} from "@repo/challenge-easy";

const easy = new Hono();

const config: Config = { coachVoice: "pitgpt", units: "metric" };

// GET /analyze — single lap analysis (Level 1)
easy.get("/analyze", (c) => {
  const analysis = analyzeLap(referenceLap, driverLap);
  const coaching = generateCoaching(analysis, config);
  return c.json({
    level: 1,
    description: "Single lap analysis — bug-fixed pipeline",
    lap: { track: driverLap.track, car: driverLap.car, totalTime: driverLap.totalTime },
    analysis,
    coaching,
  });
});

// GET /stint — stint analysis across both laps (Level 2)
easy.get("/stint", (c) => {
  const stint = analyzeStint(referenceLap, [driverLap, driverLap2], config);
  return c.json({
    level: 2,
    description: "Stint analysis — tyre degradation trends across laps",
    stint,
  });
});

// POST /analyze — analyze custom lap data against reference
easy.post("/analyze", async (c) => {
  let body: { reference?: ReferenceLap; driver: DriverLap };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.driver) {
    return c.json({ error: "Missing required field: driver" }, 400);
  }
  const ref = body.reference ?? referenceLap;
  const analysis = analyzeLap(ref, body.driver);
  const coaching = generateCoaching(analysis, config);
  return c.json({ analysis, coaching });
});

// POST /stint — analyze custom stint data
easy.post("/stint", async (c) => {
  let body: { reference?: ReferenceLap; laps: DriverLap[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.laps || !Array.isArray(body.laps)) {
    return c.json({ error: "Missing required field: laps (array)" }, 400);
  }
  const ref = body.reference ?? referenceLap;
  const stint = analyzeStint(ref, body.laps, config);
  return c.json({ stint });
});

// GET /data — return the raw challenge data for inspection
easy.get("/data", (c) => {
  return c.json({
    referenceLap,
    driverLap,
    driverLap2,
  });
});

export { easy };
