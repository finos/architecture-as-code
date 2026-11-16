---
id: calm-misp
title: CALM + MISP integration
---

# CALM + MISP integration

## The scenario

[MISP](https://www.misp-project.org/) is an open-source platform for sharing and correlating threat intelligence. Security teams track indicators of compromise (IoCs) in MISP and want architecture documentation to reflect the same intelligence, without copying data by hand.

## How CALM is used

This prototype models the integration as a CALM control. The control calls a MISP instance from `onBuild()`, so the architecture document connects to live threat-intelligence data while it is being built. The pattern shows how a CALM control can act as the bridge between an architecture definition and an external security platform.

The approach generalizes: any control that needs external data at build time can follow the same shape.

## Links

- [calm-misp repository](https://github.com/denisurusov/calm-misp) — a demo of a CALM control calling a MISP instance in `onBuild()`.
