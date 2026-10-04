# CALM Preview for IntelliJ

A Kotlin IntelliJ plugin that displays CALM JSON using the Mermaid/ELK renderer
and dark theme from FINOS CALM Preview 0.6.0. Version 0.3 adds form-based visual editing with native IntelliJ undo/redo.

## Try it

1. Build the plugin or use `target/calm-intellij-0.4.1-plugin.zip` from this workspace.
2. In IntelliJ IDEA 2026.2.1 or later, open **Settings → Plugins → gear menu → Install Plugin from Disk** and select the ZIP. Restart if requested.
3. Open `examples/sample.calm.json`, or your own `*.calm.json` / `*.architecture.json` file.
4. Right-click the file or its editor and select **Open CALM Canvas**. The preview opens in the right tool window.
5. Pan, zoom, or click a node to edit its name, type and description. Click a connection line to edit its relationship, even with labels hidden. Use **Add node**, **Add connection**, or **Edit items** to work with nodes and `connects` relationships, including nodes inside containers.
6. Choose **Apply changes** to update the open JSON document. Use **Undo** / **Redo** in the canvas or IntelliJ’s native editor actions. Use the IDE’s **Save** action to save to disk.
7. Toggle **Show Labels** to display relationship descriptions. JSON text edits refresh the preview without saving.

The plugin uses IntelliJ's embedded JCEF browser. Run the IDE with its bundled
JetBrains Runtime. When JCEF is unavailable, the tool window explains the requirement.

## Build

Requires JDK 25 and the Node version in the repository's `.nvmrc` (26).
The `intellij` Maven profile adds this module to the reactor without raising the JDK requirement for other modules.
Run these commands from the **repository root**:

```sh
npm ci --workspace calm-plugins/intellij/webview --ignore-scripts
./mvnw -Pintellij -pl calm-plugins/intellij clean verify
```

A full root `npm ci` also works. The focused install skips unrelated workspace
lifecycle hooks. The required esbuild binary comes from its platform package.
Maven compiles the webview, downloads the published IntelliJ 2026.2.1 API modules,
compiles Kotlin, runs host tests, and packages the installable ZIP in
`calm-plugins/intellij/target/`. No local IDE installation or Gradle is needed.
IDE libraries and Kotlin's standard library have provided scope and are not bundled.

Set `JAVA_HOME` to JDK 25. If npm is not on `PATH`, add
`-Dnpm.executable=/absolute/path/to/npm` and include Node in `PATH`.
`-Dwebview.skip=true` may be used only after a successful webview build.

The plugin declares minimum IDE build `262.9437.185` (2026.2.1) without an upper
bound. The bundled **Web Browser (JCEF)** plugin must be enabled. Future IDE
versions are allowed by the descriptor and still need compatibility verification.
The Kotlin compiler and standard library match the SDK's Kotlin 2.4.0 baseline.

## Checks

From the repository root:

```sh
npm run lint:intellij
npm test --workspace calm-plugins/intellij/webview -- --coverage
npm run build:intellij
npm run test:intellij:browser
./mvnw -Pintellij -pl calm-plugins/intellij verify
```

CI installs Playwright Chromium; local browser tests use Google Chrome.
Browser artifacts and coverage reports go to `sandbox/intellij/`.
To compile against another published SDK, pass `-Dintellij.build=<build number>`;
keep the minimum supported build pinned and verify the packaged plugin on both.
The CI workflow runs JetBrains Plugin Verifier on 2026.2.1 and 2026.2.3.
It mutes only `TemplateWordInPluginId` for the existing development ID
`dev.calm.intellij.preview`, preserving upgrades from earlier local builds.
That reserved-word ID must be resolved before a first Marketplace publication.

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
See `webview/vendor/preview-0.6/UPSTREAM.md`. The snapshot preserves the approved rendering while the current upstream renderer evolves.

## Next milestone

Native schema diagnostics are the next milestone. Deletion, ID renaming, editing
containment/interaction relationships, reusable asset discovery, drill navigation,
diagram export and AI integration remain future work. The Docify/Template workflows in the VS Code screenshot are not part of this diagram preview. The minimum supported IDE is IntelliJ IDEA 2026.2.1.

## Icons

Plugin and tool window icons reuse the SVG paths from FINOS `calm-plugins/vscode/media/icon.svg` and `calm-canvas.svg`. Resources provide plugin-list, standard and compact tool-window sizes. Dark variants lighten the navy strokes for contrast; the artwork geometry is unchanged. The upstream license and notice are bundled in `META-INF/calm-upstream`.

The preview follows the active IntelliJ UI theme, including diagram containers, connections and edit forms. Theme changes apply immediately and preserve zoom and unfinished edits.
