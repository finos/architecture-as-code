package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.ResourceType;
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

    @Test
    void create_a_resource_already_exists_response() {
        try (Response response = CalmResourceErrorResponses.resourceAlreadyExistsResponse(ResourceType.PATTERN, "repo", "finos")) {
            assertThat(response.getStatus(), equalTo(409));
            assertThat(response.getEntity(), equalTo("pattern 'repo' already exists in namespace 'finos'"));
        }
    }

    @Test
    void create_a_version_already_exists_response() {
        try (Response response = CalmResourceErrorResponses.versionAlreadyExistsResponse("1.0.1", ResourceType.ARCHITECTURE, "repo", "finos")) {
            assertThat(response.getStatus(), equalTo(409));
            assertThat(response.getEntity(),
                    equalTo("Version 1.0.1 already exists for architecture 'repo' in namespace 'finos'"));
        }
    }

    @Test
    void create_a_resource_not_found_response_capitalizing_the_resource_type() {
        try (Response response = CalmResourceErrorResponses.resourceNotFoundResponse("architecture", "finos", 5)) {
            assertThat(response.getStatus(), equalTo(404));
            assertThat(response.getEntity(), equalTo("Architecture 5 does not exist in namespace: finos"));
        }
    }

    @Test
    void create_a_resource_not_found_response_for_a_pattern() {
        try (Response response = CalmResourceErrorResponses.resourceNotFoundResponse("pattern", "finos", 5)) {
            assertThat(response.getStatus(), equalTo(404));
            assertThat(response.getEntity(), equalTo("Pattern 5 does not exist in namespace: finos"));
        }
    }

    @Test
    void create_a_resource_layout_not_found_response() {
        try (Response response = CalmResourceErrorResponses.resourceLayoutNotFoundResponse("architecture", "finos", 5)) {
            assertThat(response.getStatus(), equalTo(404));
            assertThat(response.getEntity(), equalTo("No default layout saved for architecture 5 in namespace: finos"));
        }
    }
}
