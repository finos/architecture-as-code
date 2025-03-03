package org.finos.calm.domain.adr;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
        assertEquals(expectedNewAdrRequest, unsafelyConstructedNewAdrRequest);
    }

    @Test
    void sanitize_title_on_set() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setTitle("<b>My Title</b><img><script>");
        assertEquals("<b>My Title</b>", newAdrRequest.getTitle());
    }

    @Test
    void sanitize_context_on_set() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setContextAndProblemStatement("<b>My Context</b><img><script>");
        assertEquals("<b>My Context</b>", newAdrRequest.getContextAndProblemStatement());
    }

    @Test
    void sanitize_decision_drivers_on_set() {
        NewAdrRequest newAdrRequest = new NewAdrRequest();
        newAdrRequest.setDecisionDrivers(List.of("DriverA<a><img>", "DriverB<script>"));
        assertEquals(List.of("DriverA", "DriverB"), newAdrRequest.getDecisionDrivers());
    }

}