package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.HashMap;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CalmControlsSchema {
    private final Map<String, CalmControlSchema> controls = new HashMap<>();

    @JsonAnySetter
    public void addControl(String key, CalmControlSchema value) {
        controls.put(key, value);
    }

    @JsonAnyGetter
    public Map<String, CalmControlSchema> getControls() { return controls; }
}
