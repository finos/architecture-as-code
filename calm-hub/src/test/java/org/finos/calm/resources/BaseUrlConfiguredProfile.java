package org.finos.calm.resources;

import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.Map;

public class BaseUrlConfiguredProfile implements QuarkusTestProfile {
    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
                "calm.hub.base-url", "https://hub.example.com/"
        );
    }
}
