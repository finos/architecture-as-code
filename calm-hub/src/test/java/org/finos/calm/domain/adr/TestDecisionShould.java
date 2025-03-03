package org.finos.calm.domain.adr;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TestDecisionShould {

    @Test
    void construct_sanitized_decision() {
        Decision unsafelyConstructedDecision = new Decision(
                null,
                "<b>My Decision</b><img><a>"
        );
        Decision expectedSafeDecision = new Decision(
                null,
                "<b>My Decision</b>"
        );

        assertEquals(expectedSafeDecision, unsafelyConstructedDecision);
    }

    @Test
    void sanitize_rational_on_set() {
        Decision decision = new Decision();
        decision.setRationale("<b>My Decision</b><img><a>");
        assertEquals("<b>My Decision</b>", decision.getRationale());
    }
}