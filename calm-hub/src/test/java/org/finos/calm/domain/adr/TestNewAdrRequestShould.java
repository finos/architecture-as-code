package org.finos.calm.domain.adr;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

class TestNewAdrRequestShould {

    @Test
    void construct_sanitized_new_adr_request() {
        NewAdrRequest unsafelyConstructedNewAdrRequest = new NewAdrRequest(
                "<b>My Title</b><img><script>",
                "context<body></html>",
                List.of("stuff goes here<img><script>"),
                null,
                null,
                null
        );
        NewAdrRequest expectedNewAdrRequest = new NewAdrRequest(
                "<b>My Title</b>",
                "context",
                List.of("stuff goes here"),
                null,
                null,
                null
        );
        assertThat(unsafelyConstructedNewAdrRequest, is(expectedNewAdrRequest));
    }

    @Test
    void sanitize_title_on_set() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setTitle("<b>My Title</b><img><script>");
        assertThat(newAdrRequest.getTitle(), is("<b>My Title</b>"));
    }

    @Test
    void not_fail_on_a_null_title() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setTitle(null);
        assertThat(newAdrRequest.getTitle(), is(nullValue()));
    }

    @Test
    void sanitize_context_on_set() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setContextAndProblemStatement("<b>My Context</b><img><script>");
        assertThat(newAdrRequest.getContextAndProblemStatement(), is("<b>My Context</b>"));
    }

    @Test
    void not_fail_on_a_null_context() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setContextAndProblemStatement(null);
        assertThat(newAdrRequest.getContextAndProblemStatement(), is(nullValue()));
    }

    @Test
    void sanitize_decision_drivers_on_set() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setDecisionDrivers(List.of("DriverA<a><img>", "DriverB<script>"));
        assertThat(newAdrRequest.getDecisionDrivers(), is(List.of("DriverA", "DriverB")));
    }

    @Test
    void not_fail_on_a_null_decision_drivers() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setDecisionDrivers(null);
        assertThat(newAdrRequest.getDecisionDrivers(), is(nullValue()));
    }

    @Test
    void not_sanitize_or_change_options() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        Option option = new Option();
        option.setName("This is a test option");
        newAdrRequest.setConsideredOptions(List.of(option));
        assertThat(newAdrRequest.getConsideredOptions(), is(List.of(option)));
    }

    @Test
    void not_sanitize_or_change_decision_outcome() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        Decision decision = new Decision();
        decision.setRationale("This is a test outcome");
        newAdrRequest.setDecisionOutcome(decision);
        assertThat(newAdrRequest.getDecisionOutcome(), is(decision));
    }

}