# Electron IPC

Safe main/preload integration points for project lifecycle, confirmations, snapshots, and export.

This package is intentionally narrow. It does not overwrite the existing renderer or silently change manifests. Apply packages in numeric order and keep a backup.

## Safe installation

Run `apply.ps1` from PowerShell with the Code Glass project path configured. The installer copies this package under `addons/codeglass/05-electron-ipc` and creates an integration note. Source-level wiring is described in `INTEGRATION.md`.

## Status

This package is an integration component, not a production claim. The remote notification package requires a secure server, provider credentials, webhook verification, authentication, and audit storage before it can send or execute anything.
