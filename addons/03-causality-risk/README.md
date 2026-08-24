# Code Glass Addon Pack

This addon is designed for the existing Code Glass Electron project described in the supplied transcript. It is intentionally modular: the files do not overwrite the project automatically. Review `apply.ps1`, copy the modules into your project, then connect the exported functions from `src/index.js` to your renderer and preload bridge.

## Safety

The addon is read-oriented by default. It does not commit code, confirm proposals, delete files, or transmit project data. Keep a backup of the repository before applying it.

## Integration contract

The host renderer may call `createCodeGlassAddonHost({ root, readManifest, writeManifest, emit })`. The `emit` callback should forward events to the activity log and visual renderer. All addon state is serializable JSON.

# Causality and Risk — Make failure propagation visible

## Included ideas

Transparent dependency atmosphere; failure fracture map; why-stuck mode; predictive pressure; risk gravity wells; focus lenses.

## Apply

Run the included PowerShell command from the repository root after reviewing the files. Then import the addon entry point from `src/index.js` in the existing renderer. The addon is a foundation layer; your current `index.html` still needs to call the exported functions when rendering each project.
