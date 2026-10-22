#!/usr/bin/env bash
# Print Docker image tags for dockerhub-publish.yml.
# Nightly:  <image>:nightly and <image>:nightly-<short-sha>
# Release:  <image>:<git-tag>, <image>:<version>, <image>:latest
set -eu

mode=nightly
if [ "$EVENT_NAME" = "push" ]; then
    mode=release
elif [ "$EVENT_NAME" = "workflow_dispatch" ]; then
    mode="${CHANNEL:-nightly}"
fi

short="${SOURCE_SHA:0:7}"
ref="${GITHUB_REF_NAME}"
if [ "$EVENT_NAME" = "workflow_dispatch" ] && [ "$mode" = "release" ]; then
    ref="${INPUT_TAG:-}"
fi

if [ "$mode" = "release" ] && [ -z "$ref" ]; then
    echo "Release publish needs a tag. Set the workflow input 'tag' or push a release tag."
    exit 1
fi

version=""
case "$ref" in
    calm-hub-v*) version="${ref#calm-hub-v}" ;;
    calm-studio-v*) version="${ref#calm-studio-v}" ;;
    release-v*) version="${ref#release-v}" ;;
    release-*) version="${ref#release-}" ;;
    v*) version="${ref#v}" ;;
esac

{
    echo "list<<EOF"
    if [ "$mode" = "nightly" ]; then
        echo "${IMAGE}:nightly"
        echo "${IMAGE}:nightly-${short}"
    else
        echo "${IMAGE}:${ref}"
        if [ -n "$version" ] && [ "$version" != "$ref" ]; then
            echo "${IMAGE}:${version}"
        fi
        echo "${IMAGE}:latest"
    fi
    echo "EOF"
} >> "$GITHUB_OUTPUT"

echo "Publishing ${IMAGE} as ${mode} (${short})"
