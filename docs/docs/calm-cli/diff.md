---
id: diff
title: Comparing CALM Documents
sidebar_label: diff
---

# Comparing CALM Documents

The `diff` command compares two versions of a CALM architecture or pattern, or the moments of a [CALM timeline](../core-concepts/timelines.md). It matches nodes and relationships by their `unique-id`. It reports each one as added, removed, modified, renamed or unchanged.

## Basic Usage

```shell
# Two documents
calm diff -a baseline.arch.json -b updated.arch.json

# Each adjacent pair of moments in a timeline
calm diff --timeline calm-timeline.json

# Two specified moments in a timeline
calm diff --timeline calm-timeline.json --from moment-1 --to moment-3
```

The command finds the document type automatically. Use `--type` to set it.

## Command Options

- **`-a, --document-a <file>`**: Path to the first (baseline) CALM document.
- **`-b, --document-b <file>`**: Path to the second CALM document to compare with the baseline.
- **`--timeline <file>`**: Path to a CALM timeline file. Compares each adjacent pair of moments, or the pair that `--from` and `--to` give.
- **`--from <momentId>`**: With `--timeline`, the `unique-id` of the baseline moment. Requires `--to`.
- **`--to <momentId>`**: With `--timeline`, the `unique-id` of the moment to compare with the baseline. Requires `--from`.
- **`-f, --format <format>`**: Output format: `json` (default) or `summary`.
- **`-t, --type <type>`**: Set the document type: `architecture` or `pattern`.
- **`-o, --output <file>`**: Path of the file for the diff output. If you do not supply it, the output goes to stdout.
- **`--exit-code`**: Exit with a non-zero status code when there are changes.
- **`-v, --verbose`**: Enable verbose logging.

The command resolves the `detailed-architecture` references of timeline moments relative to the directory of the timeline file.

## Summary Output

Use `--format summary` for output that people can read:

```shell
$ calm diff -a ./baseline.arch.json -b ./updated.arch.json --format summary
CALM architecture diff
----------------------
Nodes:         +1  -0  ~1  ↔0  =3
Relationships: +1  -0  ~0  ↔0  =2

Nodes added:
  - audit-service
...
```

The symbols are: `+` added, `-` removed, `~` modified, `↔` renamed and `=` unchanged.

## Using `diff` in CI

`--exit-code` makes the command fail when it finds a change. A change includes items that the command skipped because they have no `unique-id`. Use it to make sure that a changed document also gets a new version:

```shell
calm diff -a ./baseline.arch.json -b ./updated.arch.json --exit-code
```

To make a timeline from versioned architecture files, use [`calm timeline`](timeline.md).
