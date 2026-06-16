package org.finos.calm.domain.controls;

import jakarta.validation.constraints.NotBlank;

import java.util.Objects;

public class CreateControlConfiguration {
    @NotBlank(message = "configurationJson must not be blank")
    private String configurationJson;

    /** Optional name slug. Populated by the User Facing API from the document $id; null when
     *  created via the Storage API. */
    private String name;

    public CreateControlConfiguration(String configurationJson) {
        this.configurationJson = configurationJson;
    }

    public CreateControlConfiguration(String name, String configurationJson) {
        this.name = name;
        this.configurationJson = configurationJson;
    }

    public CreateControlConfiguration() {
        //Default constructor
    }

    public String getConfigurationJson() {
        return configurationJson;
    }

    public void setConfigurationJson(String configurationJson) {
        this.configurationJson = configurationJson;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        CreateControlConfiguration that = (CreateControlConfiguration) o;
        return Objects.equals(configurationJson, that.configurationJson)
                && Objects.equals(name, that.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, configurationJson);
    }
}
