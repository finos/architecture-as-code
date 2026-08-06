package org.finos.calm.store.util;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import org.bson.BsonDocument;
import org.bson.BsonMaximumSizeExceededException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

class TestMongoWriteFailuresShould {

    @Test
    void identify_document_too_large_errors() {
        MongoWriteException ex = new MongoWriteException(
                new WriteError(10334, "object to insert too large", new BsonDocument()), new ServerAddress(), List.of());

        assertThat(MongoWriteFailures.isDocumentTooLarge(ex), is(true));
    }

    @Test
    void not_identify_other_write_errors_as_document_too_large() {
        MongoWriteException ex = new MongoWriteException(
                new WriteError(2, "some other error", new BsonDocument()), new ServerAddress(), List.of());

        assertThat(MongoWriteFailures.isDocumentTooLarge(ex), is(false));
    }

    @Test
    void map_document_too_large_errors_to_a_capacity_exceeded_storage_write_exception() {
        MongoWriteException ex = new MongoWriteException(
                new WriteError(10334, "object to insert too large", new BsonDocument()), new ServerAddress(), List.of());

        StorageWriteException result = MongoWriteFailures.toStorageWriteException(ex);

        assertThat(result.isCapacityExceeded(), is(true));
    }

    @Test
    void map_other_write_errors_to_a_non_capacity_exceeded_storage_write_exception() {
        MongoWriteException ex = new MongoWriteException(
                new WriteError(2, "some other error", new BsonDocument()), new ServerAddress(), List.of());

        StorageWriteException result = MongoWriteFailures.toStorageWriteException(ex);

        assertThat(result.isCapacityExceeded(), is(false));
    }

    @Test
    void map_the_drivers_client_side_size_exception_to_a_capacity_exceeded_storage_write_exception() {
        BsonMaximumSizeExceededException ex = new BsonMaximumSizeExceededException("document exceeds maximum allowed size");

        StorageWriteException result = MongoWriteFailures.toStorageWriteException(ex);

        assertThat(result.isCapacityExceeded(), is(true));
    }
}
