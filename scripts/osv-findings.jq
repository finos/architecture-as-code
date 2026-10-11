# Flattens osv-scanner JSON output into one object per finding group and marks the
# blocking ones. A finding without a CVSS score is blocking when its GitHub advisory
# severity is MODERATE or higher. Shared by osv-threshold.sh and osv-fix-npm.sh.
# Arguments: $threshold (number), $root (absolute path prefix to strip from sources).
[ .results[]? as $r
  | $r.packages[]? as $p
  | $p.groups[]? as $g
  | ([$p.vulnerabilities[]? | select(.id as $id | $g.ids | index($id)) | .database_specific.severity // empty]) as $ghsa
  | {
      source: ($r.source.path | ltrimstr($root)),
      ecosystem: $p.package.ecosystem,
      name: $p.package.name,
      package: "\($p.package.name)@\($p.package.version)",
      ids: ($g.ids | join(", ")),
      cvss: ($g.max_severity // ""),
      ghsa: ($ghsa | unique | join(","))
    }
  | .blocking = (
      if .cvss != "" then (.cvss | tonumber) >= $threshold
      else (.ghsa | test("MODERATE|HIGH|CRITICAL")) end
    )
]
