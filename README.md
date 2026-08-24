# Lame in Tech — Code Glass

> **Speak your idea to life. See the build clearly. Return only when help is needed.**

Code Glass is the desktop observatory for **Lame in Tech**, an accessibility-first voice-to-idea system. It helps people, including people who may have difficulty typing or navigating dense developer tools, move from a spoken idea to a visible, testable software project.

The project treats software progress as something a person should be able to **see, hear, and understand**. Code Glass combines a transparent glass-style interface, structured project state, process gates, voice-first intake, adaptive audio, remote progress concepts, and exportable evidence.

## What is implemented

| Capability | What it does |
| --- | --- |
| **Three-process observatory** | Tracks Discover, Build & Prove, and Ship & Learn as ordered processes. |
| **Guided Mode** | Presents one clear project signal and one recommended action at a time. |
| **Observatory Mode** | Shows the full process state, evidence, failures, and next actions. |
| **Accessible signals** | Uses GO, WAIT, STOP, READY, and LISTENING with color, shape, icon, text, and cue metadata. |
| **Voice-first intake** | Normalizes spoken ideas and prepares them for the project workflow. |
| **Adaptive soundscape** | Maps project health and build events to an evolving motorbike-style audio experience. |
| **Failure impact** | Makes a blocking failure visible at the affected process and project level. |
| **Remote build-away foundation** | Provides notification and authenticated-reply adapters for monitoring away from the machine. |
| **Structured state** | Uses a versioned manifest with migration and reliability helpers. |
| **Evidence and export** | Supports normalized project reports and verification evidence. |

## Accessible guidance

Traffic-light semantics are deliberately **not color-only**. Every important signal has redundant meaning through its shape, icon, plain-language label, screen-reader description, and optional audio or haptic cue.

| Signal | Visual language | Meaning |
| --- | --- | --- |
| **GO** | Green circle and check | Continue safely or review the next step. |
| **WAIT** | Amber triangle and pause | Input, confirmation, or clarification is needed. |
| **STOP** | Red octagon and exclamation mark | A blocking issue requires attention. |
| **READY** | Gray circle and standby mark | Start an idea or select a project. |
| **LISTENING** | Blue microphone signal | Speak now. |

## The three processes

1. **Discover** captures and clarifies the idea.
2. **Build & Prove** implements the idea, runs tests, and records evidence.
3. **Ship & Learn** exports the result, notifies the user, and captures what should improve next.

## Run locally

The repository is an Electron workspace using Node.js and npm.

```powershell
npm ci
npm test
npm --workspace electron start
```

The automated suite covers the core workflow, state migration, failure impact, voice intake, notifications, remote replies, accessibility, reliability, and the Phase 15–16 guidance modes.

## Repository map

```text
.github/workflows/       Continuous integration and downloadable artifacts
electron/                Electron desktop shell and renderer
packages/core/           State, workflow, guidance, migration, and reliability
packages/gate/           Process gates and transition checks
packages/write-path/     Safe project write operations
addons/                  Modular visual, motion, evidence, and observatory components
docs/                    Product and architecture documentation
```

## Downloadable builds

Every push and pull request runs the verification workflow. A successful workflow also publishes a downloadable source bundle as a GitHub Actions artifact. Open the repository’s **Actions** tab, select the successful run, and download the artifact named `code-glass-source-<short-sha>`.

The artifact is intentionally a verified source bundle while the desktop packaging target is being finalized. This keeps every download reproducible and reviewable rather than presenting an unverified installer as production-ready.

## Privacy and safety

Do not commit credentials, private keys, environment files, dependency folders, private recordings, or generated local evidence. Remote replies must be authenticated, bounded, deduplicated, and auditable. Audio, spoken announcements, reduced motion, and haptic feedback should remain user-controllable.

## Development status

The repository contains the verified Code Glass implementation through **Phase 16**, including accessible guidance signals and Guided/Observatory modes. The next product milestone is a focused Lame in Tech desktop flow: capture an idea, show its signal, move it through the three processes, and export evidence.

## Maintainer

**Bryt Ma Tech / Lame in Tech**

## License

No public license has been selected yet. Add a formal license before distributing Code Glass outside the project.

<!-- CODEGLASS_PHASE11_HARDENING -->
