package org.finos.calm.domain;

import java.util.Objects;

/**
 * Represents an interface and the associated namespace, id, version, name and description.
 */
public class Interface {
    private final String namespace;
    private final int id;
    private final String name;
    private final String description;
    private final String version;
    private final String interfaceJson;

    public Interface(InterfaceBuilder interfaceBuilder) {
        this.namespace = interfaceBuilder.namespace;
        this.id = interfaceBuilder.id;
        this.name = interfaceBuilder.name;
        this.description = interfaceBuilder.description;
        this.version = interfaceBuilder.version;
        this.interfaceJson = interfaceBuilder.interfaceJson;
    }

    public String getNamespace() {
        return namespace;
    }

    public String getVersion() {
        return version;
    }

    public String getInterfaceJson() {
        return interfaceJson;
    }

    public String getDescription() {
        return description;
    }

    public String getName() {
        return name;
    }

    public int getId() {
        return id;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        Interface that = (Interface) o;
        return id == that.id && Objects.equals(namespace, that.namespace) && Objects.equals(name, that.name) && Objects.equals(description, that.description) && Objects.equals(version, that.version) && Objects.equals(interfaceJson, that.interfaceJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, id, name, description, version, interfaceJson);
    }

    @Override
    public String toString() {
        return "Interface{" +
                "namespace='" + namespace + '\'' +
                ", id=" + id +
                ", name='" + name + '\'' +
                ", description='" + description + '\'' +
                ", version='" + version + '\'' +
                ", interfaceJson='" + interfaceJson + '\'' +
                '}';
    }

    /**
     * Builder for the Interface class.
     */
    public static class InterfaceBuilder {
        private String namespace;
        private int id;
        private String name;
        private String description;
        private String version;
        private String interfaceJson;

        public InterfaceBuilder setNamespace(String namespace) {
            this.namespace = namespace;
            return this;
        }

        public InterfaceBuilder setId(int id) {
            this.id = id;
            return this;
        }

        public InterfaceBuilder setName(String name) {
            this.name = name;
            return this;
        }

        public InterfaceBuilder setDescription(String description) {
            this.description = description;
            return this;
        }

        public InterfaceBuilder setVersion(String version) {
            this.version = version;
            return this;
        }

        public InterfaceBuilder setInterfaceJson(String interfaceJson) {
            this.interfaceJson = interfaceJson;
            return this;
        }

        public Interface build() {
            return new Interface(this);
        }
    }
}

