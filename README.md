# Code Glass

A desktop tracker for solo/AI-assisted projects, built to solve one specific failure: losing track of real project state across dozens of scattered AI chat sessions with no shared source of truth.

Each tracked project is shown as a glass cylinder that fills with liquid as it progresses — stacked, immiscible bands for project-defined stages, a meniscus line marking the exact completion percentage, and colored dots flagging anything waiting on a human decision. Underneath the metaphor is a compatibility gate that validates any proposed change before it's allowed to update tracked state, and an automatic snapshot service for safe rollback.

## Status

Design and architecture phase. No code yet — these documents are the locked plan the build follows.

## Documents

- [`glass-container-research.md`](./glass-container-research.md) — prior-art research (Backstage, CI/CD gates, feature flags, Linear/Notion, agentic IDEs) and the design decisions it grounds.
- [`code-glass-manifest-schema.md`](./code-glass-manifest-schema.md) — the JSON manifest format every other component reads and writes against.
- [`code-glass-two-paths.md`](./code-glass-two-paths.md) — the two ways an AI session can reach Code Glass: CLI-relay (paste commands) or MCP (a live agent calls tools directly).
- [`code-glass-build-roadmap.md`](./code-glass-build-roadmap.md) — the phased build plan, from a standalone manifest engine through to a full multi-project Electron app.

## Core design principles

Modularity, simplicity, usability, separation of concerns — locked as non-negotiable, per the research document. Capped at 5 tracked projects, deliberately: this is a solo-developer tool, not a team platform.

## Author

Bryt Ma Tech
