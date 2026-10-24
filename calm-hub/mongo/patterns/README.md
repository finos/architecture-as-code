# Namespace patterns

Patterns contributed by projects, one directory per namespace: `<namespace>/<slug>.pattern.json`. Each document's
`$id` must be `.../calm/namespaces/<namespace>/patterns/<slug>/versions/<version>`, with `<namespace>` matching its
directory. `calm-hub/nitrite/init-nitrite.sh` (`create_namespace_patterns`) seeds them through the name-based API, so
the `$id` resolves on the hub, and the read-only image builds copy this directory.
