package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.exception.GitHubOperationNotSupportedException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

class TestUnsupportedOperationExceptionMapperShould {

    private final UnsupportedOperationExceptionMapper mapper = new UnsupportedOperationExceptionMapper();

    @Test
    @SuppressWarnings("unchecked")
    void return_501_with_json_body() {
        GitHubWriteNotSupportedException ex = new GitHubWriteNotSupportedException("Not available in GitHub mode");

        Response response = mapper.toResponse(ex);

        assertThat(response.getStatus(), equalTo(501));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), equalTo("Not available in GitHub mode"));
    }

    @Test
    void return_application_json_content_type() {
        GitHubWriteNotSupportedException ex = new GitHubWriteNotSupportedException("test");

        Response response = mapper.toResponse(ex);

        assertThat(response.getMediaType().toString(), equalTo("application/json"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void return_501_for_a_non_write_github_operation() {
        GitHubOperationNotSupportedException ex = new GitHubOperationNotSupportedException("Not meaningful in GitHub mode");

        Response response = mapper.toResponse(ex);

        assertThat(response.getStatus(), equalTo(501));
        Map<String, String> body = (Map<String, String>) response.getEntity();
        assertThat(body.get("error"), equalTo("Not meaningful in GitHub mode"));
    }
}
