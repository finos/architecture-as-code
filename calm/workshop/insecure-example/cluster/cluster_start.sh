#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

KUBERNETES_VERSION=1.30.0

echo "Starting Minikube..."
minikube start --kubernetes-version=$KUBERNETES_VERSION --cpus=4
