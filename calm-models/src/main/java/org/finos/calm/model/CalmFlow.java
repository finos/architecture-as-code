package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calm.model.canonical.CalmFlowSchema;
import org.finos.calm.model.canonical.CalmMetadataHelper;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public record CalmFlow(
    String uniqueId,
    String name,
    String description,
    List<CalmFlowTransition> transitions,
    Optional<String> requirementUrl,
    Optional<CalmControls> controls,
    Map<String, Object> metadata
) {
    public CalmFlow {
        transitions = transitions == null ? List.of() : List.copyOf(transitions);
        metadata = metadata == null ? Map.of() : Map.copyOf(metadata);
    }

    static CalmFlow from(CalmFlowSchema schema, ObjectMapper mapper) {
        List<CalmFlowTransition> transitions = schema.getTransitions() == null ? List.of() :
            schema.getTransitions().stream().map(CalmFlowTransition::from).toList();
        Optional<CalmControls> controls = schema.getControls() != null
            ? Optional.of(CalmControls.from(schema.getControls(), mapper))
            : Optional.empty();
        return new CalmFlow(
            schema.getUniqueId(),
            schema.getName(),
            schema.getDescription(),
            transitions,
            Optional.ofNullable(schema.getRequirementUrl()),
            controls,
            CalmMetadataHelper.flatten(schema.getMetadataRaw(), mapper)
        );
    }
}
