package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import org.finos.calm.domain.exception.StorageWriteException;
import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

public class TestStorageWriteExceptionMapperShould {

    private final StorageWriteExceptionMapper mapper = new StorageWriteExceptionMapper();

    @Test
    void return_413_when_capacity_exceeded() {
        try (Response response = mapper.toResponse(StorageWriteException.capacityExceeded(new RuntimeException("too big")))) {
            assertThat(response.getStatus(), equalTo(413));
        }
    }

    @Test
    void return_500_for_other_write_failures() {
        try (Response response = mapper.toResponse(StorageWriteException.writeFailed(new RuntimeException("write failed")))) {
            assertThat(response.getStatus(), equalTo(500));
        }
    }
}
