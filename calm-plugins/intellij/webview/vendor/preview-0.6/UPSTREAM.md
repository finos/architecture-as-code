# CALM Preview 0.6.0 rendering source

Source: FINOS architecture-as-code at commit `a253d0df` (extension version 0.6.0).
https://github.com/finos/architecture-as-code/tree/a253d0df

The block-architecture widget, its templates, helpers, canonical model types and
theme files are copied without changes. LICENSE and NOTICE are included.
Tests from upstream were omitted. Vite precompiles the Handlebars templates at
build time, so no runtime template evaluation permission is needed.

The IntelliJ shell supplies the original dark theme, typed node shapes, ELK layout,
and the edge-labels option. Labels are off initially to match the user's reference.
Mermaid initialization follows the 0.6.0 webview, with strict security and SVG text
labels. Pan, zoom, selection and file synchronization are implemented by the host
adapter and read-only preview shell. No VS Code-specific Docify/Template workflows
are implied by this reuse.
