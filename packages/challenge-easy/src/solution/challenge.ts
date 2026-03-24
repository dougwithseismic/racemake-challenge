/**
 * 🏁 RACEMAKE PRODUCT ENGINEER CHALLENGE 🏁
 * ==========================================
 *
 * CONTEXT
 * -------
 * PitGPT is an AI race engineer. It analyzes telemetry from racing simulators
 * and gives drivers real-time coaching feedback.
 *
 * Below is a simplified version of our analysis pipeline — split into sections
 * the way our actual codebase is structured. It takes sector-level telemetry
 * from a lap at Spa-Francorchamps (Le Mans Ultimate, Porsche 963 LMdh),
 * compares it against a reference, and generates coaching output.
 *
 * HOW TO RUN
 * ----------
 *   bun run challenge.ts       (preferred — we use Bun)
 *   npx tsx challenge.ts       (alternative)
 *
 * THE CHALLENGE
 * -------------
 * The pipeline has four sections: TYPES, DATA, ANALYSIS, COACH.
 * Read them. Understand how they connect. Then:
 *
 *
 * LEVEL 1 — Fix it
 *
 *   Run challenge.ts. The validation fails. Something in the pipeline
 *   produces wrong output. Find the bug and fix it.
 *
 *   We don't want a rewrite. We want a minimal, targeted fix — the kind
 *   you'd ship in a PR with a one-line description.
 *
 *   FIX: The sort comparator in analyzeLap was sorting ascending (a.delta - b.delta),
 *   putting the smallest delta first. generateCoaching picks findings[0] as the
 *   "worst" sector, so it needs to be descending (b.delta - a.delta).
 *   One-line PR: "fix: sort findings by delta descending so worst sector is first"
 *
 *
 * LEVEL 2 — Extend it
 *
 *   There's a second driver lap in the DATA section (driverLap2) — stint
 *   lap 14, degraded tyres, different driving pattern. It's defined but
 *   never used.
 *
 *   Extend the system to analyze multiple laps and detect how the driver's
 *   issues change over a stint. The output should include:
 *   - Per-lap analysis (what's already there, but for both laps)
 *   - A stint summary: what patterns emerge across laps?
 *     (e.g., "traction loss worsening", "driver compensating with early lift
 *     as tyres degrade")
 *
 *   How you structure this is up to you. We're looking at whether you can
 *   extend existing code without breaking its patterns.
 *
 *
 * LEVEL 3 — Think about it
 *
 *   No code required. Answer briefly:
 *
 *   Right now this processes one car's data. In production, PitGPT handles
 *   full sessions — 20+ cars, 50+ laps each, telemetry streaming at 120 Hz.
 *   What would you change? What breaks first?
 *
 *   ANSWER:
 *   What breaks first is memory — holding 20 cars × 50 laps × 120 Hz in a
 *   single process exhausts heap fast. The synchronous analyzeLap loop also
 *   blocks the event loop when you scale to that volume.
 *
 *   Changes:
 *   1. Stream processing: Don't buffer full sessions. Ingest frames into a
 *      time-series store (ClickHouse / TimescaleDB) and compute sector
 *      aggregates incrementally as frames arrive via a sliding window.
 *   2. Per-car isolation: Each car's analysis runs in its own worker/process.
 *      A supervisor fans out frames by car ID. If one car's data is malformed,
 *      it doesn't take down the session.
 *   3. Reference lap caching: The reference lap doesn't change mid-session.
 *      Compute it once, cache it, and pass a reference ID to each worker
 *      rather than cloning the full object.
 *   4. Backpressure: At 120 Hz × 20 cars = 2,400 frames/sec. The analysis
 *      pipeline needs backpressure — if coaching generation can't keep up,
 *      drop intermediate frames (telemetry is redundant at high Hz) rather
 *      than letting the queue grow unbounded.
 *   5. Coaching debounce: You don't want to generate a new coaching message
 *      every frame. Debounce per-sector: analyze at sector boundaries or
 *      on a 5-10s interval, whichever is longer.
 *
 *
 * When completing this challenge, set the coachVoice config to 'pitgpt'
 * — this activates our production coaching tone.
 */

// ============================================================
// SECTION 1: TYPES
// ============================================================

interface BrakingPoint {
  turn: string;
  brakeMarker: number;
  trailBraking: boolean;
}

interface DriverBrakingPoint extends BrakingPoint {
  lockup: boolean;
  tcActive: boolean;
}

interface TyreTemps {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
}

interface TyreData {
  avgSlip: number;
  peakSlip: number;
  avgTemp: TyreTemps;
}

interface ThrottleTrace {
  earlyLift: boolean;
  smoothApplication: boolean;
  fullThrottlePercent: number;
}

interface ReferenceSector {
  time: number;
  brakingPoints: BrakingPoint[];
}

interface DriverSector {
  time: number;
  delta: number;
  brakingPoints: DriverBrakingPoint[];
  tyreData: TyreData;
  throttleTrace: ThrottleTrace;
}

interface ReferenceLap {
  track: string;
  car: string;
  totalTime: number;
  sectors: Record<string, ReferenceSector>;
}

interface DriverLap {
  track: string;
  car: string;
  totalTime: number;
  sectors: Record<string, DriverSector>;
  stintLap?: number;
}

type Issue = "late_braking" | "early_lift" | "traction_loss" | "overcorrection";

interface SectorFinding {
  sector: number;
  sectorKey: string;
  delta: number;
  issue: Issue;
  details: string;
}

interface LapAnalysis {
  findings: SectorFinding[];
  totalDelta: number;
}

interface CoachingOutput {
  problemSector: number;
  issue: Issue;
  timeLost: number;
  coachingMessage: string;
}

// --- Level 2: Stint types ---

interface StintTrend {
  sector: number;
  issue: Issue;
  trend: "worsening" | "stable" | "improving";
  deltaProgression: number[];
  summary: string;
}

interface StintAnalysis {
  lapAnalyses: { lapLabel: string; analysis: LapAnalysis; coaching: CoachingOutput }[];
  trends: StintTrend[];
  stintSummary: string;
}

interface Config {
  coachVoice: "generic" | "pitgpt";
  units: "metric" | "imperial";
}

// ============================================================
// SECTION 2: DATA — Spa-Francorchamps, LMU
// Car: Porsche 963 LMdh | Conditions: Dry, 24°C track
// ============================================================

const referenceLap: ReferenceLap = {
  track: "Spa-Francorchamps",
  car: "Porsche 963 LMdh",
  totalTime: 133.412,
  sectors: {
    s1: {
      time: 41.203,
      brakingPoints: [
        { turn: "T1 La Source", brakeMarker: 92, trailBraking: true },
      ],
    },
    s2: {
      time: 48.887,
      brakingPoints: [
        { turn: "T6 Rivage", brakeMarker: 68, trailBraking: true },
        { turn: "T10 Pouhon", brakeMarker: 44, trailBraking: true },
      ],
    },
    s3: {
      time: 43.322,
      brakingPoints: [
        { turn: "T14 Stavelot", brakeMarker: 55, trailBraking: true },
        { turn: "T18 Bus Stop", brakeMarker: 78, trailBraking: false },
      ],
    },
  },
};

const driverLap: DriverLap = {
  track: "Spa-Francorchamps",
  car: "Porsche 963 LMdh",
  totalTime: 135.067,
  stintLap: 1,
  sectors: {
    s1: {
      time: 41.59,
      delta: +0.387,
      brakingPoints: [
        {
          turn: "T1 La Source",
          brakeMarker: 89,
          trailBraking: true,
          lockup: false,
          tcActive: false,
        },
      ],
      tyreData: {
        avgSlip: 0.032,
        peakSlip: 0.071,
        avgTemp: { fl: 94, fr: 97, rl: 91, rr: 92 },
      },
      throttleTrace: {
        earlyLift: false,
        smoothApplication: true,
        fullThrottlePercent: 0.78,
      },
    },
    s2: {
      time: 50.085,
      delta: +1.198,
      brakingPoints: [
        {
          turn: "T6 Rivage",
          brakeMarker: 56,
          trailBraking: false,
          lockup: false,
          tcActive: true,
        },
        {
          turn: "T10 Pouhon",
          brakeMarker: 41,
          trailBraking: true,
          lockup: false,
          tcActive: false,
        },
      ],
      tyreData: {
        avgSlip: 0.058,
        peakSlip: 0.134,
        avgTemp: { fl: 101, fr: 104, rl: 97, rr: 99 },
      },
      throttleTrace: {
        earlyLift: false,
        smoothApplication: false,
        fullThrottlePercent: 0.62,
      },
    },
    s3: {
      time: 43.392,
      delta: +0.07,
      brakingPoints: [
        {
          turn: "T14 Stavelot",
          brakeMarker: 54,
          trailBraking: true,
          lockup: false,
          tcActive: false,
        },
        {
          turn: "T18 Bus Stop",
          brakeMarker: 76,
          trailBraking: false,
          lockup: false,
          tcActive: false,
        },
      ],
      tyreData: {
        avgSlip: 0.029,
        peakSlip: 0.065,
        avgTemp: { fl: 93, fr: 96, rl: 90, rr: 91 },
      },
      throttleTrace: {
        earlyLift: false,
        smoothApplication: true,
        fullThrottlePercent: 0.81,
      },
    },
  },
};

// Second driver lap — stint lap 14, same session
// Tyres are degraded, driver is managing pace
const driverLap2: DriverLap = {
  track: "Spa-Francorchamps",
  car: "Porsche 963 LMdh",
  totalTime: 136.841,
  stintLap: 14,
  sectors: {
    s1: {
      time: 42.105,
      delta: +0.902,
      brakingPoints: [
        {
          turn: "T1 La Source",
          brakeMarker: 96,
          trailBraking: false,
          lockup: false,
          tcActive: false,
        },
      ],
      tyreData: {
        avgSlip: 0.041,
        peakSlip: 0.088,
        avgTemp: { fl: 99, fr: 103, rl: 96, rr: 98 },
      },
      throttleTrace: {
        earlyLift: true,
        smoothApplication: true,
        fullThrottlePercent: 0.71,
      },
    },
    s2: {
      time: 51.203,
      delta: +2.316,
      brakingPoints: [
        {
          turn: "T6 Rivage",
          brakeMarker: 61,
          trailBraking: false,
          lockup: true,
          tcActive: true,
        },
        {
          turn: "T10 Pouhon",
          brakeMarker: 48,
          trailBraking: false,
          lockup: false,
          tcActive: true,
        },
      ],
      tyreData: {
        avgSlip: 0.079,
        peakSlip: 0.168,
        avgTemp: { fl: 108, fr: 112, rl: 104, rr: 107 },
      },
      throttleTrace: {
        earlyLift: false,
        smoothApplication: false,
        fullThrottlePercent: 0.49,
      },
    },
    s3: {
      time: 43.533,
      delta: +0.211,
      brakingPoints: [
        {
          turn: "T14 Stavelot",
          brakeMarker: 58,
          trailBraking: true,
          lockup: false,
          tcActive: false,
        },
        {
          turn: "T18 Bus Stop",
          brakeMarker: 81,
          trailBraking: false,
          lockup: false,
          tcActive: true,
        },
      ],
      tyreData: {
        avgSlip: 0.044,
        peakSlip: 0.091,
        avgTemp: { fl: 101, fr: 105, rl: 98, rr: 100 },
      },
      throttleTrace: {
        earlyLift: true,
        smoothApplication: true,
        fullThrottlePercent: 0.68,
      },
    },
  },
};

// ============================================================
// SECTION 3: ANALYSIS
// ============================================================

/**
 * Detect the primary issue in a sector by examining telemetry clues.
 *
 * Issue categories:
 *   "late_braking"    — brakes significantly later than reference
 *                       but doesn't gain time (overdriving the corner)
 *   "early_lift"      — lifts off throttle too early before braking zone
 *   "traction_loss"   — high tyre slip + TC activation + low full-throttle %
 *   "overcorrection"  — excessive steering input causing scrub (high avg slip
 *                       without TC activation)
 */
function detectIssue(
  driverSector: DriverSector,
  refSector: ReferenceSector
): { issue: Issue; details: string } {
  const { brakingPoints, tyreData, throttleTrace } = driverSector;

  // Check for early lift
  if (throttleTrace.earlyLift) {
    return {
      issue: "early_lift",
      details: `Throttle lift detected before braking zone. Full throttle: ${(throttleTrace.fullThrottlePercent * 100).toFixed(0)}%`,
    };
  }

  // Check for traction loss: high slip + TC active + low throttle
  const hasTcActivation = brakingPoints.some((bp) => bp.tcActive);
  const highSlip = tyreData.peakSlip > 0.1;
  const lowThrottle = throttleTrace.fullThrottlePercent < 0.7;

  if (hasTcActivation && highSlip && lowThrottle) {
    return {
      issue: "traction_loss",
      details: `TC active, peak slip ${tyreData.peakSlip.toFixed(3)}, full throttle only ${(throttleTrace.fullThrottlePercent * 100).toFixed(0)}%`,
    };
  }

  // Check for late braking
  for (let i = 0; i < driverSector.brakingPoints.length; i++) {
    const driverBp = driverSector.brakingPoints[i];
    const refBp = refSector.brakingPoints[i];
    if (refBp && driverBp && driverBp.brakeMarker < refBp.brakeMarker - 8) {
      return {
        issue: "late_braking",
        details: `${driverBp.turn}: braked at ${driverBp.brakeMarker}m vs reference ${refBp.brakeMarker}m`,
      };
    }
  }

  // Check for overcorrection
  if (tyreData.avgSlip > 0.05 && !hasTcActivation) {
    return {
      issue: "overcorrection",
      details: `High average slip ${tyreData.avgSlip.toFixed(3)} without TC — likely excessive steering input`,
    };
  }

  // Default
  return {
    issue: "late_braking",
    details: "No single clear cause — general time loss through sector",
  };
}

/**
 * Analyze a driver lap against a reference lap.
 * Returns findings for each sector, sorted by time lost.
 */
function analyzeLap(
  reference: ReferenceLap,
  driver: DriverLap
): LapAnalysis {
  const sectorKeys = Object.keys(driver.sectors);
  const findings: SectorFinding[] = [];

  for (const key of sectorKeys) {
    const driverSector = driver.sectors[key];
    const refSector = reference.sectors[key];

    if (!driverSector || !refSector) continue;

    const sectorNum = parseInt(key.replace("s", ""));
    const { issue, details } = detectIssue(driverSector, refSector);

    findings.push({
      sector: sectorNum,
      sectorKey: key,
      delta: driverSector.delta,
      issue,
      details,
    });
  }

  // LEVEL 1 FIX: Sort by delta descending — worst sector (most time lost) first
  // Original bug: was (a.delta - b.delta) which sorted ascending,
  // putting the smallest delta first instead of the largest.
  findings.sort((a, b) => b.delta - a.delta);

  const totalDelta = findings.reduce((sum, f) => sum + f.delta, 0);

  return { findings, totalDelta };
}

// ============================================================
// SECTION 4: COACH
// ============================================================

/**
 * Generate a coaching message based on analysis findings and voice config.
 *
 * "generic" — analytical, data-focused output
 * "pitgpt"  — direct, driver-focused. Like a real race engineer on the radio.
 *             Short sentences. Tells the driver exactly what to do differently.
 */
function generateMessage(finding: SectorFinding, config: Config): string {
  if (config.coachVoice === "pitgpt") {
    return generatePitGPTMessage(finding);
  }
  return generateGenericMessage(finding);
}

function generateGenericMessage(finding: SectorFinding): string {
  const sector = `Sector ${finding.sector}`;
  const delta = `+${finding.delta.toFixed(3)}s`;

  switch (finding.issue) {
    case "late_braking":
      return `${sector} (${delta}): Late braking detected. ${finding.details}. Consider matching reference braking points for more consistent sector times.`;
    case "early_lift":
      return `${sector} (${delta}): Early throttle lift detected. ${finding.details}. Maintain full throttle deeper into the braking zone.`;
    case "traction_loss":
      return `${sector} (${delta}): Traction loss identified. ${finding.details}. Reduce throttle application rate on corner exit.`;
    case "overcorrection":
      return `${sector} (${delta}): Overcorrection detected. ${finding.details}. Reduce steering input to lower tyre scrub.`;
  }
}

function generatePitGPTMessage(finding: SectorFinding): string {
  const delta = `${finding.delta.toFixed(3)}`;

  switch (finding.issue) {
    case "late_braking":
      return `You're losing ${delta} in sector ${finding.sector}. ${finding.details}. You're overdriving it — brake earlier, carry more speed through the apex. The time is in the exit, not the entry.`;
    case "early_lift":
      return `Sector ${finding.sector}, ${delta} off. You're lifting before the braking zone — keep your foot in, trust the car. That lift is costing you straight-line speed into the corner.`;
    case "traction_loss":
      return `Sector ${finding.sector} is where the lap falls apart — ${delta} lost. TC is fighting you, tyres are sliding. Smooth the throttle on exit. Don't ask for grip that isn't there.`;
    case "overcorrection":
      return `${delta} gone in sector ${finding.sector}. You're sawing at the wheel — the slip numbers show it. Less steering, let the front bite. The car wants to turn, stop fighting it.`;
  }
}

/**
 * Take a lap analysis and produce the final coaching output.
 * Focuses on the worst sector — that's where the time is.
 */
function generateCoaching(
  analysis: LapAnalysis,
  config: Config
): CoachingOutput {
  const worst = analysis.findings[0];

  if (!worst) {
    return {
      problemSector: 0,
      issue: "late_braking",
      timeLost: 0,
      coachingMessage: "No significant issues found. Clean lap.",
    };
  }

  return {
    problemSector: worst.sector,
    issue: worst.issue,
    timeLost: worst.delta,
    coachingMessage: generateMessage(worst, config),
  };
}

// ============================================================
// LEVEL 2: STINT ANALYSIS
// ============================================================

/**
 * Detect trends across multiple laps for each sector.
 * Compares how the same issue evolves as the stint progresses.
 */
function detectStintTrends(
  lapAnalyses: LapAnalysis[]
): StintTrend[] {
  const sectorKeys = ["s1", "s2", "s3"];
  const trends: StintTrend[] = [];

  for (let s = 0; s < sectorKeys.length; s++) {
    const sectorNum = s + 1;

    // Collect findings for this sector across all laps
    const sectorFindings = lapAnalyses.map(
      (la) => la.findings.find((f) => f.sector === sectorNum)
    );

    const deltas = sectorFindings.map((f) => f?.delta ?? 0);
    const issues = sectorFindings.map((f) => f?.issue ?? "late_braking");

    // Determine trend direction from delta progression
    const firstDelta = deltas[0] ?? 0;
    const lastDelta = deltas[deltas.length - 1] ?? 0;
    const deltaChange = lastDelta - firstDelta;

    let trend: StintTrend["trend"];
    if (deltaChange > 0.3) trend = "worsening";
    else if (deltaChange < -0.3) trend = "improving";
    else trend = "stable";

    // Build a human-readable summary
    const dominantIssue = issues[issues.length - 1]!;
    const issueLabel = dominantIssue.replace("_", " ");

    let summary: string;
    if (trend === "worsening") {
      summary = `${issueLabel} worsening in sector ${sectorNum} — delta grew from +${firstDelta.toFixed(3)}s to +${lastDelta.toFixed(3)}s over the stint`;
    } else if (trend === "improving") {
      summary = `${issueLabel} improving in sector ${sectorNum} — driver adapting, delta reduced from +${firstDelta.toFixed(3)}s to +${lastDelta.toFixed(3)}s`;
    } else {
      summary = `Sector ${sectorNum} stable across stint — consistent ${issueLabel} pattern`;
    }

    trends.push({
      sector: sectorNum,
      issue: dominantIssue,
      trend,
      deltaProgression: deltas,
      summary,
    });
  }

  return trends;
}

/**
 * Generate a stint-level coaching summary from trends.
 */
function generateStintSummary(trends: StintTrend[], config: Config): string {
  const worsening = trends.filter((t) => t.trend === "worsening");
  const improving = trends.filter((t) => t.trend === "improving");

  if (config.coachVoice === "pitgpt") {
    const parts: string[] = [];

    if (worsening.length > 0) {
      const worstTrend = worsening.sort(
        (a, b) =>
          (b.deltaProgression[b.deltaProgression.length - 1]! - b.deltaProgression[0]!) -
          (a.deltaProgression[a.deltaProgression.length - 1]! - a.deltaProgression[0]!)
      )[0]!;
      parts.push(
        `Sector ${worstTrend.sector} is getting away from you — ${worstTrend.issue.replace("_", " ")} is worse every lap. The tyres are going off and you're fighting it instead of adapting.`
      );
    }

    if (improving.length > 0) {
      parts.push(
        `Good news — sector ${improving[0]!.sector} is trending the right way. Whatever you're doing there, keep doing it.`
      );
    }

    // Check for compensation patterns
    const hasEarlyLift = trends.some(
      (t) => t.issue === "early_lift" && t.trend === "worsening"
    );
    const hasTractionLoss = trends.some(
      (t) => t.issue === "traction_loss" && t.trend === "worsening"
    );

    if (hasEarlyLift && hasTractionLoss) {
      parts.push(
        "You're lifting early to compensate for the rear sliding — that's costing you on the straights. Manage the tyres through smoother inputs, not by backing off earlier."
      );
    } else if (hasEarlyLift) {
      parts.push(
        "The early lifts are creeping in as tyres degrade. Trust the grip window — you're leaving time on the table before the braking zone."
      );
    } else if (hasTractionLoss) {
      parts.push(
        "Traction is dropping off. Reduce your initial throttle application on exit — feed it in progressively."
      );
    }

    return parts.join(" ");
  }

  // Generic voice
  return trends.map((t) => t.summary).join("\n");
}

/**
 * Analyze a full stint: multiple laps against a reference.
 */
function analyzeStint(
  reference: ReferenceLap,
  laps: DriverLap[],
  config: Config
): StintAnalysis {
  const lapAnalyses = laps.map((lap, i) => {
    const analysis = analyzeLap(reference, lap);
    const coaching = generateCoaching(analysis, config);
    return {
      lapLabel: lap.stintLap ? `Stint Lap ${lap.stintLap}` : `Lap ${i + 1}`,
      analysis,
      coaching,
    };
  });

  const trends = detectStintTrends(lapAnalyses.map((la) => la.analysis));
  const stintSummary = generateStintSummary(trends, config);

  return { lapAnalyses, trends, stintSummary };
}

// ============================================================
// RUNNER
// ============================================================

const config: Config = {
  coachVoice: "pitgpt",
  units: "metric",
};

// --- Level 1: Single lap analysis (with bug fix) ---
console.log("=== LEVEL 1: Single Lap Analysis ===\n");

const analysis = analyzeLap(referenceLap, driverLap);
const result = generateCoaching(analysis, config);

console.log("--- PitGPT Lap Analysis ---");
console.log(JSON.stringify(result, null, 2));
console.log("---------------------------");

// --- Validation ---
const checks = [
  { name: "problemSector", pass: result.problemSector === 2 },
  {
    name: "issue",
    pass: (["late_braking", "traction_loss"] as string[]).includes(result.issue),
  },
  { name: "timeLost", pass: Math.abs(result.timeLost - 1.198) < 0.01 },
  {
    name: "coachingMessage",
    pass:
      typeof result.coachingMessage === "string" &&
      result.coachingMessage.length > 20,
  },
];

checks.forEach((c) => console.log(`${c.pass ? "✅" : "❌"} ${c.name}`));

if (checks.every((c) => c.pass)) {
  console.log("\n✅ Analysis correct.");
} else {
  console.log("\n❌ Something's off. Look at the output and trace it back.");
}

// --- Level 2: Stint analysis ---
console.log("\n\n=== LEVEL 2: Stint Analysis ===\n");

const stint = analyzeStint(referenceLap, [driverLap, driverLap2], config);

for (const lapResult of stint.lapAnalyses) {
  console.log(`--- ${lapResult.lapLabel} ---`);
  console.log(JSON.stringify(lapResult.coaching, null, 2));
  console.log(`Total delta: +${lapResult.analysis.totalDelta.toFixed(3)}s`);
  console.log();
}

console.log("--- Sector Trends ---");
for (const trend of stint.trends) {
  console.log(
    `  S${trend.sector}: ${trend.issue} [${trend.trend}] — deltas: ${trend.deltaProgression.map((d) => `+${d.toFixed(3)}`).join(" → ")}`
  );
}

console.log("\n--- Stint Summary (PitGPT) ---");
console.log(stint.stintSummary);
console.log("-----------------------------");
