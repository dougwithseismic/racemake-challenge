import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { apiReference } from "@scalar/hono-api-reference";
import { easy } from "./routes/easy.js";
import { hard } from "./routes/hard.js";
import { irl } from "./routes/irl.js";
import { codec } from "./routes/irl-codec.js";

const app = new Hono();

// Middleware
app.use("*", cors({
  origin: process.env.CORS_ORIGIN ?? "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
}));
app.use("*", logger());

// Global error handler
app.onError((err, c) => {
  console.error(`[API Error] ${err.message}`);
  return c.json({ error: err.message || "Internal server error" }, 500);
});

// Root
app.get("/", (c) => {
  return c.json({
    name: "RACEMAKE Challenge API",
    version: "2.0.0",
    description: "PitGPT telemetry analysis — easy challenge, hard challenge, and IRL production patterns",
    author: "github.com/dougwithseismic",
    endpoints: {
      docs: "/docs",
      openapi: "/openapi.json",
      easy: {
        "GET /api/v2/easy/analyze": "Single lap analysis (Level 1)",
        "GET /api/v2/easy/stint": "Stint analysis across laps (Level 2)",
        "POST /api/v2/easy/analyze": "Analyze custom lap data",
        "POST /api/v2/easy/stint": "Analyze custom stint data",
        "GET /api/v2/easy/data": "Raw challenge data",
      },
      hard: {
        "POST /api/v2/hard/ingest": "Ingest raw telemetry frames",
        "GET /api/v2/hard/laps": "Completed lap summaries",
        "GET /api/v2/hard/analysis": "Coaching analysis",
        "GET /api/v2/hard/data": "Raw telemetry data",
      },
      irl: {
        "GET /api/v2/irl": "Architecture overview",
        "GET /api/v2/irl/stream": "SSE stream — real-time telemetry replay",
        "GET /api/v2/irl/codec": "Wire format codec overview",
        "GET /api/v2/irl/codec/schemas": "Versioned schema registry",
        "GET /api/v2/irl/codec/compare": "JSON vs binary vs delta-encoded size comparison",
        "GET /api/v2/irl/codec/roundtrip": "Encode→decode roundtrip proof for all frames",
        "POST /api/v2/irl/codec/encode": "Encode JSON telemetry to binary (hex)",
        "POST /api/v2/irl/codec/decode": "Decode binary (hex) back to JSON",
      },
    },
  });
});

// OpenAPI spec
app.get("/openapi.json", (c) => {
  return c.json({
    openapi: "3.1.0",
    info: {
      title: "RACEMAKE Challenge API",
      version: "2.0.0",
      description: "PitGPT telemetry analysis pipeline — solving the RACEMAKE product engineer challenge.\n\nThree challenge tiers:\n- **Easy** — Bug fix, stint extension, scaling analysis\n- **Hard** — Bun/Hono API with raw 10Hz telemetry processing\n- **IRL** — Production patterns for 20+ cars at 120Hz with streaming analysis",
      contact: {
        name: "Doug",
        url: "https://github.com/dougwithseismic",
      },
    },
    servers: [
      { url: "/", description: "Current server" },
    ],
    paths: {
      "/api/v2/easy/analyze": {
        get: {
          tags: ["Easy Challenge"],
          summary: "Single lap analysis",
          description: "Analyzes driverLap against the Spa-Francorchamps reference. Returns the bug-fixed pipeline output with PitGPT coaching voice.",
          responses: {
            "200": {
              description: "Lap analysis with coaching output",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
        post: {
          tags: ["Easy Challenge"],
          summary: "Analyze custom lap data",
          description: "Submit your own driver lap data for analysis against the reference.",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    driver: { type: "object", description: "DriverLap object" },
                    reference: { type: "object", description: "Optional ReferenceLap (defaults to Spa reference)" },
                  },
                  required: ["driver"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Analysis result" },
          },
        },
      },
      "/api/v2/easy/stint": {
        get: {
          tags: ["Easy Challenge"],
          summary: "Stint analysis",
          description: "Analyzes both driver laps (stint lap 1 and stint lap 14) to detect degradation trends across the stint.",
          responses: {
            "200": { description: "Stint analysis with trends and PitGPT summary" },
          },
        },
        post: {
          tags: ["Easy Challenge"],
          summary: "Analyze custom stint",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    laps: { type: "array", description: "Array of DriverLap objects" },
                    reference: { type: "object", description: "Optional ReferenceLap" },
                  },
                  required: ["laps"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Stint analysis result" },
          },
        },
      },
      "/api/v2/easy/data": {
        get: {
          tags: ["Easy Challenge"],
          summary: "Raw challenge data",
          description: "Returns the reference lap, driver lap, and driver lap 2 data for inspection.",
          responses: {
            "200": { description: "Challenge data" },
          },
        },
      },
      "/api/v2/hard/ingest": {
        post: {
          tags: ["Hard Challenge"],
          summary: "Ingest telemetry",
          description: "Accept raw 10Hz telemetry frames. Stores in memory, replaces any previous data.",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      ts: { type: "number" },
                      lap: { type: "number" },
                      pos: { type: "number" },
                      spd: { type: "number" },
                      thr: { type: "number" },
                      brk: { type: "number" },
                      str: { type: "number" },
                      gear: { type: "number" },
                      rpm: { type: "number" },
                      tyres: { type: "object" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Ingest confirmation with lap and frame counts" },
          },
        },
      },
      "/api/v2/hard/laps": {
        get: {
          tags: ["Hard Challenge"],
          summary: "Lap summaries",
          description: "Returns completed laps with sector splits, avg/max speed. Excludes out-laps, incomplete laps, and stationary frames.",
          responses: {
            "200": { description: "Array of lap summaries" },
          },
        },
      },
      "/api/v2/hard/analysis": {
        get: {
          tags: ["Hard Challenge"],
          summary: "Coaching analysis",
          description: "Compares all completed laps. Identifies worst sector of worst lap, detects the issue (tyre_overheat, heavy_braking, low_throttle, inconsistency), and returns a PitGPT coaching message.",
          responses: {
            "200": { description: "Analysis with coaching" },
          },
        },
      },
      "/api/v2/hard/data": {
        get: {
          tags: ["Hard Challenge"],
          summary: "Raw telemetry",
          description: "Returns the raw telemetry frames (built-in or ingested).",
          responses: {
            "200": { description: "Telemetry data" },
          },
        },
      },
      "/api/v2/irl/": {
        get: {
          tags: ["IRL Challenge"],
          summary: "Architecture overview",
          description: "Production architecture for scaling PitGPT to 20+ cars at 120Hz. Covers streaming, isolation, storage, and schema resilience.",
          responses: {
            "200": { description: "Architecture documentation" },
          },
        },
      },
      "/api/v2/irl/stream": {
        get: {
          tags: ["IRL Challenge"],
          summary: "Real-time telemetry stream (SSE)",
          description: "Server-Sent Events stream that replays telemetry in real-time with incremental sector analysis and coaching. Demonstrates the production streaming pattern.",
          responses: {
            "200": {
              description: "SSE stream with frame, sector, lap_complete, coaching, and done events",
              content: { "text/event-stream": {} },
            },
          },
        },
      },
    },
    tags: [
      { name: "Easy Challenge", description: "Level 1-3: Bug fix, stint analysis, scaling" },
      { name: "Hard Challenge", description: "Bun/Hono API with raw telemetry processing" },
      { name: "IRL Challenge", description: "Production patterns — streaming, isolation, schema resilience" },
    ],
  });
});

// Scalar API docs
app.get(
  "/docs",
  apiReference({
    spec: { url: "/openapi.json" },
    theme: "kepler",
    layout: "modern",
    pageTitle: "RACEMAKE Challenge API",
  })
);

// Mount routes
app.route("/api/v2/easy", easy);
app.route("/api/v2/hard", hard);
app.route("/api/v2/irl", irl);
app.route("/api/v2/irl/codec", codec);

// ============================================================
// SERVER
// ============================================================

const PORT = Number(process.env.PORT) || 3000;

// Bun export
export default {
  port: PORT,
  fetch: app.fetch,
};

// Node.js fallback
if (typeof (globalThis as Record<string, unknown>).Bun === "undefined") {
  import("@hono/node-server").then(({ serve }) => {
    serve({ fetch: app.fetch, port: PORT }, (info) => {
      console.log(`RACEMAKE API running on http://localhost:${info.port}`);
      console.log(`Docs: http://localhost:${info.port}/docs`);
    });
  });
}

export { app };
