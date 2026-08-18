# Code Glass — Build Roadmap (v1.1 — reflects in-app path selection)

**What changed from v1.0:** the CLI-relay vs. MCP decision is no longer something you pick once outside the app — it's a per-project choice made *inside* Code Glass itself, at project setup, in the Electron app. This roadmap now builds toward that: the shared core and both paths get built as before, but Phase 6 (Electron) now includes the onboarding screen that asks "how should this project receive proposals?" and Settings gets a place to manage the MCP server's lifecycle. The manifest schema's `interaction_mode` field and the new `codeglass.app.config.json` file (see the schema doc) are what make this possible without either path needing special-case code elsewhere. See the wireframes deliverable for what this actually looks like on screen.

## Is this achievable? A straight answer.

Yes — and specifically because of the constraints already locked, not despite them. Every individual piece is a known pattern:

- A JSON manifest as shared state → ordinary application data modeling.
- A gate that runs checks and reports pass/fail → this is just CI logic running locally instead of on a server.
- An MCP server with a fixed tool set → the MCP SDK (`@modelcontextprotocol/sdk` for Node, or the Python equivalent) does the protocol plumbing for you; you only write the three tool handlers.
- Zip-on-trigger snapshots → a folder-to-zip function plus a JSON log entry.
- Electron rendering SVG cylinders → Electron is just Chromium + Node; the cylinder is an SVG you already know how to build.

Nothing here needs a research breakthrough. The actual risk, per the earlier research, is **scope creep during the build** — each phase below has an explicit "done when" line specifically to keep that from happening. Treat any urge to add a field, a button, or a config option that isn't required for that phase's "done when" line as a signal to write it down for later, not build it now.

**Realistic solo-developer estimate:** Phases 0–5 (a working single-project tracker with one gate layer, manual confirmation, and snapshots) is a focused 2–4 week build for someone with your Node/Express/Flask background, working solo, evenings/weekends. Phases 6–9 (Electron UI, remaining gate layers, multi-project) roughly double that if done carefully. These are rough anchors, not commitments — the phase boundaries matter more than the calendar.

---

## Before Phase 0: pick your stack once, then stop deciding

Given your existing skills, the lowest-friction choice is:

- **Core engine + MCP server:** Node.js. The official MCP TypeScript SDK is the most mature, and you already work in Express — the MCP server is structurally similar to a small Express app with three routes instead of many.
- **Gate layer 1 (build/tests):** shells out to whatever the target project already uses (`npm test`, `pytest`, etc.) — the gate doesn't need to know how to test a project, only how to run its existing test command and parse pass/fail.
- **Snapshot service:** Node's built-in `zlib`/`archiver` package, or shelling out to a zip binary — either is fine, don't overthink this one.
- **Electron UI:** plain Electron + vanilla JS/SVG for the cylinder, or React if you'd rather — either works, but resist pulling in a UI framework's full ecosystem (state management libraries, component kits) for what is fundamentally one visual widget per project.

Write this stack choice down once and don't revisit it mid-build.

---

## Phase 0 — Repo skeleton and the manifest as a standalone library

**Goal:** the manifest schema from the last deliverable exists as real, tested code — before anything touches MCP, gates, or UI.

**Tasks:**
1. Create the `code-glass-core` package: just manifest read/write/validate functions, no dependencies on MCP or Electron.
2. Implement `createManifest(projectId, stages[])`, `loadManifest(path)`, `saveManifest(path, manifest)`.
3. Implement the derived-field logic as pure functions: `computeOverallCompletion(manifest)`, `getCurrentStage(manifest)`.
4. Write a JSON Schema (or a runtime validator using something like `zod` or `ajv`) that matches the manifest doc, and a `validateManifest(data)` function that the rest of the system calls before trusting any file it reads.
5. Unit tests: create a manifest, mutate it through the functions (never by hand-editing fields), confirm the derived completion percentage is always correct.

**Done when:** you can run a script that creates a manifest for a fake 3-stage project, marks stage 1 complete, and prints a correct `overall_completion_pct` — with zero MCP, zero Electron, zero gate code involved. This is your foundation; everything else is a client of it.

---

## Phase 1 — Gate Layer 1 only: build/tests, as a standalone function

**Goal:** a function that takes a project path and returns pass/fail/detail — nothing about MCP or manifests yet.

**Tasks:**
1. Implement `runBuildTestGate(projectPath)`: reads the target project's own test command (start with a simple convention — a `codeglass.config.json` in the target project pointing at its test command — don't try to auto-detect every possible test runner).
2. Runs it, captures exit code and output, returns a structured result: `{ layer: "build_tests", result: "pass" | "fail", detail: string }`.
3. Keep this fast and cacheable where possible — per the CI-gate research, if this becomes slow, it will get skipped later. Budget real effort here specifically.
4. Test it against Teddy OS or Skiba Tables directly (real project, real test command) before moving on — synthetic tests won't tell you if the "shell out and parse" approach actually survives contact with a real build.

**Done when:** running this function against one of your real projects correctly reports pass or fail, with a clear failure detail, in a time you'd actually tolerate running before every change.

---

## Phase 2 — Wire the gate result into the manifest, append-only

**Goal:** gate runs get logged into the manifest's `gate_log`, per the schema — no MCP yet, just direct function calls.

**Tasks:**
1. Implement `recordGateResult(manifest, gateResult)` — appends to `gate_log`, returns the updated manifest, never mutates fields it shouldn't.
2. Wire Phase 1's gate function into this: run the gate, log the result.
3. Confirm `gate_log` entries are genuinely append-only in your tests — write a test that runs the gate twice and confirms both entries persist.

**Done when:** you can run a script that loads a manifest, runs the real gate against a real project, and see the result appear in the saved manifest's `gate_log` on disk.

---

## Phase 3 — CLI first, then MCP server: read-only tools

Build order still matters here, independent of the in-app choice: get the CLI working end-to-end before the MCP server, because it's the faster path to a working tool and it de-risks the shared core before any protocol code touches it. Both eventually exist in the same app — a project's `interaction_mode` just determines which one actually receives that project's proposals at runtime. Nothing below changes because of that; it only means both get built, not that you pick one and skip the other.

**CLI, minimum viable:** `codeglass status <project>`, `codeglass validate <project>`, wrapping Phase 0/1/2 functions directly — no new logic, just a thin argument parser (`commander`/`yargs` in Node, or `argparse` if you do this part in Python) in front of what already works.

**Then, MCP server: read-only tools first**

**Goal:** `get_status` and `validate_change` exist as real MCP tools, callable from an actual AI session (Claude Code, or any MCP client) — still no writes.

**Tasks:**
1. Stand up the MCP server using the SDK, with exactly two tools registered: `get_status(project_id)` and `validate_change(project_id, proposed_change)`.
2. `get_status` calls straight into Phase 0's `loadManifest` + `computeOverallCompletion` — no new logic, just exposing what already works.
3. `validate_change` calls straight into Phase 1/2's gate function, returns the structured result, and logs it via Phase 2's `recordGateResult`.
4. Connect a real AI client (Claude Code is the natural choice given your setup) to this server and call both tools by hand from a chat session. Confirm the results match what you'd get calling the functions directly.

**Done when:** from an actual Claude Code session, you can ask "what's the status of skiba-tables" and get a real, correct answer sourced from the manifest — with zero UI built yet. This is the first point where the system is genuinely doing its job, even though it's invisible.

**Why read-only first, deliberately:** this is the lowest-risk MCP tool to get right, and it lets you validate the whole plumbing (SDK, transport, a real AI client actually calling it) before you build the one tool that's allowed to mutate state.

---

## Phase 4 — The write path: `record_progress` with human confirmation

**Goal:** the single most safety-critical piece of the whole system — the only thing that changes `current_stage_index` — with the confirmation flow that everything else exists to protect. Build this once, as a function (`proposeChange`, `confirmChange`, `rejectChange`) operating on `pending_confirmation`; both `codeglass record ...` (CLI mode) and the MCP `record_progress` tool (MCP mode) are just two thin callers of the exact same three functions, which is the entire point of putting `interaction_mode` on the manifest rather than forking the write logic itself.

**Tasks:**
1. Implement `record_progress(project_id, target_stage_id, target_status, summary)` as an MCP tool, but **it does not write directly to the manifest**. It writes to `pending_confirmation` only, per the schema.
2. Build the confirmation mechanism itself. For this phase, a CLI prompt is enough — don't wait for Electron. `codeglass confirm skiba-tables` prints the pending change's summary and gate result, and a y/n answer either commits it (moving `current_stage_index`, clearing `pending_confirmation`) or rejects it (adds a `status_dots` entry, clears `pending_confirmation`).
3. Enforce "only one pending confirmation per project at a time" here — reject a second proposal while one is outstanding, at the MCP tool level, not just in the UI later.
4. Test end-to-end: from a real AI session, propose a change via `record_progress`, see it land as pending, confirm it via the CLI, and see `get_status` reflect the new state.

**Done when:** you've completed one real stage of one real project (Teddy OS or Skiba Tables) through this exact flow — AI proposes, you confirm via CLI, manifest updates — and you trust the result enough that you'd use it instead of your memory. This is the moment the core problem (losing track of real state) is actually solved, even before there's a single pixel of UI.

---

## Phase 5 — Snapshot service

**Goal:** automatic, cheap, frequent snapshots wired to gate/confirmation events — restorable in one step.

**Tasks:**
1. Implement `createSnapshot(projectPath, trigger)`: zips the project folder (excluding obvious junk — `node_modules`, build output, `.git` — via a simple ignore list) to a snapshots directory, logs the entry into the manifest's `snapshots` array per the schema.
2. Wire triggers: fire automatically before a `record_progress` confirmation commits (your riskiest write), and optionally before layer-3 checks once they exist. Don't wire it to a timer yet — event-triggered only, per your "additive/non-destructive, safe to automate" decision.
3. Implement `restoreSnapshot(snapshotId)` as an equally simple, single function — unzip over the current folder (with an obvious confirmation prompt, since this one **is** destructive to current state).
4. Test the full loop deliberately: make a real snapshot, break something in the real project on purpose, restore, confirm the break is gone.

**Done when:** you trust restore enough that you'd actually reach for it under real pressure instead of manually copying files "just in case" — this is the bar the earlier research set for backup-system trust, and it's worth actually testing yourself under a simulated "oh no" moment, not just confirming the code runs.

---

## Phase 6 — Electron shell: onboarding, project setup, one cylinder, read-only

**Goal:** the visual metaphor exists and renders correctly against real manifest data, and a new project can be created through the app with its interaction mode chosen at setup — still no interactive confirmation UI yet.

**Tasks:**
1. Bare Electron app, one window.
2. **New project onboarding screen** (see wireframes): first, a native folder picker (Electron's `dialog.showOpenDialog`, `openDirectory` mode, invoked via IPC from the renderer) to point at the project's existing folder on disk — this sets `project_path` and is where `project.codeglass.json` actually gets written. Never a typed-in path; always the real OS picker, so it can't point at a folder that doesn't exist. Then: name the project, define the ordered stage list, and choose `interaction_mode` — two cards, "CLI Relay" and "MCP Live," each with a one-line description of what it means day-to-day (matches the pros/cons in the Two Paths document). Selecting one writes `interaction_mode` into the new manifest and registers the project (`project_id` → `manifest_path`, derived from `project_path`) in `codeglass.app.config.json`.
3. If `mcp` mode is chosen for any project and the app-level MCP server isn't running yet, prompt to start it (Electron's main process spawns the server as a child process — this is the only place server lifecycle is managed; individual projects never start their own server). If every project stays in `cli` mode, the server never needs to run at all.
4. One cylinder SVG component. Load a manifest (Phase 0's functions, called directly — no need to go through MCP for the UI to read local files), render stages as stacked bands sized by equal-weight completion, meniscus line at the exact overall percentage.
5. Poll or watch the manifest file for changes (a file watcher is enough — no need for a push mechanism yet) and re-render live regardless of whether a CLI command or a live MCP call produced the change — the UI genuinely doesn't need to know which.
6. Render `status_dots` as colored dots on the cylinder, and a distinct visual state (per the earlier design note — pulsing meniscus or similar) when `pending_confirmation` is non-null. Also render a small mode badge (e.g., a tiny terminal icon vs. a plug icon) on each project card so it's always visible at a glance which path a project is using.

**Done when:** you can create a new project through the onboarding screen, choose CLI mode, and watch the cylinder update in real time while confirming a change via the Phase 4 CLI in a separate terminal — then create a second project, choose MCP mode, confirm the server auto-starts, and watch that one update from a live tool call instead. This proves both the "UI is just a renderer of manifest state" architecture and the "mode is a per-project setting, not an app-wide fork" design actually hold.

---

## Phase 7 — Move confirmation into the UI itself

**Goal:** replace the Phase 4 CLI confirmation with the one-click flow the retention research demands.

**Tasks:**
1. When `pending_confirmation` is set, the UI shows the summary and gate result inline (the "artifact-style" summary, not a raw diff, per the Antigravity research) with a single confirm/reject action.
2. Wire that action to the same commit/reject logic Phase 4 already built — this should be almost no new logic, just a new caller.
3. Retire the CLI confirmation path once the UI path is proven, or keep both — your call, but don't maintain two confirmation implementations long-term.

**Done when:** confirming a real proposed change takes one click, and you've done it at least once under normal working conditions (not a demo) without reaching for a terminal.

---

## Phase 8 — Gate layers 2 and 3

**Goal:** dependency/version conflict checking, then schema/type validation, added one at a time, each proven stable before the next starts.

**Tasks (per layer):**
1. Implement the layer as its own pure function with the same `{ layer, result, detail }` shape as layer 1 — this is why Phase 1's interface discipline mattered.
2. Add it to `gate_config.layers_active` for one project first, not all five — dogfood it before trusting it broadly.
3. Decide block-vs-warn for this specific layer explicitly (per the earlier research: don't default new layers to hard-block before they've earned it) — start warn-only, promote to blocking once false-positive rate is low enough that you're not routing around it.
4. Only start layer 3 once layer 2 has run cleanly against real changes for a real stretch of time — this sequencing is a locked decision, not a suggestion.

**Done when:** each layer, independently, has caught at least one real problem you'd have otherwise missed — that's the actual proof it's earning its keep, not just passing tests you wrote for it.

---

## Phase 9 — Multi-project (up to 5)

**Goal:** the Electron shell manages several projects at once, still within the hard cap.

**Tasks:**
1. A simple project list/switcher in the UI — resist building a "dashboard" with cross-project aggregation, tags, or filtering; the research is explicit that this kind of scope creep is what kills exactly this category of tool.
2. Enforce the 5-project cap in code, not just convention — the MCP server should refuse to create a 6th project manifest, with a clear error, rather than silently allowing it.
3. Confirm per-project `confirmation_granularity` settings actually behave differently in practice (Teddy OS at `every_change`, Skiba Tables at `stage_completion`, or whatever your real split ends up being).
4. Build the Settings screen's mode-switch action (change an existing project's `interaction_mode` after the fact) with the explicit confirmation dialog called for in the schema doc — not a silent toggle, and blocked while that project has a pending confirmation outstanding.

**Done when:** you're actively tracking 2+ real, different projects through Code Glass simultaneously, with both projects' data staying visibly independent, and you've successfully switched at least one project's mode after the fact without incident.

---

## What "done" looks like overall

Code Glass is finished, for v1 purposes, when: an AI session working on any of your real projects proposes progress through `record_progress`, you confirm it in one click, the cylinder reflects it immediately, a snapshot exists you could restore from without panic, and at least one gate layer has caught a real problem before it became permanent state. Everything past that point — more gate layers, richer stage metadata, a web UI instead of Electron — is genuinely optional, and the architecture from the manifest schema is specifically designed so those additions never require revisiting what you built first.

## The one discipline that matters more than any single phase

At the end of every phase, before starting the next one, ask: *did I add anything not required by this phase's "done when" line?* If yes, write it down as a future idea and remove it now. This is the entire lesson from Backstage, Notion, and Antigravity in the earlier research, restated as a build habit instead of a paragraph of advice.
