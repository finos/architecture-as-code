package org.finos.calm.services;

import io.vertx.core.json.DecodeException;
import io.vertx.core.json.JsonObject;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchema;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.OutputFormat;
import io.vertx.json.schema.OutputUnit;
import io.vertx.json.schema.SchemaRepository;
import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.domain.conventions.ConventionSchemaError;
import org.finos.calm.domain.conventions.ConventionType;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Validates a convention against the schema that its {@link ConventionType} names. The schemas are bundled under
 * {@value ConventionType#SCHEMA_PATH}. A missing or broken schema stops start-up, because Hub cannot then accept a
 * convention of that type.
 */
@ApplicationScoped
public class ConventionSchemaValidator {

    private static final JsonSchemaOptions OPTIONS = new JsonSchemaOptions()
            .setDraft(Draft.DRAFT202012)
            .setBaseUri("https://calm.finos.org/")
            .setOutputFormat(OutputFormat.Basic);

    private final SchemaRepository repository = SchemaRepository.create(OPTIONS);

    public ConventionSchemaValidator() {
        this(ConventionType.SCHEMA_PATH);
    }

    ConventionSchemaValidator(String schemaPath) {
        for (ConventionType type : ConventionType.values()) {
            JsonObject schema = new JsonObject(readResource(schemaPath + type.getSchemaFile()));
            if (!type.getSchemaId().equals(schema.getString("$id"))) {
                throw new IllegalStateException("The schema of convention type " + type.getName() + " must have $id "
                        + type.getSchemaId());
            }
            repository.dereference(type.getSchemaId(), JsonSchema.of(schema));
            repository.validator(type.getSchemaId()).validate(new JsonObject());
        }
    }

    /**
     * @return the errors, or an empty list if the convention is valid
     */
    public List<ConventionSchemaError> validate(ConventionType type, String conventionJson) {
        Object convention;
        try {
            convention = new JsonObject(conventionJson);
        } catch (DecodeException | ClassCastException | NullPointerException e) {
            return List.of(new ConventionSchemaError("", "The convention must be a JSON object"));
        }
        OutputUnit result = repository.validator(type.getSchemaId()).validate(convention);
        if (Boolean.TRUE.equals(result.getValid()) || result.getErrors() == null) {
            return List.of();
        }
        return result.getErrors().stream()
                .map(error -> new ConventionSchemaError(pointer(error.getInstanceLocation()), error.getError()))
                .toList();
    }

    static String pointer(String instanceLocation) {
        if (instanceLocation == null) {
            return "";
        }
        return instanceLocation.startsWith("#") ? instanceLocation.substring(1) : instanceLocation;
    }

    private static String readResource(String resource) {
        try (InputStream is = Thread.currentThread().getContextClassLoader().getResourceAsStream(resource)) {
            if (is == null) {
                throw new IllegalStateException("Convention type schema is not on the classpath: " + resource);
            }
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
