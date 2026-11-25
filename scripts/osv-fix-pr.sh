#!/usr/bin/env bash
# Pushes the updated package-lock.json to the fix branch and opens or updates its pull
# request. The osv-scanner check is required and cannot pass while the re-scan has
# blocking findings, so the pull request is then a draft.
# Usage: osv-fix-pr.sh <clean: true|false> <re-scan-output.txt> <scanner-run-url>
# Environment: FIX_BRANCH, GITHUB_REPOSITORY_OWNER, and GH_TOKEN for gh and git.
set -euo pipefail

CLEAN="$1"
RESCAN_OUTPUT="$2"
RUN_URL="$3"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

# The scan fails twice a day until the fix merges. Do not force-push the open
# branch when it already has this lockfile, or when a maintainer has added to it.
# Drop the ref from checkout time so a failed fetch cannot leave a stale one.
git update-ref -d "refs/remotes/origin/$FIX_BRANCH"
git fetch origin "+refs/heads/$FIX_BRANCH:refs/remotes/origin/$FIX_BRANCH" 2>/dev/null || true
EXPECTED=""
PUSH=true
if git rev-parse --verify -q "origin/$FIX_BRANCH" >/dev/null; then
  EXPECTED=$(git rev-parse "origin/$FIX_BRANCH")
  # The re-scan result is for this lockfile only, not for the maintainer's changes.
  OTHER_AUTHORS=$(git log --format=%an "origin/$FIX_BRANCH" ^main | grep -v '^github-actions\[bot\]$' || true)
  if [ -n "$OTHER_AUTHORS" ]; then
    echo "The open fix branch has commits by a maintainer. Leaving it as it is." | tee -a "$SUMMARY"
    exit 0
  fi
  if git diff --quiet "origin/$FIX_BRANCH" -- package-lock.json; then
    PUSH=false
  fi
fi

# --head alone also matches a fork branch with the same name, so check the owner.
NUMBER=$(gh pr list --head "$FIX_BRANCH" --state open --json number,headRepositoryOwner \
  --jq ".[] | select(.headRepositoryOwner.login == \"$GITHUB_REPOSITORY_OWNER\") | .number" | head -n 1)

if [ "$PUSH" = "true" ]; then
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git checkout -B "$FIX_BRANCH"
  git add package-lock.json
  git commit -m "fix(deps): update vulnerable npm packages in package-lock.json"
  # Fails if the branch moved since the fetch above (empty EXPECTED = must not exist yet).
  git push --force-with-lease="$FIX_BRANCH:$EXPECTED" origin "$FIX_BRANCH"
elif [ -z "$NUMBER" ]; then
  echo "The fix branch already has this lockfile and no open pull request. Nothing to do." | tee -a "$SUMMARY"
  exit 0
else
  # A new advisory can change the re-scan result when the lockfile does not change.
  echo "The open fix branch already has this lockfile. Nothing to push." | tee -a "$SUMMARY"
fi

if [ "$CLEAN" = "true" ]; then
  DRAFT=""
  STATE="ready for review"
else
  DRAFT="yes"
  STATE="draft: blocking findings remain"
fi

BODY=$(mktemp)
{
  echo "## Description"
  echo "Automated update of \`package-lock.json\` after the OSV Scanner run on \`main\` failed: ${RUN_URL}"
  echo
  echo "Only \`npm update <package> --package-lock-only\` was applied. The manifests are unchanged."
  echo
  if [ "$CLEAN" = "true" ]; then
    echo "The re-scan of every dependency tree after the update has no blocking findings."
  else
    echo "Blocking findings remain after the update, so this pull request is a draft: the \`osv-scanner\` check cannot pass on it. They need a maintainer: a new major version, an override, a Maven change, or a suppression with a VEX statement (see SECURITY.md). Add the fix to this branch and mark the pull request as ready for review, or replace it."
  fi
  echo
  echo '```'
  cat "$RESCAN_OUTPUT"
  echo '```'
  echo
  echo "## Type of Change"
  echo "- [x] 🔧 Chore (maintenance, dependencies, CI, etc.)"
  echo
  echo "## Affected Components"
  echo "- [x] Dependencies"
  echo
  echo "## Testing"
  echo "- [x] Re-scanned every dependency tree with osv-scanner after the update (result above)"
  echo "- [ ] Build and tests run on this pull request"
} > "$BODY"

TITLE="fix(deps): update vulnerable npm packages in package-lock.json"
if [ -n "$NUMBER" ]; then
  gh pr edit "$NUMBER" --title "$TITLE" --body-file "$BODY"
  if [ "$CLEAN" = "true" ]; then
    gh pr ready "$NUMBER"
  else
    gh pr ready "$NUMBER" --undo
  fi
  echo "Updated pull request #$NUMBER ($STATE)." | tee -a "$SUMMARY"
else
  URL=$(gh pr create --base main --head "$FIX_BRANCH" --title "$TITLE" --body-file "$BODY" ${DRAFT:+--draft})
  echo "Opened pull request $URL ($STATE)." | tee -a "$SUMMARY"
fi
