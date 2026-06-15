#!/usr/bin/env python3
"""
normalize_calm.py — convert the calmstudio-mcp "flat" relationship dialect into
canonical FINOS CALM (release 1.0+) JSON.

WHY THIS EXISTS
---------------
The calmstudio-mcp `create_architecture` tool serialises relationships in a FLAT
shape that is NOT valid against the FINOS CALM core schema:

    {
      "unique-id": "rel-x",
      "relationship-type": "composed-of",     # <- string
      "source": "agent-layer",
      "destination": "unified-agent-runtime",
      "protocol": "internal",                 # <- not in the protocol enum
      "description": "..."
    }

Canonical CALM (https://calm.finos.org/release/1.0/meta/core.json) requires
`relationship-type` to be an OBJECT and groups composed-of / deployed-in by
container with a `nodes` list:

    {
      "unique-id": "rel-agent-layer-composed-of",
      "description": "...",
      "relationship-type": {
        "composed-of": {
          "container": "agent-layer",
          "nodes": ["unified-agent-runtime", ...]
        }
      }
    }

This script reads a flat .calm.json (or a directory of them) and rewrites the
relationships into canonical form. It is idempotent: relationships that are
already canonical (relationship-type is an object) are passed through unchanged.

CONVENTIONS (matching the calmstudio-mcp tool + calm-arb-convert skill)
-----------------------------------------------------------------------
  composed-of : source = container, destination = child node   (group by source)
  deployed-in : source = node,      destination = container     (group by destination)
  interacts   : source = actor,     destination = node          (group by source)
  connects    : source/destination become node-interface objects {"node": id}
  options     : passed through unchanged

  protocol    : kept at relationship top level ONLY if it is a valid enum value;
                otherwise dropped (with a warning).

USAGE
-----
    python normalize_calm.py input.calm.json
    python normalize_calm.py input.calm.json -o output.calm.json
    python normalize_calm.py input.calm.json --in-place
    python normalize_calm.py ./some_dir --glob "*.calm.json" --in-place
    python normalize_calm.py input.calm.json --no-schema      # don't inject $schema
    python normalize_calm.py input.calm.json --fill-descriptions  # fill missing node descriptions

Exit code is 0 on success, 1 if any structural problem is detected.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Canonical CALM protocol enum (core.json -> defs/protocol)
VALID_PROTOCOLS = {
    "HTTP", "HTTPS", "FTP", "SFTP", "JDBC", "WebSocket",
    "SocketIO", "LDAP", "AMQP", "TLS", "mTLS", "TCP",
}

DEFAULT_SCHEMA = "https://calm.finos.org/release/1.0/meta/calm.json"

# Which endpoint of a flat relationship is the "container" side.
CONTAINER_SIDE = {
    "composed-of": "source",       # X composed-of Y  -> X is container
    "deployed-in": "destination",  # X deployed-in Y  -> Y is container
    "interacts":   "source",       # actor interacts with nodes -> actor is source
}


def warn(msg: str) -> None:
    print(f"[normalize_calm] WARNING: {msg}", file=sys.stderr)


def is_canonical_rel(rel: dict) -> bool:
    """A relationship is already canonical if relationship-type is an object."""
    return isinstance(rel.get("relationship-type"), dict)


def normalize_relationships(rels: list[dict]) -> list[dict]:
    """Convert a list of flat relationships into canonical CALM relationships."""
    canonical: list[dict] = []

    # Buckets for the grouping relationship types, keyed by (rtype, container)
    # Value: {"container": id, "nodes": [..], "descriptions": [..]}
    groups: dict[tuple[str, str], dict] = {}
    group_order: list[tuple[str, str]] = []

    for rel in rels:
        # Pass through anything already canonical.
        if is_canonical_rel(rel):
            canonical.append(rel)
            continue

        rtype = rel.get("relationship-type")
        src = rel.get("source")
        dst = rel.get("destination")
        desc = rel.get("description")

        if rtype in ("composed-of", "deployed-in", "interacts"):
            side = CONTAINER_SIDE[rtype]
            container = src if side == "source" else dst
            node = dst if side == "source" else src
            key = (rtype, container)
            if key not in groups:
                groups[key] = {"container": container, "nodes": [], "descriptions": []}
                group_order.append(key)
            if node not in groups[key]["nodes"]:
                groups[key]["nodes"].append(node)
            if desc:
                groups[key]["descriptions"].append(desc)

        elif rtype == "connects":
            new_rel: dict = {"unique-id": rel.get("unique-id")}
            if desc:
                new_rel["description"] = desc
            new_rel["relationship-type"] = {
                "connects": {
                    "source": {"node": src},
                    "destination": {"node": dst},
                }
            }
            proto = rel.get("protocol")
            if proto:
                if proto in VALID_PROTOCOLS:
                    new_rel["protocol"] = proto
                else:
                    warn(
                        f"relationship '{rel.get('unique-id')}' has protocol "
                        f"'{proto}' which is not a valid CALM protocol enum; dropping it. "
                        f"(valid: {', '.join(sorted(VALID_PROTOCOLS))})"
                    )
            canonical.append(new_rel)

        elif rtype == "options":
            # Uncommon in flat output; pass through best-effort.
            canonical.append(rel)

        else:
            warn(
                f"relationship '{rel.get('unique-id')}' has unrecognised "
                f"relationship-type '{rtype}'; passing through unchanged."
            )
            canonical.append(rel)

    # Emit grouped relationships in first-seen container order.
    for key in group_order:
        rtype, container = key
        g = groups[key]
        inner_key = "interacts" if rtype == "interacts" else rtype
        if rtype == "interacts":
            inner = {"actor": container, "nodes": g["nodes"]}
        else:
            inner = {"container": container, "nodes": g["nodes"]}
        descriptions = g["descriptions"]
        description = descriptions[0] if descriptions else f"{container} {rtype} {', '.join(g['nodes'])}"
        canonical.append(
            {
                "unique-id": f"rel-{container}-{rtype}",
                "description": description,
                "relationship-type": {inner_key: inner},
            }
        )

    return canonical


def normalize_architecture(arch: dict, add_schema: bool, fill_descriptions: bool) -> dict:
    """Return a canonical copy of a CALM architecture document."""
    out: dict = {}
    if add_schema and "$schema" not in arch:
        out["$schema"] = DEFAULT_SCHEMA
    elif "$schema" in arch:
        out["$schema"] = arch["$schema"]

    nodes = arch.get("nodes", [])
    norm_nodes = []
    for node in nodes:
        n = dict(node)
        if not n.get("description"):
            if fill_descriptions:
                n["description"] = n.get("name", n.get("unique-id", ""))
            else:
                warn(
                    f"node '{n.get('unique-id')}' has no 'description'; CALM core "
                    f"requires it. Re-run with --fill-descriptions to auto-fill from name."
                )
        norm_nodes.append(n)
    out["nodes"] = norm_nodes

    out["relationships"] = normalize_relationships(arch.get("relationships", []))

    # Preserve any other top-level CALM keys (metadata, controls, flows, adrs).
    for key in ("metadata", "controls", "flows", "adrs"):
        if key in arch:
            out[key] = arch[key]

    return out


def process_file(path: Path, dest: Path, add_schema: bool, fill_descriptions: bool) -> None:
    arch = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(arch, dict) or "nodes" not in arch:
        raise ValueError(f"{path}: not a CALM architecture (missing 'nodes').")
    out = normalize_architecture(arch, add_schema=add_schema, fill_descriptions=fill_descriptions)
    dest.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"[normalize_calm] {path} -> {dest}  "
          f"({len(out['nodes'])} nodes, {len(out['relationships'])} relationships)")


def main() -> int:
    ap = argparse.ArgumentParser(description="Normalize calmstudio-mcp flat CALM into canonical CALM.")
    ap.add_argument("input", help="Input .calm.json file, or a directory.")
    ap.add_argument("-o", "--output", help="Output file (single-file mode only).")
    ap.add_argument("--in-place", action="store_true", help="Overwrite the input file(s).")
    ap.add_argument("--glob", default="*.calm.json", help="Glob when input is a directory.")
    ap.add_argument("--no-schema", action="store_true", help="Do not inject a $schema field.")
    ap.add_argument("--fill-descriptions", action="store_true",
                    help="Fill missing node descriptions from the node name.")
    args = ap.parse_args()

    in_path = Path(args.input)
    add_schema = not args.no_schema

    try:
        if in_path.is_dir():
            files = sorted(in_path.glob(args.glob))
            if not files:
                warn(f"no files matching '{args.glob}' in {in_path}")
                return 1
            for f in files:
                dest = f if args.in_place else f.with_suffix(".canonical.json")
                process_file(f, dest, add_schema, args.fill_descriptions)
        else:
            if args.output:
                dest = Path(args.output)
            elif args.in_place:
                dest = in_path
            else:
                dest = in_path.with_suffix(".canonical.json")
            process_file(in_path, dest, add_schema, args.fill_descriptions)
    except (OSError, ValueError, json.JSONDecodeError) as err:
        print(f"[normalize_calm] ERROR: {err}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
