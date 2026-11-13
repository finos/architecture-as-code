#!/usr/bin/env bash
#
# check-calm-hub-release.sh <version> <image:tag>
#
# Run from calm-hub/ before a release pushes a CALM Hub image. Fails unless pom.xml is at <version>
# and <image:tag> is not in the registry: a version tag is pushed once, so that a security advisory
# can name it. Prints minor=<major.minor> for the image tags.
#
set -euo pipefail

VERSION="$1"
IMAGE="$2"

fail() {
    echo "::error::$1" >&2
    exit 1
}

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "'$VERSION' is not a release version (x.y.z)."

POM_VERSION=$(mvn -q help:evaluate -Dexpression=project.version -DforceStdout)
[ "$POM_VERSION" = "$VERSION" ] || fail "calm-hub/pom.xml is at $POM_VERSION, not $VERSION."

# Only "not found" means the tag is free. Any other error stops the release.
if OUTPUT=$(docker buildx imagetools inspect "$IMAGE" 2>&1); then
    fail "$IMAGE already exists. Release a new version instead."
elif ! grep -qi "not found" <<< "$OUTPUT"; then
    fail "Cannot check whether $IMAGE exists: $OUTPUT"
fi

echo "minor=${VERSION%.*}"
