#!/bin/bash

# Build all packages in the monorepo

set -e

echo "Building all packages..."

pnpm -r --filter='!examples' build

echo "Build complete!"
