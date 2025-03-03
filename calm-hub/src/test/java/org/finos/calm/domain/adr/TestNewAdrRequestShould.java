package org.finos.calm.domain.adr;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

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
    void sanitize_context_on_set() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setContextAndProblemStatement("<b>My Context</b><img><script>");
        assertThat(newAdrRequest.getContextAndProblemStatement(), is("<b>My Context</b>"));
    }

    @Test
    void sanitize_decision_drivers_on_set() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setDecisionDrivers(List.of("DriverA<a><img>", "DriverB<script>"));
        assertThat(newAdrRequest.getDecisionDrivers(), is(List.of("DriverA", "DriverB")));
    }

}