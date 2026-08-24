# Lame in Tech - Code Glass

Code Glass is an accessibility-first software observatory for Lame in Tech, a voice-to-idea system designed to help people, including people with disabilities, turn spoken ideas into software while monitoring progress remotely.

## What it provides

| Capability | Description |
|---|---|
| Voice-first intake | Captures spoken ideas for the build workflow. |
| Three-process observatory | Keeps Discover, Build & Prove, and Ship & Learn visible. |
| Guided Mode | Presents one clear GO, WAIT, STOP, READY, or LISTENING signal. |
| Observatory Mode | Shows process state, evidence, failures, and next actions. |
| Adaptive audio | Uses motorbike-style sound cues for progress, warnings, success, and failure. |
| Remote build-away | Supports monitoring away from the computer through notification and reply adapters. |
| Structured state | Preserves project state, transitions, migrations, and evidence. |

## Accessible guidance

Traffic-light guidance is never color-only. Each state combines color, shape, icon, plain-language text, and optional audio or haptic metadata.

| Signal | Meaning |
|---|---|
| Green circle | GO - continue safely. |
| Amber triangle | WAIT - input or confirmation is needed. |
| Red octagon | STOP - a blocking action requires attention. |
| Gray circle | READY - start an idea or select a project. |
| Blue microphone | LISTENING - speak now. |

## Three-process model

1. **Discover** - capture and clarify the idea.
2. **Build & Prove** - implement, test, and show evidence.
3. **Ship & Learn** - export, notify, learn, and improve.

## Local development

Requirements: Node.js 22 or newer and npm.

```powershell
npm ci
npm test
npm --workspace electron start
```

## Continuous integration

Every push and pull request runs npm test, Git whitespace validation, and a tracked-file safety audit through GitHub Actions.

## Project structure

```text
electron/                 Electron desktop application
packages/core/            State, workflow, guidance, and reliability logic
packages/gate/            Process gates and transition checks
packages/write-path/      Safe project write operations
.github/workflows/        Continuous integration
```

## Privacy and safety

Credentials, private keys, environment files, dependency folders, and private recordings must not be committed. Remote replies must remain authenticated, bounded, deduplicated, and auditable. Audio, spoken announcements, reduced motion, and haptic feedback should remain user-controllable.

## Status

The repository contains the verified Code Glass implementation through Phase 16, including accessible guidance signals and Guided/Observatory modes.

<!-- CODEGLASS_PHASE11_HARDENING -->
