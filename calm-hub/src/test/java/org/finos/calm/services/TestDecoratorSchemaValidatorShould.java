package org.finos.calm.services;

import io.vertx.core.json.JsonObject;
import org.finos.calm.domain.DecoratorSchemaError;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class TestDecoratorSchemaValidatorShould {

    private static final String DEPLOYMENT_STANDARD =
            "https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json";
    private static final String KUBERNETES_STANDARD =
            "https://calm.finos.org/standards/deployment/1.0/kubernetes.decorator.standard.json";
    private static final String CONTROL_EVALUATION_STANDARD =
            "https://calm.finos.org/standards/control-evaluation/1.0/control-evaluation.decorator.standard.json";
    private static final String BASE_DECORATOR =
            "https://calm.finos.org/release/1.3/meta/decorators.json#/defs/decorator";
    private static final Path STANDARDS_SOURCE = Path.of("mongo", "standards", "finos.calm");

    private static DecoratorSchemaValidator validator;

    @BeforeAll
    static void setup() {
        validator = new DecoratorSchemaValidator(List.of("1.3"), DecoratorSchemaValidator.STANDARDS_PATH);
    }

    @Test
    void know_every_bundled_decorator_standard_and_the_base_decorator_definition() {
        assumeMetaSchemasBuilt();

        assertThat(validator.isKnown(DEPLOYMENT_STANDARD), is(true));
        assertThat(validator.isKnown(KUBERNETES_STANDARD), is(true));
        assertThat(validator.isKnown(CONTROL_EVALUATION_STANDARD), is(true));
        assertThat(validator.isKnown(BASE_DECORATOR), is(true));
    }

    @Test
    void return_no_errors_for_a_decorator_that_matches_its_standard() {
        assumeMetaSchemasBuilt();

        assertThat(validator.validate(deployment("completed")), is(empty()));
    }

    @Test
    void return_the_errors_for_a_decorator_that_does_not_match_its_standard() {
        assumeMetaSchemasBuilt();

        List<DecoratorSchemaError> errors = validator.validate(deployment("done"));

        assertThat(errors, is(not(empty())));
        assertThat(errors.stream().map(DecoratorSchemaError::location).toList(), hasItem("/data/status"));
    }

    @Test
    void return_the_errors_for_a_decorator_that_does_not_match_the_base_decorator_definition() {
        assumeMetaSchemasBuilt();

        JsonObject decorator = new JsonObject().put("$schema", BASE_DECORATOR).put("type", "anything");

        assertThat(validator.validate(decorator), is(not(empty())));
    }

    @Test
    void return_no_errors_for_an_unknown_schema() {
        JsonObject decorator = new JsonObject().put("$schema", "https://example.com/my.decorator.json");

        assertThat(validator.validate(decorator), is(empty()));
    }

    @Test
    void return_no_errors_for_a_decorator_without_a_string_schema() {
        assertThat(validator.validate(new JsonObject()), is(empty()));
        assertThat(validator.validate(new JsonObject().put("$schema", 42)), is(empty()));
    }

    @Test
    void leave_a_standard_unknown_when_it_is_missing_has_no_id_or_does_not_resolve() {
        DecoratorSchemaValidator fixtureValidator =
                new DecoratorSchemaValidator(List.of("9.9"), "decorator-standards-fixture/");

        assertThat(fixtureValidator.isKnown(
                "https://calm.finos.org/standards/test/unresolvable.decorator.standard.json"), is(false));
        assertThat(fixtureValidator.isKnown("https://calm.finos.org/release/9.9/meta/decorators.json#/defs/decorator"),
                is(false));
    }

    @Test
    void leave_a_schema_unknown_when_a_nested_ref_does_not_resolve() {
        DecoratorSchemaValidator fixtureValidator =
                new DecoratorSchemaValidator(List.of("9.8", "9.7"), "decorator-standards-fixture/");

        assertThat(fixtureValidator.isKnown(
                "https://calm.finos.org/standards/test/nested-unresolvable.decorator.standard.json"), is(false));
        assertThat(fixtureValidator.isKnown("https://calm.finos.org/release/9.7/meta/decorators.json#/defs/decorator"),
                is(false));
        assertThat(fixtureValidator.isKnown("https://calm.finos.org/release/9.8/meta/decorators.json#/defs/decorator"),
                is(true));
    }

    @Test
    void leave_a_ref_outside_calm_finos_org_unchecked() {
        DecoratorSchemaValidator fixtureValidator = new DecoratorSchemaValidator(List.of(), "decorator-standards-fixture/");

        assertThat(fixtureValidator.isKnown("https://calm.finos.org/standards/test/external-ref.decorator.standard.json"), is(true));
    }

    @Test
    void load_a_release_schema_that_a_nested_relative_ref_names() {
        DecoratorSchemaValidator fixtureValidator = new DecoratorSchemaValidator(List.of("9.6"), "no-such-path/");
        String schema = "https://calm.finos.org/release/9.6/meta/decorators.json#/defs/decorator";

        assertThat(fixtureValidator.isKnown(schema), is(true));
        assertThat(fixtureValidator.validate(new JsonObject().put("$schema", schema).put("data", new JsonObject())), is(empty()));
        assertThat(fixtureValidator.validate(new JsonObject().put("$schema", schema).put("data", 5)), is(not(empty())));
    }

    @Test
    void validate_a_known_schema_that_contains_null_values() {
        DecoratorSchemaValidator fixtureValidator =
                new DecoratorSchemaValidator(List.of("9.8"), "decorator-standards-fixture/");
        String schema = "https://calm.finos.org/standards/test/nullable.decorator.standard.json";

        assertThat(fixtureValidator.isKnown(schema), is(true));
        assertThat(fixtureValidator.validate(new JsonObject().put("$schema", schema).putNull("data")), is(empty()));
        assertThat(fixtureValidator.validate(new JsonObject().put("$schema", schema).put("data", 42)), is(not(empty())));
    }

    @Test
    void validate_on_many_threads_at_once() throws Exception {
        DecoratorSchemaValidator fixtureValidator = new DecoratorSchemaValidator(List.of("9.6"), "no-such-path/");
        String schema = "https://calm.finos.org/release/9.6/meta/decorators.json#/defs/decorator";
        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Boolean>> results = IntStream.range(0, 400).mapToObj(i -> pool.submit(() -> {
                start.await();
                boolean valid = i % 2 == 0;
                JsonObject decorator = new JsonObject().put("$schema", schema).put("data", valid ? new JsonObject() : 5);
                return fixtureValidator.validate(decorator).isEmpty() == valid;
            })).toList();
            start.countDown();

            for (Future<Boolean> result : results) {
                assertThat(result.get(30, TimeUnit.SECONDS), is(true));
            }
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void know_nothing_when_there_is_no_standards_index() {
        DecoratorSchemaValidator emptyValidator = new DecoratorSchemaValidator(List.of(), "no-such-path/");

        assertThat(emptyValidator.isKnown(DEPLOYMENT_STANDARD), is(false));
    }

    @Test
    void list_every_bundled_decorator_standard_in_files_txt() throws IOException {
        Set<String> sources;
        try (Stream<Path> files = Files.walk(STANDARDS_SOURCE)) {
            sources = files.filter(file -> file.toString().endsWith(".json"))
                    .map(file -> STANDARDS_SOURCE.relativize(file).toString().replace('\\', '/'))
                    .collect(Collectors.toCollection(TreeSet::new));
        }

        TreeSet<String> indexed = new TreeSet<>(Files.readAllLines(
                Path.of("src", "main", "resources", "META-INF", "decorator-standards", "files.txt")));
        indexed.removeIf(String::isBlank);

        assertThat(indexed, equalTo(sources));
    }

    private static JsonObject deployment(String status) {
        return new JsonObject("""
                {
                    "$schema": "%s",
                    "unique-id": "deployment-1",
                    "type": "deployment",
                    "target": ["/api/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                    "target-type": ["architecture"],
                    "applies-to": ["web-service"],
                    "data": {"start-time": "2026-02-23T10:00:00Z", "status": "%s"}
                }
                """.formatted(DEPLOYMENT_STANDARD, status));
    }

    // -Pserver-only and -Dskip.npm do not copy the meta-schemas.
    private static void assumeMetaSchemasBuilt() {
        assumeTrue(Files.exists(Path.of("target", "classes", "META-INF", "calm-schemas", "1.3", "meta", "decorators.json")),
                "run a full build (without -Pserver-only or -Dskip.npm) first");
    }
}
