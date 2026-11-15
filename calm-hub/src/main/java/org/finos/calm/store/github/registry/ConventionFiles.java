package org.finos.calm.store.github.registry;

import org.finos.calm.domain.conventions.ConventionType;

import java.nio.file.Path;
import java.util.Optional;

/**
 * A convention in a GitHub-mode repository is a JSON file under {@code conventions/<convention-type>/}. The file
 * {@code conventions/<convention-type>/default.json} is also the namespace default for that type.
 */
public final class ConventionFiles {

    static final String CONVENTIONS_DIRECTORY = "conventions";
    public static final String DEFAULT_FILE = "default.json";

    private ConventionFiles() {
    }

    /**
     * @return the registered convention type of the file, or empty if the file is not a convention
     */
    public static Optional<ConventionType> conventionType(Path relativePath) {
        if (relativePath.getNameCount() < 3 || !relativePath.getFileName().toString().endsWith(".json")) {
            return Optional.empty();
        }
        for (int i = 0; i < relativePath.getNameCount() - 2; i++) {
            if (CONVENTIONS_DIRECTORY.equals(relativePath.getName(i).toString())) {
                return ConventionType.fromName(relativePath.getName(i + 1).toString());
            }
        }
        return Optional.empty();
    }

    public static boolean isDefault(Path relativePath) {
        return DEFAULT_FILE.equals(relativePath.getFileName().toString());
    }
}
