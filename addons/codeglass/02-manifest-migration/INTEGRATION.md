# Manifest Migration integration

## Module path

`addons/codeglass/02-manifest-migration`

## Contract

The module must be imported by the existing application through an explicit adapter. Existing legacy fields remain authoritative until the migration package is enabled and tested.

## Verification

Run the project test suite after applying this package. Do not delete the backup until the UI and original CLI workflows pass.
