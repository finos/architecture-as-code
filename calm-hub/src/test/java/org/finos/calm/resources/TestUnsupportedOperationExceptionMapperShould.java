package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

class TestUnsupportedOperationExceptionMapperShould {

    private final UnsupportedOperationExceptionMapper mapper = new UnsupportedOperationExceptionMapper();

    @Test
    @SuppressWarnings("unchecked")
    void return_501_with_json_body() {
        UnsupportedOperationException ex = new UnsupportedOperationException("Not available in GitHub mode");

        Response response = mapper.toResponse(ex);

        assertThat(response.getStatus(), equalTo(501));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), equalTo("Not available in GitHub mode"));
    }

    @Test
    void return_application_json_content_type() {
        UnsupportedOperationException ex = new UnsupportedOperationException("test");

        Response response = mapper.toResponse(ex);

        assertThat(response.getMediaType().toString(), equalTo("application/json"));
    }
}
