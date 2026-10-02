package org.finos.calm.store.github.registry;

import java.nio.file.Path;

/**
 * File-naming rule shared by the registry and the standard store: a standard's JSON file may
 * have a same-named {@code .md} sibling holding its prose rendering.
 */
public final class StandardFiles {

    private StandardFiles() {
    }

    /** The {@code .md} sibling a JSON standard file would have, e.g. {@code policy.standard.json} -> {@code policy.md}. */
    public static Path markdownSibling(Path jsonFile) {
        String baseName = jsonFile.getFileName().toString()
                .replaceAll("\\.(guideline|standard|calm)\\.json$", "")
                .replace(".json", "");
        return jsonFile.resolveSibling(baseName + ".md");
    }
}
