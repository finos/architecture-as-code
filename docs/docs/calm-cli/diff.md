---
id: diff
title: Comparing CALM Documents
sidebar_label: diff
---

# Comparing CALM Documents

The `diff` command compares two versions of a CALM architecture or pattern, or the moments of a [CALM timeline](../core-concepts/timelines.md). It matches nodes, relationships and flows by their `unique-id`. It reports each node and relationship as added, removed, modified, renamed or unchanged, and each flow as added, removed, modified or unchanged.

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
Flows:         +0  -0  ~1  =1

Nodes added:
  - audit-service
...
```

The symbols are: `+` added, `-` removed, `~` modified, `↔` renamed and `=` unchanged. The `Flows:` line shows only when a document has flows. Flows have no renamed count.

## Pattern Obligations

A pattern declares each node and relationship at one of three obligations:

| Obligation | Declared as | An architecture has the item |
|---|---|---|
| `required` | An entry in `prefixItems` | Always, once, at that position |
| `alternative` | An option of a `oneOf` or `anyOf` entry in `prefixItems` | Only if chosen, then once, at that position |
| `catalogue` | An option of `items` | Any number of times, or not at all |

When both versions declare an item at a different obligation, the diff reports it under `obligationChanged`, with `from` and `to`, and not as unchanged. If its content also changed, it is also modified. For example, a node that moves from `catalogue` to `required` makes each architecture without it invalid.

## Using `diff` in CI

`--exit-code` makes the command fail when it finds a change. A change includes items that the command skipped because they have no `unique-id`, and pattern items whose obligation changed. Use it to make sure that a changed document also gets a new version:

```shell
calm diff -a ./baseline.arch.json -b ./updated.arch.json --exit-code
```

To make a timeline from versioned architecture files, use [`calm timeline`](timeline.md).
