#!/bin/bash

# Run all tests in the monorepo

set -e

echo "Running tests..."

pnpm test:ci

echo "All tests passed!"
