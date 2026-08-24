# Renderer State

Renderer controller that consumes normalized state instead of inventing process data.

This package is intentionally narrow. It does not overwrite the existing renderer or silently change manifests. Apply packages in numeric order and keep a backup.

## Safe installation

Run `apply.ps1` from PowerShell with the Code Glass project path configured. The installer copies this package under `addons/codeglass/06-renderer-state` and creates an integration note. Source-level wiring is described in `INTEGRATION.md`.

## Status

This package is an integration component, not a production claim. The remote notification package requires a secure server, provider credentials, webhook verification, authentication, and audit storage before it can send or execute anything.
