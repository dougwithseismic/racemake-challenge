"use client";

import { useRef, useEffect, useCallback } from "react";

// Accurate Spa-Francorchamps layout — 58 control points traced from circuit map
// Normalized to 0-1 range, y-axis top-to-bottom matching canvas coordinates
const SPA_POINTS: [number, number][] = [
  // Start/Finish line
  [0.215, 0.620],

  // S/F straight going down toward La Source
  [0.200, 0.660],
  [0.175, 0.710],
  [0.145, 0.760],
  [0.115, 0.800],

  // La Source hairpin (Turn 1)
  [0.085, 0.840],
  [0.065, 0.875],
  [0.055, 0.905],
  [0.070, 0.935],
  [0.100, 0.945],
  [0.135, 0.920],

  // After La Source heading left toward Eau Rouge (Turn 2)
  [0.100, 0.870],
  [0.065, 0.800],
  [0.035, 0.720],
  [0.020, 0.650],

  // Eau Rouge entry (Turns 3-4)
  [0.030, 0.570],
  [0.060, 0.500],
  [0.095, 0.450],

  // Raidillon (Turn 5) — steep uphill
  [0.140, 0.390],
  [0.185, 0.330],
  [0.220, 0.280],

  // Kemmel Straight (Turn 6)
  [0.270, 0.230],
  [0.330, 0.180],
  [0.420, 0.130],
  [0.520, 0.095],
  [0.620, 0.065],

  // Les Combes approach (Turn 7)
  [0.700, 0.045],
  [0.740, 0.040],

  // Les Combes (Turns 8-9)
  [0.775, 0.055],
  [0.795, 0.040],
  [0.825, 0.060],

  // Heading to Bruxelles (Turn 10)
  [0.870, 0.070],
  [0.930, 0.100],
  [0.970, 0.135],

  // Bruxelles (Turn 11)
  [0.965, 0.185],
  [0.930, 0.225],
  [0.885, 0.250],

  // Toward Pouhon (Turn 12)
  [0.820, 0.270],
  [0.740, 0.285],
  [0.650, 0.310],
  [0.575, 0.340],

  // Pouhon double-apex
  [0.530, 0.365],
  [0.525, 0.395],
  [0.555, 0.415],

  // Heading right toward Campus
  [0.630, 0.405],
  [0.720, 0.410],

  // Campus (Turns 13-14)
  [0.810, 0.435],
  [0.860, 0.475],
  [0.880, 0.525],

  // Stavelot (Turn 15)
  [0.895, 0.595],
  [0.905, 0.655],

  // Paul Frère (Turn 16)
  [0.895, 0.725],
  [0.860, 0.795],
  [0.800, 0.825],

  // Blanchimont (Turns 17-18)
  [0.720, 0.805],
  [0.640, 0.755],
  [0.550, 0.690],
  [0.460, 0.640],
  [0.380, 0.605],

  // Bus Stop Chicane (Turns 19-20)
  [0.320, 0.590],
  [0.275, 0.600],
  [0.255, 0.580],
  [0.235, 0.600],

  // Back to S/F
  [0.215, 0.620],
];

// Corner labels with approximate track positions (0-1 along the path)
const CORNER_LABELS: { pos: number; label: string; offset: [number, number] }[] = [
  { pos: 0.000, label: "S/F", offset: [14, -8] },
  { pos: 0.075, label: "La Source", offset: [-40, 12] },
  { pos: 0.195, label: "Eau Rouge", offset: [-45, 8] },
  { pos: 0.260, label: "Raidillon", offset: [-42, -6] },
  { pos: 0.380, label: "Kemmel", offset: [0, -10] },
  { pos: 0.455, label: "Les Combes", offset: [0, -10] },
  { pos: 0.535, label: "Bruxelles", offset: [10, -6] },
  { pos: 0.615, label: "Pouhon", offset: [-30, -10] },
  { pos: 0.720, label: "Stavelot", offset: [10, -6] },
  { pos: 0.775, label: "P. Frère", offset: [10, 6] },
  { pos: 0.850, label: "Blanchimont", offset: [0, -10] },
  { pos: 0.945, label: "Bus Stop", offset: [-8, -10] },
];

const S1_END = 0.333;
const S2_END = 0.667;

function catmullRom(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], t: number): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

function getTrackPoint(pos: number): [number, number] {
  const n = SPA_POINTS.length - 1;
  const scaled = pos * n;
  const i = Math.floor(scaled);
  const t = scaled - i;
  const p0 = SPA_POINTS[(i - 1 + n) % n]!;
  const p1 = SPA_POINTS[i % n]!;
  const p2 = SPA_POINTS[(i + 1) % n]!;
  const p3 = SPA_POINTS[(i + 2) % n]!;
  return catmullRom(p0, p1, p2, p3, t);
}

function getSectorColor(pos: number): string {
  if (pos < S1_END) return "#ffcc00";
  if (pos < S2_END) return "#ff3333";
  return "#00cccc";
}

interface TrackMapProps {
  carPos: number;
  speed: number;
  sector: number;
  lap: number;
  gear?: number;
  throttle?: number;
  brake?: number;
  rpm?: number;
  active: boolean;
}

export function TrackMap({ carPos, speed, sector, lap, gear, throttle, brake, rpm, active }: TrackMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const trailRef = useRef<{ pos: number; spd: number }[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, w, h);

    // Layout: track on left, telemetry HUD on right
    const hudWidth = Math.min(280, w * 0.35);
    const trackAreaW = w - hudWidth;
    const pad = 30;
    const drawW = trackAreaW - pad * 2;
    const drawH = h - pad * 2;

    const toCanvas = (p: [number, number]): [number, number] => [
      pad + p[0] * drawW,
      pad + p[1] * drawH,
    ];

    // -- TRACK --

    // Track surface (wide dim background)
    const segments = 300;
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const p0 = toCanvas(getTrackPoint(t0));
      const p1 = toCanvas(getTrackPoint(t1));

      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 16;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Track center line with sector colors
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const p0 = toCanvas(getTrackPoint(t0));
      const p1 = toCanvas(getTrackPoint(t1));

      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.strokeStyle = getSectorColor(t0);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Sector boundary markers
    [S1_END, S2_END, 0].forEach((sPos) => {
      const p = toCanvas(getTrackPoint(sPos));
      // Cross marker
      ctx.beginPath();
      ctx.moveTo(p[0] - 5, p[1] - 5);
      ctx.lineTo(p[0] + 5, p[1] + 5);
      ctx.moveTo(p[0] + 5, p[1] - 5);
      ctx.lineTo(p[0] - 5, p[1] + 5);
      ctx.strokeStyle = sPos === 0 ? "#ffffff" : "#555555";
      ctx.lineWidth = sPos === 0 ? 2 : 1;
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Corner name labels
    ctx.font = "8px monospace";
    ctx.globalAlpha = 0.35;
    CORNER_LABELS.forEach(({ pos, label, offset }) => {
      const p = toCanvas(getTrackPoint(pos));
      ctx.fillStyle = "#888888";
      ctx.textAlign = "center";
      ctx.fillText(label, p[0] + offset[0], p[1] + offset[1]);
    });
    ctx.globalAlpha = 1;

    // Trail behind car
    const trail = trailRef.current;
    if (trail.length > 1) {
      for (let i = Math.max(0, trail.length - 60); i < trail.length - 1; i++) {
        const t = trail[i]!;
        const p = toCanvas(getTrackPoint(t.pos));
        const age = (trail.length - 1 - i) / 60;
        const spdNorm = Math.min(t.spd / 320, 1);
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.5 + spdNorm * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = getSectorColor(t.pos);
        ctx.globalAlpha = Math.max(0, 0.7 - age * 0.7);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Car dot
    if (active || trail.length > 0) {
      const cp = toCanvas(getTrackPoint(carPos));
      const spdNorm = Math.min(speed / 320, 1);
      const radius = 5 + spdNorm * 3;
      const sectorCol = getSectorColor(carPos);

      // Outer glow
      const glow = ctx.createRadialGradient(cp[0], cp[1], 0, cp[0], cp[1], radius * 4);
      glow.addColorStop(0, sectorCol);
      glow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cp[0], cp[1], radius * 4, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;

      // White outer ring
      ctx.beginPath();
      ctx.arc(cp[0], cp[1], radius + 1, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Colored inner
      ctx.beginPath();
      ctx.arc(cp[0], cp[1], radius - 1, 0, Math.PI * 2);
      ctx.fillStyle = sectorCol;
      ctx.fill();
    }

    // -- TELEMETRY HUD (right side) --
    const hx = trackAreaW + 10;
    const hy = 20;
    const hw = hudWidth - 20;

    // Speed dial
    const dialCx = hx + hw / 2;
    const dialCy = hy + 75;
    const dialR = 55;

    // Dial background arc
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    ctx.beginPath();
    ctx.arc(dialCx, dialCy, dialR, startAngle, endAngle);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.stroke();

    // Speed fill arc
    const spdNorm = Math.min(speed / 320, 1);
    const spdAngle = startAngle + spdNorm * (endAngle - startAngle);
    if (speed > 0) {
      ctx.beginPath();
      ctx.arc(dialCx, dialCy, dialR, startAngle, spdAngle);
      ctx.strokeStyle = speed > 250 ? "#ff3333" : speed > 150 ? "#ffcc00" : "#00ff00";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.stroke();

      // Tick marks
      for (let i = 0; i <= 8; i++) {
        const a = startAngle + (i / 8) * (endAngle - startAngle);
        const inner = dialR - 10;
        const outer = dialR - 4;
        ctx.beginPath();
        ctx.moveTo(dialCx + Math.cos(a) * inner, dialCy + Math.sin(a) * inner);
        ctx.lineTo(dialCx + Math.cos(a) * outer, dialCy + Math.sin(a) * outer);
        ctx.strokeStyle = "#333333";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Speed number
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8e8e8";
    ctx.fillText(`${speed}`, dialCx, dialCy + 10);

    // KPH label
    ctx.font = "9px monospace";
    ctx.fillStyle = "#555555";
    ctx.fillText("KPH", dialCx, dialCy + 24);

    // Gear indicator (top of dial)
    if (gear !== undefined) {
      ctx.font = "bold 14px monospace";
      ctx.fillStyle = "#00ff00";
      ctx.fillText(`${gear}`, dialCx, dialCy - 30);
      ctx.font = "7px monospace";
      ctx.fillStyle = "#333333";
      ctx.fillText("GEAR", dialCx, dialCy - 40);
    }

    // RPM under speed
    if (rpm !== undefined) {
      ctx.font = "12px monospace";
      ctx.fillStyle = "#555555";
      ctx.fillText(`${rpm.toLocaleString()}`, dialCx, dialCy + 40);
      ctx.font = "7px monospace";
      ctx.fillStyle = "#333333";
      ctx.fillText("RPM", dialCx, dialCy + 52);
    }

    // Throttle and Brake bars
    const barY = dialCy + 70;
    const barW = (hw - 16) / 2;
    const barH = 10;

    // Brake bar
    const brkX = hx + 4;
    ctx.font = "7px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#555555";
    ctx.fillText("BRAKE", brkX, barY - 4);
    // Background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(brkX, barY, barW, barH);
    // Fill - segmented
    const brkVal = brake ?? 0;
    const brkSegs = Math.floor(brkVal * 20);
    for (let i = 0; i < brkSegs; i++) {
      const sx = brkX + (i / 20) * barW + 1;
      const sw = barW / 20 - 2;
      ctx.fillStyle = brkVal > 0.7 ? "#ff3333" : "#888888";
      ctx.fillRect(sx, barY + 1, sw, barH - 2);
    }

    // Throttle bar
    const thrX = hx + 4 + barW + 8;
    ctx.font = "7px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#555555";
    ctx.fillText("THROTTLE", thrX, barY - 4);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(thrX, barY, barW, barH);
    const thrVal = throttle ?? 0;
    const thrSegs = Math.floor(thrVal * 20);
    for (let i = 0; i < thrSegs; i++) {
      const sx = thrX + (i / 20) * barW + 1;
      const sw = barW / 20 - 2;
      ctx.fillStyle = "#00ff00";
      ctx.fillRect(sx, barY + 1, sw, barH - 2);
    }

    // Lap & Sector info
    const infoY = barY + 35;
    ctx.font = "7px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#333333";
    ctx.fillText("LAP", hx + 4, infoY);
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = "#e8e8e8";
    ctx.fillText(`${lap}`, hx + 4, infoY + 22);

    ctx.font = "7px monospace";
    ctx.fillStyle = "#333333";
    ctx.fillText("SECTOR", hx + 60, infoY);
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = getSectorColor(carPos);
    ctx.fillText(`S${sector}`, hx + 60, infoY + 22);

    // Track position percentage
    ctx.font = "7px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#333333";
    ctx.fillText("TRACK POS", hx + 130, infoY);
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#555555";
    ctx.fillText(`${(carPos * 100).toFixed(1)}%`, hx + 130, infoY + 22);

    // Track position mini bar
    const miniBarY = infoY + 34;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(hx + 4, miniBarY, hw - 8, 4);
    // S1/S2/S3 sections
    const mbW = hw - 8;
    ctx.fillStyle = "#ffcc00";
    ctx.globalAlpha = 0.3;
    ctx.fillRect(hx + 4, miniBarY, mbW * S1_END, 4);
    ctx.fillStyle = "#ff3333";
    ctx.fillRect(hx + 4 + mbW * S1_END, miniBarY, mbW * (S2_END - S1_END), 4);
    ctx.fillStyle = "#00cccc";
    ctx.fillRect(hx + 4 + mbW * S2_END, miniBarY, mbW * (1 - S2_END), 4);
    ctx.globalAlpha = 1;
    // Car marker on bar
    const markerX = hx + 4 + carPos * mbW;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(markerX - 1, miniBarY - 2, 3, 8);

    // Status indicator
    if (active) {
      const statusY = miniBarY + 20;
      ctx.beginPath();
      ctx.arc(hx + 10, statusY + 3, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#00ff00";
      ctx.fill();
      ctx.font = "8px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#00ff00";
      ctx.fillText("LIVE", hx + 18, statusY + 6);
    }

    // Track name
    ctx.font = "8px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#333333";
    ctx.fillText("SPA-FRANCORCHAMPS", hx + 4, h - 8);

  }, [carPos, speed, sector, lap, gear, throttle, brake, rpm, active]);

  // Update trail
  useEffect(() => {
    if (active && carPos > 0) {
      trailRef.current.push({ pos: carPos, spd: speed });
      if (trailRef.current.length > 300) trailRef.current = trailRef.current.slice(-300);
    }
  }, [carPos, speed, active]);

  // Reset trail on new connection
  useEffect(() => {
    if (!active && carPos === 0) {
      trailRef.current = [];
    }
  }, [active, carPos]);

  // Render loop
  useEffect(() => {
    const render = () => {
      draw();
      animRef.current = requestAnimationFrame(render);
    };
    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full bg-[#050505] border border-border"
      style={{ height: 380, imageRendering: "auto" }}
    />
  );
}
