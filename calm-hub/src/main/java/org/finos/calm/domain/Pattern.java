package org.finos.calm.domain;

import java.util.Objects;

/**
 * Represents an architecture and the associated namespace, id, and version.
 */
public class Pattern {
    private final String namespace;
    private final int id;
    private final String version;
    private final String pattern;

    private Pattern(PatternBuilder builder) {
        this.namespace = builder.namespace;
        this.id = builder.id;
        this.version = builder.version;
        this.pattern = builder.pattern;
    }

    /**
     * Returns the namespace of the pattern.
     * @return the namespace of the pattern
     */
    public String getNamespace() {
        return namespace;
    }

    /**
     * Returns the id of the pattern.
     * @return the id of the pattern
     */
    public int getId() {
        return id;
    }

    /**
     * Returns the version of the pattern as it should be reflected to the external world.
     * @return the version of the pattern with dot format, e.g. 1.0.0
     */
    public String getDotVersion() {
        return version;
    }

    /**
     * Returns the version of the pattern as it should be reflected to the MongoDB.
     * @return the version of the pattern with hyphen format, e.g. 1-0-0
     */
    public String getMongoVersion() {
        return version.replace('.', '-');
    }

    /**
     * Returns the pattern in JSON format.
     * @return the pattern in JSON format
     */
    public String getPatternJson() {
        return pattern;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Pattern pattern1 = (Pattern) o;
        return id == pattern1.id && Objects.equals(namespace, pattern1.namespace) && Objects.equals(version, pattern1.version) && Objects.equals(pattern, pattern1.pattern);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, id, version, pattern);
    }

    @Override
    public String toString() {
        return "Pattern{" +
                "namespace='" + namespace + '\'' +
                ", id=" + id +
                ", version='" + version + '\'' +
                ", pattern='" + pattern + '\'' +
                '}';
    }

    /**
     * Builder for the Pattern class.
     */
    public static class PatternBuilder {
        private String namespace;
        private int id;
        private String version;
        private String pattern;

        /**
         * Sets the namespace of the pattern.
         * @param namespace the namespace of the pattern
         * @return the PatternBuilder
         */
        public PatternBuilder setNamespace(String namespace) {
            this.namespace = namespace;
            return this;
        }

        /**
         * Sets the id of the pattern.
         * @param id the id of the pattern
         * @return the PatternBuilder
         */
        public PatternBuilder setId(int id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the version of the pattern.
         * @param version the version of the pattern
         * @return the PatternBuilder
         */
        public PatternBuilder setVersion(String version) {
            this.version = version;
            return this;
        }

        /**
         * Sets the pattern.
         * @param pattern the pattern
         * @return the PatternBuilder
         */
        public PatternBuilder setPattern(String pattern) {
            this.pattern = pattern;
            return this;
        }

        /**
         * Builds the Pattern object.
         * @return the Pattern object
         */
        public Pattern build() {
            return new Pattern(this);
        }
    }
}
