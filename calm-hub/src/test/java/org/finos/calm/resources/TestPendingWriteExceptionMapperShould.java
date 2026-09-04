package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.exception.PendingWriteException;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

class TestPendingWriteExceptionMapperShould {

    private final PendingWriteExceptionMapper mapper = new PendingWriteExceptionMapper();

    @Test
    @SuppressWarnings("unchecked")
    void return_202_accepted_with_pr_details() {
        PendingWriteException ex = new PendingWriteException(
                "https://github.com/org/repo/pull/42", 42, "calm-hub/pattern-abc-123");

        Response response = mapper.toResponse(ex);

        assertThat(response.getStatus(), equalTo(202));
        Map<String, Object> body = (Map<String, Object>) response.getEntity();
        assertThat(body.get("status"), equalTo("pending"));
        assertThat(body.get("pullRequestUrl"), equalTo("https://github.com/org/repo/pull/42"));
        assertThat(body.get("pullRequestNumber"), equalTo(42));
    }

    @Test
    void return_application_json_content_type() {
        PendingWriteException ex = new PendingWriteException("https://github.com/x/y/pull/1", 1, "branch");

        Response response = mapper.toResponse(ex);

        assertThat(response.getMediaType().toString(), equalTo("application/json"));
    }
}
