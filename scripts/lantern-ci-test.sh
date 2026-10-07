#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${BUILDKITE_SOURCE:-}" == "schedule" ]]; then
  echo "Scheduled builds do not run this pipeline."
  exit 0
fi
if [[ -n "${BUILDKITE_PULL_REQUEST_REPO:-}" && "${BUILDKITE_PULL_REQUEST_REPO}" != "${BUILDKITE_REPO:-}" ]]; then
  echo "Fork builds are not accepted."
  exit 0
fi

npm ci
npm test
