package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

public class TestCalmErrorResponsesShould {

    @Test
    void create_an_invalid_namespace_response() {
        try (Response response = CalmResourceErrorResponses.invalidNamespaceResponse("finos")) {
            assertThat(response.getStatus(), equalTo(404));
        }
    }
}
