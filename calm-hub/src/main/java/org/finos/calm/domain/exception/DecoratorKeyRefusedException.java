package org.finos.calm.domain.exception;

/**
 * The store of this Hub cannot keep a key of the decorator. Each message is fixed text, so a response may show it.
 */
public class DecoratorKeyRefusedException extends RuntimeException {

    private DecoratorKeyRefusedException(String message) {
        super(message);
    }

    public static DecoratorKeyRefusedException nulCharacter() {
        return new DecoratorKeyRefusedException("This Hub cannot store a decorator key that contains a NUL character");
    }

    public static DecoratorKeyRefusedException idWithAnotherValue() {
        return new DecoratorKeyRefusedException("This Hub can store a decorator key named _id only if its value is a whole number");
    }

    public static DecoratorKeyRefusedException emptyKeyPart() {
        return new DecoratorKeyRefusedException("This Hub cannot store a decorator key that is empty, or that has an empty part before or between dots");
    }
}
