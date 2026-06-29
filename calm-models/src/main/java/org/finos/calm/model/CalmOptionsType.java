package org.finos.calm.model;

import org.finos.calm.model.canonical.CalmDecisionSchema;

import java.util.List;

public record CalmOptionsType(List<CalmDecision> options) implements CalmRelationshipType {
    static CalmOptionsType from(List<CalmDecisionSchema> schemas) {
        List<CalmDecision> decisions = schemas.stream().map(CalmDecision::from).toList();
        return new CalmOptionsType(decisions);
    }
}
