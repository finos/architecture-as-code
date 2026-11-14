package org.finos.calm.domain.configs;

import java.util.Objects;

public class CreateConfigRequest {
    private String name;
    private String description;
    private String configJson;

    public CreateConfigRequest() {
    }

    public CreateConfigRequest(String name, String description, String configJson) {
        this.name = name;
        this.description = description;
        this.configJson = configJson;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getConfigJson() {
        return configJson;
    }

    public void setConfigJson(String configJson) {
        this.configJson = configJson;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CreateConfigRequest that)) return false;
        return Objects.equals(name, that.name)
                && Objects.equals(description, that.description)
                && Objects.equals(configJson, that.configJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, description, configJson);
    }
}
