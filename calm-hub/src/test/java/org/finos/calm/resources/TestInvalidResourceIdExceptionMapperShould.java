package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.exception.InvalidResourceIdException;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;

class TestInvalidResourceIdExceptionMapperShould {

    private final InvalidResourceIdExceptionMapper mapper = new InvalidResourceIdExceptionMapper();

    @Test
    void map_an_invalid_id_to_a_sanitised_400() {
        try (Response response = mapper.toResponse(new InvalidResourceIdException("<script>alert(1)</script>"))) {
            assertThat(response.getStatus(), equalTo(400));
            String body = response.getEntity().toString();
            assertThat(body, containsString("Invalid resource id"));
            assertThat(body, not(containsString("<script>")));
        }
    }
}
