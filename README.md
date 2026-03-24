<p align="center">
  <img src="https://img.shields.io/badge/RACEMAKE-Product_Engineer_Challenge-000?style=for-the-badge" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Bun-000?style=flat-square&logo=bun&logoColor=white" />
  <img src="https://img.shields.io/badge/Hono-E36002?style=flat-square&logo=hono&logoColor=white" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=000" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/C++-00599C?style=flat-square&logo=cplusplus&logoColor=white" />
  <img src="https://img.shields.io/badge/Rust-000?style=flat-square&logo=rust&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Prague-CZ-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Experience-15+_years-333?style=flat-square" />
  <img src="https://img.shields.io/badge/Exits-3_founded_&_sold-333?style=flat-square" />
</p>

---

## Structure

Turborepo monorepo. Each challenge is a self-contained package.

```
apps/
  api/              # Hono API — mounts all challenges with Scalar docs
packages/
  challenge-easy/
    src/original/   # Untouched challenge file from RACEMAKE
    src/solution/   # Our solution — bug fix, stint extension, scaling answer
  challenge-hard/
    src/original/   # Untouched challenge file from RACEMAKE
    src/solution/   # Our solution — Hono API with telemetry processing
```

### Live API

**https://racemake-challenge-production.up.railway.app**

- **Docs (Scalar):** [/docs](https://racemake-challenge-production.up.railway.app/docs)
- **Easy — Analyze:** [/api/v2/easy/analyze](https://racemake-challenge-production.up.railway.app/api/v2/easy/analyze)
- **Easy — Stint:** [/api/v2/easy/stint](https://racemake-challenge-production.up.railway.app/api/v2/easy/stint)
- **Hard — Laps:** [/api/v2/hard/laps](https://racemake-challenge-production.up.railway.app/api/v2/hard/laps)
- **Hard — Analysis:** [/api/v2/hard/analysis](https://racemake-challenge-production.up.railway.app/api/v2/hard/analysis)
- **IRL — Architecture:** [/api/v2/irl](https://racemake-challenge-production.up.railway.app/api/v2/irl)
- **IRL — Wire Format Codec:** [/api/v2/irl/codec/compare](https://racemake-challenge-production.up.railway.app/api/v2/irl/codec/compare)
- **IRL — Roundtrip Proof:** [/api/v2/irl/codec/roundtrip](https://racemake-challenge-production.up.railway.app/api/v2/irl/codec/roundtrip)
- **IRL — SSE Stream:** [/api/v2/irl/stream](https://racemake-challenge-production.up.railway.app/api/v2/irl/stream)

### Quick Start (Local)

```bash
pnpm install

# Full API with all routes + Scalar docs
npx tsx apps/api/src/index.ts

# Easy challenge standalone
pnpm --filter @repo/challenge-easy start

# Hard challenge standalone + integration test
npx tsx packages/challenge-hard/src/solution/test.ts
```

---

## Challenge Solutions

### Easy — `@repo/challenge-easy`

**Level 1 (Fix it):** The sort comparator in `analyzeLap` was `a.delta - b.delta` — ascending. Since `generateCoaching` picks `findings[0]` as the worst sector, it was returning the *least* time lost instead of the most. Fix: `b.delta - a.delta`. One-line diff.

**Level 2 (Extend it):** Added `analyzeStint()` that runs `analyzeLap` for each driver lap and detects sector-level trends across the stint. Tracks delta progression per sector, classifies trends as worsening/stable/improving, and generates a PitGPT stint summary that catches compensation patterns (e.g., early lifts masking traction loss from degraded tyres).

**Level 3 (Think about it):** See the comment block in `challenge.ts`. TL;DR — memory dies first at 20 cars x 50 laps x 120 Hz. Stream-process into a time-series store, isolate per-car in workers, add backpressure, debounce coaching at sector boundaries.

### Hard — `@repo/challenge-hard`

Three endpoints built on Hono:

| Endpoint | What it does |
|---|---|
| `POST /ingest` | Accepts raw telemetry frames, stores in memory |
| `GET /laps` | Returns completed lap summaries with sector splits, speed metrics |
| `GET /analysis` | Compares laps, finds worst sector of worst lap, detects issue, returns PitGPT coaching |

Edge cases handled:
- **Out-lap excluded** — lap 0 starts at pos 0.541, not from the start/finish line
- **Incomplete lap excluded** — lap 4 only has S1 data
- **Stationary frames filtered** — speed < 5 with unchanged position
- **Issue detection** — tyre overheat (>110C) correctly identified in lap 3 S2

---

## IRL Challenge: Reverse Engineering & Telemetry Pipelines

> The job listing says *"Debug and fix telemetry format changes from game updates rapidly."*
> Here's how I'd actually do it — and have been doing it.

### The Problem

Sim racing telemetry is extracted from game memory or APIs. When the game patches, offsets shift, structs change, and your pipeline breaks. The community waits for someone to reverse-engineer the new offsets. That wait kills your product.

### The Solution: Runtime Schema Extraction

I built this exact system for Source 2 games. Instead of hardcoding offsets that break every patch:

1. **Inject at runtime** — Manual PE mapping (no LoadLibrary, invisible to module list). DLL hooks into the game process via vtable interception.

2. **Extract the schema from the game itself** — Source 2 exposes its own `SchemaSystem` at runtime. Walk it programmatically to dump every class, field, offset, and inheritance chain. The game *tells you* its own structure.

3. **Generate a patch-proof SDK** — Field offsets resolve dynamically at runtime through the schema, not through hardcoded values. When the game patches, the schema changes — but the resolution mechanism doesn't. Zero manual work.

4. **Ship it downstream** — The extracted schema feeds directly into SDK generators, producing typed C++ headers (2,400+ structs, 229 entity classes) and complete JSON exports for tooling consumers.

This is what [dezlock-dump](https://github.com/dougwithseismic/dezlock-dump) does. 82 commits, built from scratch.

### Applied to Racing Telemetry

The pattern is identical for sim racing:

```
Game Process -> DLL Injection -> Schema Extraction -> Typed SDK -> Telemetry Pipeline -> Analysis
```

For RACEMAKE's stack specifically:

- **Game update drops** -> Run the schema extractor -> New offsets in minutes, not days
- **Telemetry format changes** -> The SDK regenerates automatically, typed against the game's own definitions
- **New data fields appear** -> They show up in the schema dump before anyone documents them

### Staying Current: Offsets & Dumps

The key insight: you don't reverse-engineer offsets manually anymore. You build systems that extract them. Relevant tooling:

| Tool | What it does | Repo |
|---|---|---|
| **dezlock-dump** | Runtime RTTI + schema extraction, auto SDK generation, signature scanning across 58+ DLLs | [Link](https://github.com/dougwithseismic/dezlock-dump) |
| **s2-framework** | ML bot training via DLL injection + TCP telemetry streaming to Python/PyTorch. The exact inject-extract-stream pattern. | [Link](https://github.com/dougwithseismic/s2-framework) |
| **memory-hooking-tool** | Process memory R/W with TypeScript scripting. Pattern scanning, PE parsing, full automation layer. | [Link](https://github.com/dougwithseismic/memory-hooking-tool) |
| **arc-probe** | AI-agent-driven process inspector. DLL injection, disassembly, struct mapping — all controllable via Claude Code skills. Tauri v2 app (Rust + React). | [Link](https://github.com/vzco/arc-probe) |

### Optimal Approaches

**For schema stability:**
- Runtime resolution over hardcoded offsets. Always.
- Pattern signatures (byte sequences) as fallback — they survive minor patches where full schema extraction isn't available.
- Version-tagged schema caches so you can diff between game versions and auto-detect what changed.

**For pipeline resilience:**
- Protobuf/flatbuffers for wire format — schema evolution is built into the protocol.
- The recorder (Tauri/Rust side) should be schema-aware, not just dumping raw bytes. If a field moves, the recorder adapts.
- Canary checks: on game startup, validate a handful of known field values against expected ranges. If they're wrong, the schema shifted — alert before sending garbage downstream.

**For staying ahead of the community:**
- Build your own extractor. Don't wait for community dumps.
- Automate the dump pipeline: game update detected -> inject -> extract -> diff -> PR -> deploy. CI for reverse engineering.
- Monitor game beta branches — schema changes usually land there first.

### Wire Format: Why JSON Telemetry is Wild

Raw JSON at 120Hz is ~131 bytes per frame. At 20 cars that's **307 KB/s** of pure overhead — field names repeated every frame, no delta encoding, no schema versioning.

The `/api/v2/irl/codec` routes demonstrate a production alternative:

| Format | Per Frame | 20 cars @ 120Hz | Reduction |
|---|---|---|---|
| JSON | ~131 bytes | 307 KB/s | — |
| Binary (v1 schema) | 19 bytes | 45 KB/s | **85.5%** |
| Delta-encoded | ~6 bytes avg | ~14 KB/s | **95.4%** |

**Key features of the codec:**
- **Versioned schema registry** — When the game patches and adds fields, add a new schema version. Old consumers still work (forward compatibility). Same principle as Protobuf field numbers.
- **Two-way map** — `encode()` and `decode()` are proven lossless across all 166 telemetry frames via the `/roundtrip` endpoint. Quantization is below sensor noise floor.
- **Delta encoding** — Consecutive frames at 120Hz differ in maybe 3-4 fields. Only transmit what changed. A 2-byte bitmask header + changed field bytes.

In production, you'd use Protobuf (which RACEMAKE already does) or FlatBuffers for zero-copy. This is a from-scratch implementation to show the principles.

[Try it live: /api/v2/irl/codec/compare](https://racemake-challenge-production.up.railway.app/api/v2/irl/codec/compare)

---

## Covering Letter

Hey Racemake — You won't find a closer fit in Prague than me for this work; I'm working exclusively with gaming tools & reverse engineering across C++, Rust (Tauri mostly) and React. I've made it my mission to ditch boring B2B SaaS clients and follow my passion at the intersect of gaming, AI, and automation.

First up, the important part — your challenges — the basic, the hard, and some extra docs around the "IRL scenario" based on my experience building Game Event API pipelines for Source 2 games: like Counterstrike, Dota, and Deadlock: **[See above]**

### Previous Work

- **Reinforcement learning platform** — Spins up Counterstrike matches at 20x speed to build complex bots powered by a model that self-improves with an LLM pilot. C++, Rust, Python, React — has it all; including some Tauri overlays with a shared-memory approach to live data.
  - Repo: [s2-framework](https://github.com/dougwithseismic/s2-framework)
  - Video: [YouTube Demo](https://www.youtube.com/watch?v=Cj94lSUH5io)

- **Reverse engineering tool** — Built to hook into thousands of games and build data pipelines for esports, game assist tools, and patches/mods. Used by the team at [wand.com](https://wand.com) (WeMod).
  - Repo: [arc-probe](https://github.com/vzco/arc-probe)

### The Challenge

I can point to many more examples, but how about this — I challenge you to give me a racesim game title for me to buy on Steam, and I'll build, from scratch, the entire data pipeline, storage, API layer, realtime overlay, and fullstack React app.

### Let's Talk

Or let's just talk ASAP instead; the salary makes sense — as long as I'm paying my rent and working on a passion project I care about, you'll be hard pressed to keep me on part-time. (Unpaid is fine).

Here's me: [ARES](https://www.finmag.cz/obchodni-rejstrik/ares/10911243-douglas-anthony-silkstone)

Enjoyed the challenge — hope you don't mind I ran with it and made it my own. Shout me on LinkedIn / call me; don't play this cool :)

— Doug

---

<p align="center">
  <a href="https://github.com/dougwithseismic">github.com/dougwithseismic</a>
</p>
