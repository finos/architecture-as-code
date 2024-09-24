---
id: visualize
title: Visualize
sidebar_position: 6
---

# Visualize

The `visualize` command allows you to create visual representations of your architecture directly from CALM definitions. This command produces an SVG file that visually depicts the nodes and relationships defined in your architecture.

## Basic Usage

To visualize an instantiation or a pattern, use the `visualize` command with either the `--instantiation` or `--pattern` option:

```shell
calm visualize -i instantiation.json
```

This command generates an SVG file (`calm-visualization.svg` by default) that you can open in a browser or other image viewer.

## Command Options

- **`-i, --instantiation <file>`**: Path to an instantiation file of a CALM pattern.
- **`-p, --pattern <file>`**: Path to a CALM pattern file.
- **`-o, --output <file>`**: Path where the SVG file will be saved (default: `calm-visualization.svg`).
- **`-v, --verbose`**: Enable verbose logging to see detailed output.

## Example of Visualization

Here is an example command that visualizes a pattern file and saves the output as `architecture-diagram.svg`:

```shell
calm visualize -p calm/pattern/microservices.json -o architecture-diagram.svg
```

The generated SVG provides a graphical view of the architecture, making it easier to understand and communicate your design.
