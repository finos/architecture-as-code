package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.model.canonical.CalmControlsSchema;

import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public record CalmControls(Map<String, CalmControl> controls) {

    static CalmControls from(CalmControlsSchema schema, ObjectMapper mapper) {
        Map<String, CalmControl> controls = schema.getControls().entrySet().stream()
            .collect(Collectors.toMap(
                Map.Entry::getKey,
                e -> CalmControl.from(e.getValue(), mapper)
            ));
        return new CalmControls(Map.copyOf(controls));
    }

    public Optional<CalmControl> findControl(String controlId) {
        return Optional.ofNullable(controls.get(controlId));
    }
}
