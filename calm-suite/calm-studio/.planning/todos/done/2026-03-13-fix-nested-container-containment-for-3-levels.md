---
created: 2026-03-13T06:33:46.641Z
title: Fix nested container containment for 3+ levels
area: ui
files:
  - apps/studio/src/lib/canvas/containment.ts
  - examples/aws_multi_tier_calm.json
---

## Problem

Nested container visual containment breaks at 3+ levels of depth. When a node is `deployed-in` a subnet that is itself `composed-of` a VPC, the inner node (e.g., EC2 instance) renders outside its parent subnet container. Only the first level of nesting works visually (subnet inside VPC), but the second level (EC2 inside subnet) does not position correctly.

Reproducible with `examples/aws_multi_tier_calm.json` — the architecture has VPC > Subnet > EC2/RDS/Lambda hierarchy. In the "All" view, subnets appear inside the VPC but EC2 instances, RDS, ElastiCache etc. float outside their subnet containers.

This also affects the user's earlier report about clicking on an EC2 instance inside a subnet — focus stays on the larger container instead of selecting the inner node.

## Solution

Investigate `containment.ts` parent-child positioning logic. Likely the `parentId` assignment or `zIndex` calculation doesn't recurse correctly for deeply nested containment chains. The auto-layout may also need to account for multi-level nesting when computing child positions within parent bounds.
