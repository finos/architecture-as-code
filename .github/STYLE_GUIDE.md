# CLI

## Testing

### Be cautious when generating tests with AI

Generating tests with AI assistants such as GitHub Copilot is a considerable time-saver, but without close attention can lead to dense, complex tests that are hard to maintain. 
When using an AI assistant to write tests, be very cautious and prefer specifying the exact test cases to cover, rather than allowing the AI to just 'write tests for this code'.

Furthermore, AI can mask issues in your code that might otherwise emerge when writing your tests.
One example is a missing abstraction - for example, code that directly calls the many methods of the `fs` module for filesystem access will lead to unpleasant, very verbose mocks when writing unit tests. 
This would normally be an indicator to the author that perhaps an abstraction is missing: this abstraction could be mocked much more easily.

AI assistants will not give you this feedback most of the time, so caution is advised.

### Mocking - use vitest and `vi.hoisted`

Mocking should be done with vitest. 
However, there are many ways to do it and the inconsistencies make maintaining test harder.

The best way to do mocks is to use the `vi.hoisted` method to create a top-level set of mocks that are reset after each test.
This helps eliminate complex nested mocks.

For an example, see [`validate.spec.ts`](`cli/src/command-helpers/validate.spec.ts`). 
This mocks a lot of objects - by defining them at the top, they are easily accessible and complexity is reduced.

### File system tests - prefer `memfs` over manual mocks

When integration testing the CLI, a common problem is testing the loading of files.
This typically either requires a lot of test fixture files which are challenging to keep up to date, or mocking the FS module.

Note that **unit tests** should be wrapping file-loading code in an abstraction, such as `FileSystemDocumentLoader`, and mocking that abstraction. 
This applies only to integration/e2e style testing.

The (`memfs`)[https://github.com/streamich/memfs] library provides a convenient way to mock the filesystem directly from code, and is ideal for testing.
Where possible, please use this library.
For an example of usage, see [`file-system-document-loader.spec.ts`](shared/src/document-loader/file-system-document-loader.spec.ts).

# Visualiser

TODO

# CalmHub

TODO