/**
 * @repo/challenge-easy — Exportable analysis pipeline
 *
 * Re-exports the core types, data, and functions so apps/api can import them.
 * The original challenge.ts remains runnable standalone.
 */

// ============================================================
// TYPES
// ============================================================

export interface BrakingPoint {
  turn: string;
  brakeMarker: number;
  trailBraking: boolean;
}

export interface DriverBrakingPoint extends BrakingPoint {
  lockup: boolean;
  tcActive: boolean;
}

export interface TyreTemps {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
}

export interface TyreData {
  avgSlip: number;
  peakSlip: number;
  avgTemp: TyreTemps;
}

export interface ThrottleTrace {
  earlyLift: boolean;
  smoothApplication: boolean;
  fullThrottlePercent: number;
}

export interface ReferenceSector {
  time: number;
  brakingPoints: BrakingPoint[];
}

export interface DriverSector {
  time: number;
  delta: number;
  brakingPoints: DriverBrakingPoint[];
  tyreData: TyreData;
  throttleTrace: ThrottleTrace;
}

export interface ReferenceLap {
  track: string;
  car: string;
  totalTime: number;
  sectors: Record<string, ReferenceSector>;
}

export interface DriverLap {
  track: string;
  car: string;
  totalTime: number;
  sectors: Record<string, DriverSector>;
  stintLap?: number;
}

export type Issue = "late_braking" | "early_lift" | "traction_loss" | "overcorrection";

export interface SectorFinding {
  sector: number;
  sectorKey: string;
  delta: number;
  issue: Issue;
  details: string;
}

export interface LapAnalysis {
  findings: SectorFinding[];
  totalDelta: number;
}

export interface CoachingOutput {
  problemSector: number;
  issue: Issue;
  timeLost: number;
  coachingMessage: string;
}

export interface StintTrend {
  sector: number;
  issue: Issue;
  trend: "worsening" | "stable" | "improving";
  deltaProgression: number[];
  summary: string;
}

export interface StintAnalysis {
  lapAnalyses: { lapLabel: string; analysis: LapAnalysis; coaching: CoachingOutput }[];
  trends: StintTrend[];
  stintSummary: string;
}

export interface Config {
  coachVoice: "generic" | "pitgpt";
  units: "metric" | "imperial";
}

// ============================================================
// DATA
// ============================================================

export const referenceLap: ReferenceLap = {
  track: "Spa-Francorchamps",
  car: "Porsche 963 LMdh",
  totalTime: 133.412,
  sectors: {
    s1: {
      time: 41.203,
      brakingPoints: [{ turn: "T1 La Source", brakeMarker: 92, trailBraking: true }],
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

export const driverLap: DriverLap = {
  track: "Spa-Francorchamps",
  car: "Porsche 963 LMdh",
  totalTime: 135.067,
  stintLap: 1,
  sectors: {
    s1: {
      time: 41.59, delta: +0.387,
      brakingPoints: [{ turn: "T1 La Source", brakeMarker: 89, trailBraking: true, lockup: false, tcActive: false }],
      tyreData: { avgSlip: 0.032, peakSlip: 0.071, avgTemp: { fl: 94, fr: 97, rl: 91, rr: 92 } },
      throttleTrace: { earlyLift: false, smoothApplication: true, fullThrottlePercent: 0.78 },
    },
    s2: {
      time: 50.085, delta: +1.198,
      brakingPoints: [
        { turn: "T6 Rivage", brakeMarker: 56, trailBraking: false, lockup: false, tcActive: true },
        { turn: "T10 Pouhon", brakeMarker: 41, trailBraking: true, lockup: false, tcActive: false },
      ],
      tyreData: { avgSlip: 0.058, peakSlip: 0.134, avgTemp: { fl: 101, fr: 104, rl: 97, rr: 99 } },
      throttleTrace: { earlyLift: false, smoothApplication: false, fullThrottlePercent: 0.62 },
    },
    s3: {
      time: 43.392, delta: +0.07,
      brakingPoints: [
        { turn: "T14 Stavelot", brakeMarker: 54, trailBraking: true, lockup: false, tcActive: false },
        { turn: "T18 Bus Stop", brakeMarker: 76, trailBraking: false, lockup: false, tcActive: false },
      ],
      tyreData: { avgSlip: 0.029, peakSlip: 0.065, avgTemp: { fl: 93, fr: 96, rl: 90, rr: 91 } },
      throttleTrace: { earlyLift: false, smoothApplication: true, fullThrottlePercent: 0.81 },
    },
  },
};

export const driverLap2: DriverLap = {
  track: "Spa-Francorchamps",
  car: "Porsche 963 LMdh",
  totalTime: 136.841,
  stintLap: 14,
  sectors: {
    s1: {
      time: 42.105, delta: +0.902,
      brakingPoints: [{ turn: "T1 La Source", brakeMarker: 96, trailBraking: false, lockup: false, tcActive: false }],
      tyreData: { avgSlip: 0.041, peakSlip: 0.088, avgTemp: { fl: 99, fr: 103, rl: 96, rr: 98 } },
      throttleTrace: { earlyLift: true, smoothApplication: true, fullThrottlePercent: 0.71 },
    },
    s2: {
      time: 51.203, delta: +2.316,
      brakingPoints: [
        { turn: "T6 Rivage", brakeMarker: 61, trailBraking: false, lockup: true, tcActive: true },
        { turn: "T10 Pouhon", brakeMarker: 48, trailBraking: false, lockup: false, tcActive: true },
      ],
      tyreData: { avgSlip: 0.079, peakSlip: 0.168, avgTemp: { fl: 108, fr: 112, rl: 104, rr: 107 } },
      throttleTrace: { earlyLift: false, smoothApplication: false, fullThrottlePercent: 0.49 },
    },
    s3: {
      time: 43.533, delta: +0.211,
      brakingPoints: [
        { turn: "T14 Stavelot", brakeMarker: 58, trailBraking: true, lockup: false, tcActive: false },
        { turn: "T18 Bus Stop", brakeMarker: 81, trailBraking: false, lockup: false, tcActive: true },
      ],
      tyreData: { avgSlip: 0.044, peakSlip: 0.091, avgTemp: { fl: 101, fr: 105, rl: 98, rr: 100 } },
      throttleTrace: { earlyLift: true, smoothApplication: true, fullThrottlePercent: 0.68 },
    },
  },
};

// ============================================================
// ANALYSIS
// ============================================================

export function detectIssue(
  driverSector: DriverSector,
  refSector: ReferenceSector
): { issue: Issue; details: string } {
  const { brakingPoints, tyreData, throttleTrace } = driverSector;

  if (throttleTrace.earlyLift) {
    return {
      issue: "early_lift",
      details: `Throttle lift detected before braking zone. Full throttle: ${(throttleTrace.fullThrottlePercent * 100).toFixed(0)}%`,
    };
  }

  const hasTcActivation = brakingPoints.some((bp) => bp.tcActive);
  const highSlip = tyreData.peakSlip > 0.1;
  const lowThrottle = throttleTrace.fullThrottlePercent < 0.7;

  if (hasTcActivation && highSlip && lowThrottle) {
    return {
      issue: "traction_loss",
      details: `TC active, peak slip ${tyreData.peakSlip.toFixed(3)}, full throttle only ${(throttleTrace.fullThrottlePercent * 100).toFixed(0)}%`,
    };
  }

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

  if (tyreData.avgSlip > 0.05 && !hasTcActivation) {
    return {
      issue: "overcorrection",
      details: `High average slip ${tyreData.avgSlip.toFixed(3)} without TC — likely excessive steering input`,
    };
  }

  return {
    issue: "late_braking",
    details: "No single clear cause — general time loss through sector",
  };
}

export function analyzeLap(reference: ReferenceLap, driver: DriverLap): LapAnalysis {
  const sectorKeys = Object.keys(driver.sectors);
  const findings: SectorFinding[] = [];

  for (const key of sectorKeys) {
    const driverSector = driver.sectors[key];
    const refSector = reference.sectors[key];
    if (!driverSector || !refSector) continue;

    const sectorNum = parseInt(key.replace("s", ""));
    const { issue, details } = detectIssue(driverSector, refSector);
    findings.push({ sector: sectorNum, sectorKey: key, delta: driverSector.delta, issue, details });
  }

  findings.sort((a, b) => b.delta - a.delta);
  const totalDelta = findings.reduce((sum, f) => sum + f.delta, 0);
  return { findings, totalDelta };
}

// ============================================================
// COACH
// ============================================================

export function generateMessage(finding: SectorFinding, config: Config): string {
  if (config.coachVoice === "pitgpt") return generatePitGPTMessage(finding);
  return generateGenericMessage(finding);
}

function generateGenericMessage(finding: SectorFinding): string {
  const sector = `Sector ${finding.sector}`;
  const delta = `+${finding.delta.toFixed(3)}s`;
  switch (finding.issue) {
    case "late_braking": return `${sector} (${delta}): Late braking detected. ${finding.details}. Consider matching reference braking points.`;
    case "early_lift": return `${sector} (${delta}): Early throttle lift detected. ${finding.details}. Maintain full throttle deeper into braking zone.`;
    case "traction_loss": return `${sector} (${delta}): Traction loss identified. ${finding.details}. Reduce throttle application rate on exit.`;
    case "overcorrection": return `${sector} (${delta}): Overcorrection detected. ${finding.details}. Reduce steering input to lower tyre scrub.`;
  }
}

function generatePitGPTMessage(finding: SectorFinding): string {
  const delta = `${finding.delta.toFixed(3)}`;
  switch (finding.issue) {
    case "late_braking": return `You're losing ${delta} in sector ${finding.sector}. ${finding.details}. Brake earlier, carry more speed through the apex.`;
    case "early_lift": return `Sector ${finding.sector}, ${delta} off. You're lifting before the braking zone — keep your foot in, trust the car.`;
    case "traction_loss": return `Sector ${finding.sector} is where the lap falls apart — ${delta} lost. TC is fighting you. Smooth the throttle on exit.`;
    case "overcorrection": return `${delta} gone in sector ${finding.sector}. You're sawing at the wheel. Less steering, let the front bite.`;
  }
}

export function generateCoaching(analysis: LapAnalysis, config: Config): CoachingOutput {
  const worst = analysis.findings[0];
  if (!worst) {
    return { problemSector: 0, issue: "late_braking", timeLost: 0, coachingMessage: "No significant issues found. Clean lap." };
  }
  return {
    problemSector: worst.sector,
    issue: worst.issue,
    timeLost: worst.delta,
    coachingMessage: generateMessage(worst, config),
  };
}

// ============================================================
// STINT ANALYSIS
// ============================================================

export function detectStintTrends(lapAnalyses: LapAnalysis[]): StintTrend[] {
  const trends: StintTrend[] = [];
  for (let s = 0; s < 3; s++) {
    const sectorNum = s + 1;
    const sectorFindings = lapAnalyses.map((la) => la.findings.find((f) => f.sector === sectorNum));
    const deltas = sectorFindings.map((f) => f?.delta ?? 0);
    const issues = sectorFindings.map((f) => f?.issue ?? "late_braking");
    const firstDelta = deltas[0] ?? 0;
    const lastDelta = deltas[deltas.length - 1] ?? 0;
    const deltaChange = lastDelta - firstDelta;

    let trend: StintTrend["trend"];
    if (deltaChange > 0.3) trend = "worsening";
    else if (deltaChange < -0.3) trend = "improving";
    else trend = "stable";

    const dominantIssue = issues[issues.length - 1]!;
    const issueLabel = dominantIssue.replace("_", " ");
    let summary: string;
    if (trend === "worsening") summary = `${issueLabel} worsening in S${sectorNum} — delta grew +${firstDelta.toFixed(3)}s to +${lastDelta.toFixed(3)}s`;
    else if (trend === "improving") summary = `${issueLabel} improving in S${sectorNum} — delta reduced +${firstDelta.toFixed(3)}s to +${lastDelta.toFixed(3)}s`;
    else summary = `S${sectorNum} stable — consistent ${issueLabel}`;

    trends.push({ sector: sectorNum, issue: dominantIssue, trend, deltaProgression: deltas, summary });
  }
  return trends;
}

export function generateStintSummary(trends: StintTrend[], config: Config): string {
  const worsening = trends.filter((t) => t.trend === "worsening");
  const improving = trends.filter((t) => t.trend === "improving");

  if (config.coachVoice === "pitgpt") {
    const parts: string[] = [];
    if (worsening.length > 0) {
      const worstTrend = [...worsening].sort(
        (a, b) => (b.deltaProgression[b.deltaProgression.length - 1]! - b.deltaProgression[0]!) -
          (a.deltaProgression[a.deltaProgression.length - 1]! - a.deltaProgression[0]!)
      )[0]!;
      parts.push(`Sector ${worstTrend.sector} is getting away from you — ${worstTrend.issue.replace("_", " ")} is worse every lap.`);
    }
    if (improving.length > 0) parts.push(`Good news — S${improving[0]!.sector} is trending the right way.`);

    const hasEarlyLift = trends.some((t) => t.issue === "early_lift" && t.trend === "worsening");
    const hasTractionLoss = trends.some((t) => t.issue === "traction_loss" && t.trend === "worsening");
    if (hasEarlyLift && hasTractionLoss) parts.push("You're lifting early to compensate for the rear sliding. Manage through smoother inputs, not backing off earlier.");
    else if (hasEarlyLift) parts.push("Early lifts creeping in as tyres degrade. Trust the grip window.");
    else if (hasTractionLoss) parts.push("Traction dropping off. Feed the throttle in progressively on exit.");
    return parts.join(" ");
  }
  return trends.map((t) => t.summary).join("\n");
}

export function analyzeStint(reference: ReferenceLap, laps: DriverLap[], config: Config): StintAnalysis {
  const lapAnalyses = laps.map((lap, i) => {
    const analysis = analyzeLap(reference, lap);
    const coaching = generateCoaching(analysis, config);
    return { lapLabel: lap.stintLap ? `Stint Lap ${lap.stintLap}` : `Lap ${i + 1}`, analysis, coaching };
  });
  const trends = detectStintTrends(lapAnalyses.map((la) => la.analysis));
  const stintSummary = generateStintSummary(trends, config);
  return { lapAnalyses, trends, stintSummary };
}
