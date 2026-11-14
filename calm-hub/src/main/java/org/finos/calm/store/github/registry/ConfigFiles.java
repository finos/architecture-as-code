package org.finos.calm.store.github.registry;

import org.finos.calm.domain.configs.ConfigType;

import java.nio.file.Path;
import java.util.Optional;

/**
 * A config in a GitHub-mode repository is a JSON file under {@code configs/<config-type>/}. The file
 * {@code configs/<config-type>/default.json} is also the namespace default for that type.
 */
public final class ConfigFiles {

    static final String CONFIGS_DIRECTORY = "configs";
    public static final String DEFAULT_FILE = "default.json";

    private ConfigFiles() {
    }

    /**
     * @return the registered config type of the file, or empty if the file is not a config
     */
    public static Optional<ConfigType> configType(Path relativePath) {
        if (relativePath.getNameCount() < 3 || !relativePath.getFileName().toString().endsWith(".json")) {
            return Optional.empty();
        }
        for (int i = 0; i < relativePath.getNameCount() - 2; i++) {
            if (CONFIGS_DIRECTORY.equals(relativePath.getName(i).toString())) {
                return ConfigType.fromName(relativePath.getName(i + 1).toString());
            }
        }
        return Optional.empty();
    }

    public static boolean isDefault(Path relativePath) {
        return DEFAULT_FILE.equals(relativePath.getFileName().toString());
    }
}
