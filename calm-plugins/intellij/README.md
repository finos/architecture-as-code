# CALM Preview for IntelliJ

A Kotlin IntelliJ plugin that displays CALM JSON using the Mermaid/ELK renderer
and dark theme from FINOS CALM Preview 0.6.0. Version 0.3 adds form-based visual editing with native IntelliJ undo/redo.

## Try it

1. Build the plugin or use `build/distributions/calm-intellij-0.3.3.zip` from this workspace.
2. In IntelliJ IDEA 2025.3, open **Settings → Plugins → gear menu → Install Plugin from Disk** and select the ZIP. Restart if requested.
3. Open `examples/sample.calm.json`, or your own `*.calm.json` / `*.architecture.json` file.
4. Right-click the file or its editor and select **Open CALM Canvas**. The preview opens in the right tool window.
5. Pan, zoom, or click a node to edit its name, type and description. Click a connection line to edit its relationship, even with labels hidden. Use **Add node**, **Add connection**, or **Edit items** to work with nodes and `connects` relationships, including nodes inside containers.
6. Choose **Apply changes** to update the open JSON document. Use **Undo** / **Redo** in the canvas or IntelliJ’s native editor actions. Use the IDE’s **Save** action to save to disk.
7. Toggle **Show Labels** to display relationship descriptions. JSON text edits refresh the preview without saving.

The plugin uses IntelliJ's embedded JCEF browser. Run the IDE with its bundled
JetBrains Runtime. When JCEF is unavailable, the tool window explains the requirement.

## Build

Requires JDK 21 and Node 22.12 or newer with npm. Gradle 8.14.3 is pinned by the wrapper.

```sh
./gradlew test buildPlugin
```

This downloads IntelliJ IDEA 2025.3.6 as the build target. To use an installed IDE:

```sh
./gradlew test buildPlugin -PlocalIdePath="/Applications/IntelliJ IDEA.app"
```

If Gradle cannot find npm, add `-PnpmExecutable="/absolute/path/to/bin/npm"`.
Set `JAVA_HOME` to JDK 21 or the IDE's `Contents/jbr/Contents/Home` directory.
The build installs locked frontend dependencies with `npm ci`, compiles the UI,
and bundles JavaScript/CSS in the plugin. End users do not need Node or a web server.

Run a separate development IDE with the plugin installed:

```sh
./gradlew runIde -PlocalIdePath="/Applications/IntelliJ IDEA.app"
```

## Checks

```sh
cd webview
npm ci
npm run build
npm test
npm run test:browser
```

Browser tests use installed Google Chrome. They cover offline production rendering,
node and connection forms, request acknowledgements, conflict handling, read-only
files, refresh and malformed JSON recovery. Unit tests cover field preservation,
interface references, IDs, document snapshot checks, rendering and HTML escaping.
Browser tests mock the host bridge; native IDE undo still needs an interactive smoke test.

## Supported behavior

- Open `.calm.json`, `.architecture.json`, `.solution.json`, `.template.json`, `.standard.json`, or `.guideline.json` architecture files.
- Reuse the CALM Preview 0.6.0 block-architecture widget, templates, node shapes and dark colors.
- Render containment as dashed gray containers with ELK automatic layout.
- Start with **Show Labels** off; node names remain visible. Enabling it displays relationship descriptions and interface-name fallbacks, matching VS Code.
- Use automatic preview layout; existing `metadata._layout` data remains untouched.
- Show the selected document’s current text on opening, including unsaved edits. Refresh on document changes and matching filesystem events.
- Clear the diagram and explain the error when JSON cannot be rendered.
- Keep layout and selection in memory; change JSON only when **Apply changes** is selected.
- Preserve custom properties, controls, interface references and unrelated JSON formatting with targeted field edits.
- Check file identity and the document modification stamp before applying an edit. A stale form keeps its draft visible but requires closing and reopening.
- Offer standard CALM node types and protocols in dropdowns. Choose **Custom…** to enter any value manually; existing custom values are retained. Protocol may also be left unspecified.
- Keep existing IDs fixed. Endpoint changes with interface references require updating those references in JSON first.
- Apply each form submission as a named IntelliJ write command. Undo and redo operate on the active CALM document’s native history, including text edits.

Recognition by suffix does not guarantee a file contains a renderable architecture:
it must have a `nodes` array. Schema/pattern documents without nodes show an error.
Connections with unsupported relationship shapes may not be visible. This preview
does not provide full schema validation.

## Structure

- `src/main/kotlin`: IntelliJ action, tool window, document events, JCEF bridge.
- `webview/src`: preview, editing forms, targeted JSON edits and input guards.
- `webview/vendor/preview-0.6`: upstream widget snapshot, license and provenance.
- `examples`: a small architecture for trying the plugin.

The reference source is pinned to FINOS architecture-as-code commit `a253d0df` (VS Code extension 0.6.0).
See `webview/vendor/preview-0.6/UPSTREAM.md`. The sibling source checkout is not needed to build.

## Next milestone

Native schema diagnostics are the next milestone. Deletion, ID renaming, editing
containment/interaction relationships, reusable asset discovery, drill navigation,
diagram export and AI integration remain future work. The Docify/Template workflows in the VS Code screenshot are not part of this diagram preview. Compatibility is currently
limited to the IntelliJ IDEA 2025.3 release line.

## Icons

Plugin and tool window icons reuse the SVG paths from FINOS `calm-plugins/vscode/media/icon.svg` and `calm-canvas.svg`. Resources provide plugin-list, standard and compact tool-window sizes. Dark variants lighten the navy strokes for contrast; the artwork geometry is unchanged. The upstream license and notice are bundled in `META-INF/calm-upstream`.
