package org.finos.calm.domain.adr;

import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

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

        assertThat(unsafelyConstructedDecision, is(expectedSafeDecision));
    }

    @Test
    void sanitize_rational_on_set() {
        Decision decision = new Decision();
        decision.setRationale("<b>My Decision</b><img><a>");
        assertThat(decision.getRationale(), is("<b>My Decision</b>"));
    }
}