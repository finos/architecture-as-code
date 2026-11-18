package org.finos.calm.domain.exception;

import org.finos.calm.domain.DecoratorSchemaError;
import org.finos.calm.domain.SchemaValidationLimits;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.IntStream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;

class TestDecoratorSchemaValidationExceptionShould {

    @Test
    void keep_all_errors_up_to_the_cap() {
        DecoratorSchemaValidationException exception = new DecoratorSchemaValidationException(errors(20));

        assertThat(exception.getErrors(), hasSize(20));
        assertThat(exception.getMoreErrors(), is(0));
    }

    @Test
    void keep_the_first_errors_and_count_the_rest() {
        DecoratorSchemaValidationException exception = new DecoratorSchemaValidationException(errors(25));

        assertThat(exception.getErrors(), hasSize(SchemaValidationLimits.MAX_ERRORS));
        assertThat(exception.getErrors().getFirst().location(), is("/0"));
        assertThat(exception.getErrors().getLast().location(), is("/19"));
        assertThat(exception.getMoreErrors(), is(5));
    }

    private static List<DecoratorSchemaError> errors(int count) {
        return IntStream.range(0, count).mapToObj(i -> new DecoratorSchemaError("/" + i, "error " + i)).toList();
    }
}
