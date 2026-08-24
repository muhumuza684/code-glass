# Code Glass — Project Manifest Schema (v1.1)

This is the one file format every other component reads and writes against: the compatibility gate, the CLI, the MCP server, and the Electron UI are all just clients of this schema. Nothing here should assume Electron, MCP, or any specific gate implementation — it's pure data.

One manifest file per tracked project (`project.codeglass.json` or similar, living in the project's own folder). Up to 5 of these exist at once, one per active project.

**What changed in v1.1:** added `interaction_mode` (per project) to capture the CLI-relay vs. MCP path decision, now that the Electron app asks for this at project setup. See the [Two Paths document](#) for the full reasoning — this schema change is the only place that decision touches the data model. There is also now a companion **app-level config file** (not per-project) covering the default mode and snapshot retention — see the bottom of this document.

---

## Design choices this schema locks in

- **Stages are an ordered array the project itself defines** — no global tier model, no required stage count.
- **`record_progress` is the only thing that changes `current_stage_index` or marks a stage complete.** Everything else in this file is either derived, read-only history, or gate/snapshot bookkeeping — nothing else should ever move the completion needle.
- **`confirmation_granularity` defaults to `"stage_completion"`**, the safer of the two options discussed, so a new project never launches with an unset, effectively-permissive default.
- **`interaction_mode` is chosen once per project, at setup, in the Electron onboarding screen** — see below. It doesn't change the shape of `pending_confirmation`, `gate_log`, or anything else; both paths write the same fields, per the "clients of the same schema" rule. Switching a project's mode later is allowed but deliberately not a casual toggle — see the field notes.
- **Stage objects are deliberately narrow.** Only fields with a proven, current need are included. New fields (weight, color, icon, sub-stages, conditions) get added only when a real project hits a real need for one — not speculatively.
- **Gate results and snapshots are append-only logs, not mutable state**, so the manifest itself never loses the ability to explain how it got to its current values.

---

## Top-level shape

```json
{
  "schema_version": "1.1",
  "project_id": "skiba-tables",
  "display_name": "Skiba Tables",
  "project_path": "D:/skiba-tables",
  "created_at": "2026-08-01T09:00:00Z",
  "updated_at": "2026-08-18T14:12:00Z",

  "interaction_mode": "cli",

  "stages": [
    { "id": "engine", "name": "Engine", "status": "complete" },
    { "id": "ui", "name": "UI", "status": "in_progress" },
    { "id": "theming", "name": "Theming", "status": "not_started" },
    { "id": "release", "name": "Release", "status": "not_started" }
  ],
  "current_stage_index": 1,
  "overall_completion_pct": 37,

  "gate_config": {
    "layers_active": ["build_tests"],
    "confirmation_granularity": "stage_completion"
  },

  "pending_confirmation": null,

  "status_dots": [],

  "gate_log": [],
  "snapshots": []
}
```

---

## Field-by-field

### Identity
| Field | Type | Notes |
|---|---|---|
| `schema_version` | string | So the gate/UI can detect and migrate old manifests as the schema evolves. |
| `project_id` | string | Stable, filesystem-safe slug. Never changes after creation. |
| `display_name` | string | What the UI shows. Can change freely — it's cosmetic. |
| `project_path` | string | Absolute path to the project's own folder on disk — where this manifest file itself lives, alongside the real code. Set once, at onboarding, via a native OS folder picker (Electron's `dialog.showOpenDialog`, `openDirectory` mode) — never typed by hand, to avoid typo'd paths pointing at nothing. Code Glass points at an *existing* folder; it doesn't create one. |
| `created_at` / `updated_at` | ISO 8601 | `updated_at` bumps on any write, including gate/snapshot log entries. |

### Interaction mode
| Field | Type | Notes |
|---|---|---|
| `interaction_mode` | enum | `"cli"` \| `"mcp"`. Set once at project creation, in the Electron onboarding screen (see wireframes). Determines *how* `record_progress` proposals reach this project — a human pasting CLI commands, or a live MCP server — but changes nothing else about the schema; `pending_confirmation`, `gate_log`, and `snapshots` are written identically by both paths. |

Switching an existing project's mode is allowed (e.g., moving Skiba Tables from `cli` to `mcp` once you trust the core) but is a deliberate action in Settings, not a default toggle — the Electron app should show a short confirmation ("this project will now accept proposals from a live MCP connection instead of manual commands") rather than a silent flip, since it's a real change in how much stands between an AI session and a write.

### Stages
```json
{ "id": "ui", "name": "UI", "status": "in_progress" }
```
| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, used by `gate_log` and `pending_confirmation` to reference a stage. |
| `name` | string | Display label — this is what becomes a band's tooltip/label in the cylinder. |
| `status` | enum | `not_started` \| `in_progress` \| `complete`. Exactly one stage is ever `in_progress` at a time (or zero, if the whole project is unstarted or fully complete). |

Deliberately **not** included yet: weight, color, icon, sub-stages, unlock conditions. Equal-weighting is assumed for `overall_completion_pct` until a real project needs otherwise (see Open Questions).

### Progress
| Field | Type | Notes |
|---|---|---|
| `current_stage_index` | integer | Index into `stages`. The band currently filling. |
| `overall_completion_pct` | integer 0–100 | **Derived**, not independently settable — computed from completed-stage count / total stages (equal weighting, v1). Recomputed by the same code path that handles `record_progress`, never hand-edited. |

### Gate configuration
| Field | Type | Notes |
|---|---|---|
| `gate_config.layers_active` | array | Subset of `["build_tests", "dependency_conflicts", "schema_validation"]`. Starts with just `build_tests`, per the layered rollout plan — grows as each layer proves stable. |
| `gate_config.confirmation_granularity` | enum | `"stage_completion"` (default) \| `"every_change"`. Per-project, per the decision that a blank default is itself a design decision. |

### Pending confirmation
When an AI session proposes a `record_progress` call, it lands here — not directly in `stages` — until a human confirms or rejects it.

```json
"pending_confirmation": {
  "id": "pc_0042",
  "proposed_at": "2026-08-18T14:10:00Z",
  "requested_by": "session_note or free text",
  "target_stage_id": "ui",
  "target_status": "complete",
  "summary": "Short human-readable explanation of what changed and why — the artifact-style summary, not a raw diff.",
  "gate_result_id": "gr_0091"
}
```
This is what the UI renders as the pulsing/pending meniscus state, and what a red dot links back to on rejection. Only one pending confirmation per project at a time — a second proposed change while one is pending should queue or be rejected upstream by the MCP server, not overwrite this field.

### Status dots
```json
"status_dots": [
  {
    "id": "dot_0007",
    "type": "error",
    "message": "Schema validation failed: field `segmentCount` type mismatch",
    "created_at": "2026-08-18T14:09:00Z",
    "resolved": false,
    "gate_result_id": "gr_0091"
  }
]
```
`type` is `error` \| `warning` \| `info`. Dots persist until explicitly resolved (by a human decision on the linked pending confirmation, or manually dismissed) — they are not auto-cleared by time or by the next successful change, so nothing silently disappears.

### Gate log (append-only)
```json
"gate_log": [
  {
    "id": "gr_0091",
    "ran_at": "2026-08-18T14:09:00Z",
    "layer": "build_tests",
    "result": "fail",
    "detail": "2 test failures in segment-accumulation module",
    "triggered_snapshot_id": "snap_0015"
  }
]
```
Every `validate_change` call writes an entry here, pass or fail. This is what makes "why did this get rejected" answerable later, not just in the moment — and it's the audit trail a `record_progress` confirmation should be able to point back to.

### Snapshots (append-only)
```json
"snapshots": [
  {
    "id": "snap_0015",
    "created_at": "2026-08-18T14:09:00Z",
    "trigger": "pre_layer3_check",
    "archive_path": "D:/Downloads/codeglass-snapshots/skiba-tables/snap_0015.zip",
    "size_bytes": 18422113
  }
]
```
`trigger` is a free-form but conventionally-named string (`"pre_layer3_check"`, `"stage_complete"`, `"manual"`, etc.) — enough to answer "why does this snapshot exist" without opening it. Restore is an action the UI/MCP layer performs *from* this log; nothing about restoring changes this schema.

---

## App-level config file (new in v1.1) — separate from any project manifest

One file, not per-project, living alongside the Electron app's own data (not inside any tracked project's folder): `codeglass.app.config.json`.

```json
{
  "schema_version": "1.1",
  "default_interaction_mode": "cli",
  "mcp_server": {
    "enabled": false,
    "port": 8790,
    "autostart": false
  },
  "snapshot_retention": {
    "keep_last_n_per_project": 20,
    "max_age_days": 30
  },
  "project_registry": [
    { "project_id": "skiba-tables", "manifest_path": "D:/skiba-tables/project.codeglass.json" },
    { "project_id": "teddy-os", "manifest_path": "D:/Downloads/teddy-os/project.codeglass.json" }
  ]
}
```

- **`default_interaction_mode`** is what the onboarding screen pre-selects for a new project — the human still confirms it per project, this is just the starting suggestion.
- **`mcp_server`** exists here, not per-project, because there's only ever one MCP server process regardless of how many projects use `mcp` mode — it's app-wide infrastructure, not project data. `enabled`/`autostart` are what let the Electron app manage the server's lifecycle (Settings toggle → spawn/kill the child process) without any project manifest needing to know about it.
- **`snapshot_retention`** resolves the open question from v1.0 about where retention policy belongs — here, not in the per-project manifest, so pruning rules can change without touching any project's file.
- **`project_registry`** is what lets the Electron app find all (up to 5) tracked projects without scanning the whole filesystem — the app's own bookkeeping, separate from anything a gate or MCP tool needs to reason about.

This file is a client-side convenience the Electron app owns; the CLI and MCP server can function by being pointed directly at a manifest path and don't strictly need to read it, though the CLI can optionally use `project_registry` to let you type `codeglass status skiba-tables` instead of a full path.

---

## What deliberately isn't here yet

- **Per-stage weighting** — equal-weight completion math only, until a real project's uneven stages (per the visual-legibility risk flagged earlier) actually needs it.
- **Cross-project fields** (a "portfolio" view, shared tags) — out of scope; each manifest is self-contained, matching the "5 independent projects, not a catalog" framing.
- **User/auth fields** — this is a single-developer tool; no ownership or permission fields beyond the fixed MCP read/write split, which lives in code, not in this file.

---

## Open questions for you, not resolved by the schema alone

1. **Equal-weighting is a real assumption, not just a placeholder.** Skiba Tables' "engine" stage is probably not the same size as its "release" stage. Worth deciding now whether v1 ships with equal weighting anyway (simplest, matches "no speculative fields" rule) or whether stage weighting is one of the few fields worth adding at schema v1 rather than waiting.
2. **What happens to `pending_confirmation` if the AI session that proposed it ends before a human responds?** The field as drafted just sits there — probably correct (nothing should be silently dropped), but worth confirming that's the intended behavior versus, say, an expiry.
3. ~~Snapshot retention isn't in this schema at all.~~ **Resolved in v1.1** — now lives in `codeglass.app.config.json`, not the per-project manifest.
4. **New in v1.1: what should happen to `pending_confirmation` and `gate_log` entries mid-flight if a project's `interaction_mode` is switched?** E.g., a CLI-mode project has a pending confirmation, and you switch it to `mcp` mode before resolving it. Simplest answer is probably "mode switches are blocked while a confirmation is pending" — worth deciding explicitly rather than leaving it implicit.

Happy to lock this as-is, or work through any of the four open questions first — your call on which matters more before code gets written against it.
