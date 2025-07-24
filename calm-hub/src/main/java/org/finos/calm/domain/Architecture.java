package org.finos.calm.domain;

import java.util.Objects;

/**
 * Represents an architecture and the associated namespace, id, and version.
 * The architecture is represented as a String in JSON format.
 *
 * <p>Immutable</p>
 */
public class Architecture {
    private final String namespace;
    private final String name;
    private final String description;
    private final int id;
    private final String version;
    private final String architecture;

    private Architecture(ArchitectureBuilder builder) {
        this.namespace = builder.namespace;
        this.id = builder.id;
        this.version = builder.version;
        this.architecture = builder.architecture;
        this.name = builder.name;
        this.description = builder.description;
    }

    /**
     * Returns the namespace of the architecture.
     * @return the namespace of the architecture
     */
    public String getNamespace() {
        return namespace;
    }

    /**
     * Returns the id of the architecture.
     * @return the id of the architecture
     */
    public int getId() {
        return id;
    }

    /**
     * Returns the version of the architecture as it should be reflected to the external world.
     * @return the version of the architecture with dot format, e.g. 1.0.0
     */
    public String getDotVersion() {
        return version;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    /**
     * Returns the version of the architecture as it should be reflected to the MongoDB.
     * @return the version of the architecture with hyphen format, e.g. 1-0-0
     */
    public String getMongoVersion() {
        return version.replace('.', '-');
    }

    /**
     * Returns the architecture in JSON format.
     * @return the architecture in JSON format
     */
    public String getArchitectureJson() {
        return architecture;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        Architecture that = (Architecture) o;
        return id == that.id && Objects.equals(namespace, that.namespace) && Objects.equals(version, that.version) && Objects.equals(architecture, that.architecture);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, id, version, architecture);
    }

    @Override
    public String toString() {
        return "Architecture{" +
                "namespace='" + namespace + '\'' +
                ", id=" + id +
                ", version='" + version + '\'' +
                ", architecture='" + architecture + '\'' +
                '}';
    }

    /**
     * Builder class for creating an Architecture object.
     */
    public static class ArchitectureBuilder {
        private String namespace;
        private int id;
        private String version;
        private String architecture;
        private String name;
        private String description;

        /**
         * Sets the name of the architecture.
         * @param name the name of the architecture
         * @return the ArchitectureBuilder object
         */
        public ArchitectureBuilder setName(String name) {
            this.name = name;
            return this;
        }

        /**
         * Sets the description of the architecture.
         * @param description the description of the architecture
         * @return the ArchitectureBuilder object
         */
        public ArchitectureBuilder setDescription(String description) {
            this.description = description;
            return this;
        }

        /**
         * Sets the namespace of the architecture.
         * @param namespace the namespace the architecture belongs to in CALM Hub
         * @return the ArchitectureBuilder object
         */
        public ArchitectureBuilder setNamespace(String namespace) {
            this.namespace = namespace;
            return this;
        }

        /**
         * Sets the id of the architecture.
         * @param id as an integer known by CALM Hub
         * @return the ArchitectureBuilder object
         */
        public ArchitectureBuilder setId(int id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the version of the architecture.
         * @param version the version of the architecture, in dot format e.g. 1.0.0
         * @return the ArchitectureBuilder object
         */
        public ArchitectureBuilder setVersion(String version) {
            this.version = version;
            return this;
        }

        /**
         * Sets the architecture in JSON format.
         * @param architecture the architecture in JSON format
         * @return the ArchitectureBuilder object
         */
        public ArchitectureBuilder setArchitecture(String architecture) {
            this.architecture = architecture;
            return this;
        }

        /**
         * Builds the Architecture object.
         * @return the Architecture object
         */
        public Architecture build() {
            return new Architecture(this);
        }
    }
}
