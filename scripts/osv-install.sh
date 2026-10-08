#!/usr/bin/env bash
# Downloads the pinned osv-scanner release into the working directory and verifies it.
# The OSV Scanner and OSV Fix workflows both use it, so the version is pinned in one place.
set -euo pipefail

OSV_SCANNER_VERSION=v2.6.0
OSV_SCANNER_SHA256=ca69b3d3cd08f889a49dc0a383122f71cc528b83803671df5fd874d97485b108

curl -fsSL -o osv-scanner \
  "https://github.com/google/osv-scanner/releases/download/${OSV_SCANNER_VERSION}/osv-scanner_linux_amd64"
echo "${OSV_SCANNER_SHA256}  osv-scanner" | sha256sum --check
chmod +x osv-scanner
