import { assertJsonObject, DocumentLoadError } from './document-loader';

describe('DocumentLoadError', () => {
    it('defaults to recoverable so unmarked errors fall through to the next loader', () => {
        const error = new DocumentLoadError({ name: 'OPERATION_NOT_IMPLEMENTED', message: 'not mine' });
        expect(error.recoverable).toBe(true);
    });

    it('honours an explicit non-recoverable flag', () => {
        const error = new DocumentLoadError({ name: 'UNKNOWN', message: 'fatal', recoverable: false });
        expect(error.recoverable).toBe(false);
    });
});

describe('assertJsonObject', () => {
    it('passes for a plain object', () => {
        expect(() => assertJsonObject({ foo: 'bar' }, 'calm:/foo')).not.toThrow();
    });

    it.each([
        ['a string', 'just a string', 'string'],
        ['null', null, 'null'],
        ['an array', [{ foo: 'bar' }], 'array'],
        ['a number', 42, 'number'],
    ])('throws a fatal DocumentLoadError when given %s', (_label, value, kind) => {
        let thrown: unknown;
        try {
            assertJsonObject(value, 'calm:/foo');
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeInstanceOf(DocumentLoadError);
        expect((thrown as DocumentLoadError).recoverable).toBe(false);
        expect((thrown as DocumentLoadError).message).toBe(`Expected a JSON object from calm:/foo but received: ${kind}`);
    });
});
