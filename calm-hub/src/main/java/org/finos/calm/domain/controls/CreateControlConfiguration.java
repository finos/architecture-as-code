package org.finos.calm.domain.controls;

import jakarta.validation.constraints.NotBlank;

import java.util.Objects;

public class CreateControlConfiguration {
    @NotBlank(message = "configurationJson must not be blank")
    private String configurationJson;

    public CreateControlConfiguration(String configurationJson) {
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

    @Override
    public boolean equals(Object o) {
        if (o == null || getClass() != o.getClass()) return false;
        CreateControlConfiguration that = (CreateControlConfiguration) o;
        return Objects.equals(configurationJson, that.configurationJson);
    }

    @Override
    public int hashCode() {
        return Objects.hash(configurationJson);
    }
}
