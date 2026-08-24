# Code Glass — Two Paths: CLI-Relay vs. MCP

## The key fact that makes this easy: both paths share the same core

Everything from the manifest schema through the gate functions through the snapshot service is **identical in both paths.** Phases 0, 1, 2, 5 of the original roadmap don't change at all — a manifest file, a gate-check function, a snapshot function don't know or care whether the thing calling them is a PowerShell command you pasted or a live MCP tool call. The only thing that differs is **how a caller reaches that core**: through a CLI you invoke by hand, or through an MCP server a live agent calls directly.

This means: **you never have to choose once and commit forever.** Build the shared core once, put a CLI on top of it first (matches your real workflow today), and if you ever want the MCP path later, you're adding a thin adapter on top of code that already works — not rebuilding anything.

```
                 ┌─────────────────────────────┐
                 │   SHARED CORE (build once)   │
                 │  manifest engine · gate fns  │
                 │  snapshot service            │
                 └──────────────┬───────────────┘
                                │
                 ┌──────────────┴───────────────┐
                 │                               │
          ┌──────▼──────┐                ┌───────▼───────┐
          │  CLI PATH   │                │   MCP PATH    │
          │  (Path A)   │                │   (Path B)    │
          └─────────────┘                └───────────────┘
```

---

## Path A — CLI-relay (matches your actual workflow today)

**How it works in practice:** Claude generates a command like `codeglass record skiba-tables ui complete "finished pagination fix"`. You paste it into PowerShell. It runs against the local manifest file. If Claude needs to know the result, you paste the output back into the chat. This is your existing loop, unchanged — Code Glass just becomes one more tool you invoke this way, alongside git, npm, etc.

**What you build:**
- The shared core (manifest, gates, snapshots) — same as before.
- A single CLI entry point with subcommands: `status`, `validate`, `record`, `confirm`, `snapshot`, `restore`.
- That's it. No server process, no protocol, nothing that has to "stay running."

**Where the confirmation gate lives:** in you, literally — the same way it already does for every command Claude gives you today. `record` doesn't even need a separate `pending_confirmation` → `confirm` two-step, because the act of you choosing to paste the command *is* the confirmation. (You can still keep `pending_confirmation` in the schema for path-B compatibility, but Path A can collapse it to one step if you want — see the note below.)

**Pros:**
- Builds directly on infrastructure you already trust and use daily.
- Zero new failure surface — no server to crash, no protocol version to break, no persistent process eating memory.
- You can literally start today: write the manifest engine and three CLI commands, and you have a working v1 by this weekend.
- Fully visible — every state change is a command you saw before it ran, which is the strongest possible version of your "never silently corrupt state" requirement.

**Cons:**
- Doesn't scale to a live agent (Claude Code running autonomously) making its own decisions about when to check status — you're always the messenger.
- Slightly more manual per session — you're pasting commands and outputs back and forth, same as now.
- The Electron cylinder UI has less to react to in real time unless you're actively running commands — though a file-watcher UI still updates the instant the manifest changes, regardless of what wrote it.

**Revised phase order for Path A** (replacing Phases 3–4 from the original roadmap):
1. Phases 0, 1, 2 unchanged — manifest engine, gate layer 1, gate logging.
2. **New Phase 3a:** wrap all of it in a CLI (`commander` or `yargs` in Node, or just `argparse` if you'd rather do this part in Python — either is fine). Four commands minimum: `status`, `validate`, `record`, `confirm`.
3. Phase 5 (snapshots) unchanged, add `snapshot` and `restore` CLI commands.
4. Phase 6 (Electron UI) unchanged — it reads the same manifest file regardless of what wrote it.
5. Skip the old Phase 3/4 (MCP server, live tool calls) entirely for now.

**This is the path I'd actually recommend you start with**, independent of which you eventually also build — it's the fastest route to something real, and it de-risks the core before you add any protocol complexity on top.

---

## Path B — MCP (a live agent calls tools directly)

**How it works in practice:** Claude Code (or any MCP-capable client) connects to your Code Glass MCP server as a live process. It calls `get_status`, `validate_change`, and — only with your explicit confirmation — `record_progress`, without you manually relaying commands. This is what you'd want if you move toward using Claude Code as an actual coding agent that works on your projects somewhat autonomously, rather than you being the one pasting every command.

**What you build:**
- The shared core — identical to Path A, no changes.
- An MCP server process (Node + `@modelcontextprotocol/sdk`) exposing exactly three tools, each a thin wrapper calling straight into the shared core functions.
- A way to launch/keep that server running when you want it available (Claude Code config pointing at it — a few lines of JSON, not complicated).

**Pros:**
- Matches how MCP and agentic coding tools are actually designed to be used — no manual relay step.
- Scales to a workflow where an agent works semi-autonomously across a session and only interrupts you for the `record_progress` confirmation — closer to the original "any AI session interacts with real state" vision from the initial concept.
- Reusable across any MCP client, not just Claude chat — Claude Code, Claude Desktop, any future MCP-speaking tool all get the same three tools for free once the server exists.

**Cons:**
- Real new infrastructure: a persistent process, a protocol version to keep compatible with SDK updates, a new class of bugs (connection issues, tool-call schema mismatches) that Path A simply doesn't have.
- Requires you to actually adopt Claude Code (or similar) as your primary workflow to get the benefit — if you keep working the way you described (chat + paste), an MCP server sits there mostly unused.
- The confirmation UX needs to be built for real — `pending_confirmation` plus an actual UI or CLI confirm step, since there's no "you saw the command before it ran" safety net anymore. This is where Path B's version of `record_progress` needs the two-step pending → confirm flow to matter, not just exist on paper.

**Phase order for Path B** — this is the original roadmap's Phase 3–4 essentially unchanged:
1. Phases 0, 1, 2, 5 unchanged (shared core).
2. Phase 3: MCP server, `get_status` + `validate_change` only, tested against a real MCP client.
3. Phase 4: `record_progress` with the full pending/confirm flow — this time the confirm step is load-bearing, since nothing else in this path stops a bad write from happening automatically.
4. Phase 6 onward unchanged.

---

## Recommendation: build Path A now, treat Path B as an optional later add-on

Concretely:

1. Build the shared core once, correctly, per Phases 0–2 and 5 of the original roadmap — this work is identical no matter which path you pick, so there's no reason to delay it on this decision.
2. Put Path A's CLI on top of it. This alone solves the actual problem that started this whole project — losing track of Skiba Tables — and matches a workflow you already trust and run every day. You could be using a working version within days, not weeks.
3. Leave Path B's MCP server as a clearly-labeled future phase. If you later start using Claude Code as a more autonomous agent and the manual paste loop starts feeling like the bottleneck, you add the MCP server on top of a core that's already been proven in daily use — lower risk than building the protocol layer first and finding out the core logic had bugs only real use would have surfaced.

The one thing worth deciding now, since it affects the schema slightly: do you want `record_progress` to always be a two-step pending→confirm flow (so Path A and Path B behave identically and you can add Path B later with zero schema changes), or should Path A be allowed to collapse it to one step since your paste-to-run action already *is* the confirmation? I'd lean toward keeping the two-step flow even in Path A — it costs you one extra command, but it means the manifest, the gate log, and the UI never need to know or care which path produced a change, which is exactly the "clients of the same schema" separation the architecture was built around.
