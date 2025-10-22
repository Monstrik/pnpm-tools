# pnpm-registry-summary

A Node.js tool that analyzes your `pnpm-lock.yaml` file to identify which packages are being installed from custom npm registries (as opposed to the default npmjs.org registry).

## Features

- 📦 Scans `pnpm-lock.yaml` to identify all scoped packages
- 🔧 Reads `.npmrc` configuration from both project and user directories
- 📊 Groups packages by their source registry
- ⚠️  Highlights packages from non-default registries
- 🎯 Supports scoped package registry mappings (e.g., `@company:registry`)

## Installation

1. Clone this repository: