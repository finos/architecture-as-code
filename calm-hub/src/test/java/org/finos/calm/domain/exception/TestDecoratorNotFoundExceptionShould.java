package org.finos.calm.domain.exception;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class TestDecoratorNotFoundExceptionShould {

    @Test
    void be_an_instance_of_exception() {
        assertInstanceOf(Exception.class, new DecoratorNotFoundException());
    }

    @Test
    void have_the_correct_message() {
        DecoratorNotFoundException exception = new DecoratorNotFoundException();
        assertEquals("Decorator not found", exception.getMessage());
    }
}
