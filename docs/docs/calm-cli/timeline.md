---
id: timeline
title: Making a CALM Timeline
sidebar_label: timeline
---

# Making a CALM Timeline

The `timeline` command makes a [CALM timeline](../core-concepts/timelines.md) from a set of local, versioned architecture files. It makes one moment for each file, in the order that you give the files.

## Basic Usage

```shell
calm timeline -a v1.json -a v2.json -a v3.json -o calm-timeline.json
```

## Command Options

- **`-a, --architecture <files...>`**: Paths to the architecture files, in moment order. Repeat the flag, or give more than one path after one flag.
- **`-o, --output <file>`**: Path of the file for the timeline. If you do not supply it, the output goes to stdout.
- **`-v, --verbose`**: Enable verbose logging.

## How Moments Are Made

- The order of the moments is the order of the files. Plain files have no semantic versions, so the command does not sort them.
- The name and description of each moment come from the `name` and `description` of the architecture. If the architecture does not have them, the command uses the filename.
- The `detailed-architecture` reference of each moment is relative to the directory of the output file. You can move the timeline and its architectures together.

## Next Steps

- Validate the timeline: `calm validate --timeline calm-timeline.json`. See [Validating Architectures](validate.md).
- Compare its moments: `calm diff --timeline calm-timeline.json`. See [Comparing CALM Documents](diff.md).
