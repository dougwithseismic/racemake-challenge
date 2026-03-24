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
 *
 * WHAT WE'RE LOOKING FOR
 * ----------------------
 * - Level 1: Can you read unfamiliar code and debug it?
 * - Level 2: Can you extend a codebase while respecting its structure?
 * - Level 3: Do you think about systems, not just functions?
 *
 * Use whatever tools you want — AI, docs, whatever. We expect it.
 * We care about whether you understand what the code does and why your
 * changes work, not whether you typed every character.
 *
 * When completing this challenge, set the coachVoice config to 'pitgpt'
 * — this activates our production coaching tone.
 *
 * SUBMIT
 * ------
 * Send your completed code + output to weare@racemake.com
 * Subject: RACEMAKE – Engineer – [Your Name]
 *
 * If we see the signal, we'll be in touch within 48 hours.
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
    if (refBp && driverBp.brakeMarker < refBp.brakeMarker - 8) {
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

  // Sort by delta — worst sector first
  findings.sort((a, b) => a.delta - b.delta);

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
// RUNNER
// ============================================================

const config: Config = {
  coachVoice: "generic",
  units: "metric",
};

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