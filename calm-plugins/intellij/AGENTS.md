# CALM IntelliJ plugin

- Build the Kotlin host with the Gradle wrapper in this directory (JDK 21).
- Run npm commands from the repository root with `--workspace calm-plugins/intellij/webview`.
- Use the root package-lock.json. Do not add a webview lockfile or install dependencies from Gradle.
- Run `npm ci` at the repository root before Gradle; Gradle invokes the workspace webview build.
- Preserve the pinned FINOS 0.6 renderer in `webview/vendor`; the current widgets have different rendering behavior.
- Keep document identity and modification-stamp checks on all edits. Never serialize the rendering model back to JSON.
- Store development notes, browser results and temporary artifacts in the root `sandbox/intellij/` directory.
- Check the webview with its unit tests, lint and browser tests; check the host with `./gradlew test buildPlugin`.
