package org.finos.calm.domain.configs;

import java.util.Arrays;
import java.util.Optional;

/**
 * The registry of config types. Each type names the JSON Schema that Hub validates its configs against. See ADR 0019.
 */
public enum ConfigType {
    C4_MAPPING("c4-mapping", "https://calm.finos.org/standards/c4/1.0/c4-mapping.json", "c4-mapping.json");

    /** Classpath directory of the bundled schemas. */
    public static final String SCHEMA_PATH = "META-INF/calm-config-types/";

    private final String name;
    private final String schemaId;
    private final String schemaFile;

    ConfigType(String name, String schemaId, String schemaFile) {
        this.name = name;
        this.schemaId = schemaId;
        this.schemaFile = schemaFile;
    }

    public static Optional<ConfigType> fromName(String name) {
        return Arrays.stream(values()).filter(type -> type.name.equals(name)).findFirst();
    }

    public String getName() {
        return name;
    }

    public String getSchemaId() {
        return schemaId;
    }

    public String getSchemaFile() {
        return schemaFile;
    }
}
