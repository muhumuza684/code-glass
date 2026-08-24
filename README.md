# Code Glass

Code Glass is a desktop tracker for solo and AI-assisted software projects. Each tracked project has one `project.codeglass.json` manifest as its source of truth. This repository contains the six requested pieces: `code-glass-core`, `code-glass-gate`, `code-glass-write-path`, the `codeglass` CLI, the stdio MCP server, and the Electron renderer.

## Run and test

From the repository root, install dependencies with `npm install`, then run the unit suite with `npm test`. Launch the desktop app with `npm start`. The CLI can be invoked after linking its workspace package with `npm --workspace packages/cli link` or directly with `node packages/cli/src/index.js`.

The CLI commands are:

```text
codeglass status <project>
codeglass validate <project>
codeglass record <project> <stageId> <status> <summary> [--gate-result <id>]
codeglass confirm <project>
codeglass snapshot <project> [trigger]
codeglass restore <project> <snapshotId>
```

The MCP server exposes exactly `get_status`, `validate_change`, and `record_progress`. A client configuration can point at it as follows:

```json
{
  "mcpServers": {
    "code-glass": {
      "command": "node",
      "args": ["/absolute/path/to/code-glass/packages/mcp-server/src/index.js"]
    }
  }
}
```

## Design notes

The core package uses Zod for strict schema validation and derives completion from completed stages. The gate package records append-only results. The write-path package is immutable for proposal, confirmation, and rejection operations and requires an explicit `confirmed: true` flag before restoration. The Electron UI intentionally contains local confirmation stubs as required by the brief; those stubs are marked by the surrounding architecture and are the replacement point for the shared write-path package in a packaged build. The Electron main process also leaves MCP child-process spawning as an explicit TODO, as requested.

The specification explicitly excludes deletion, drag-and-drop stage reordering, output-format flags, retry/caching systems, and convenience MCP history tools; none are included here.
