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
import org.finos.calm.domain.configs.ConfigSchemaError;
import org.finos.calm.domain.configs.ConfigType;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Validates a config against the schema that its {@link ConfigType} names. The schemas are bundled under
 * {@value ConfigType#SCHEMA_PATH}. A missing or broken schema stops start-up, because Hub cannot then accept a
 * config of that type.
 */
@ApplicationScoped
public class ConfigSchemaValidator {

    private static final JsonSchemaOptions OPTIONS = new JsonSchemaOptions()
            .setDraft(Draft.DRAFT202012)
            .setBaseUri("https://calm.finos.org/")
            .setOutputFormat(OutputFormat.Basic);

    private final SchemaRepository repository = SchemaRepository.create(OPTIONS);

    public ConfigSchemaValidator() {
        this(ConfigType.SCHEMA_PATH);
    }

    ConfigSchemaValidator(String schemaPath) {
        for (ConfigType type : ConfigType.values()) {
            JsonObject schema = new JsonObject(readResource(schemaPath + type.getSchemaFile()));
            if (!type.getSchemaId().equals(schema.getString("$id"))) {
                throw new IllegalStateException("The schema of config type " + type.getName() + " must have $id "
                        + type.getSchemaId());
            }
            repository.dereference(type.getSchemaId(), JsonSchema.of(schema));
            repository.validator(type.getSchemaId()).validate(new JsonObject());
        }
    }

    /**
     * @return the errors, or an empty list if the config is valid
     */
    public List<ConfigSchemaError> validate(ConfigType type, String configJson) {
        Object config;
        try {
            config = new JsonObject(configJson);
        } catch (DecodeException | ClassCastException | NullPointerException e) {
            return List.of(new ConfigSchemaError("", "The config must be a JSON object"));
        }
        OutputUnit result = repository.validator(type.getSchemaId()).validate(config);
        if (Boolean.TRUE.equals(result.getValid()) || result.getErrors() == null) {
            return List.of();
        }
        return result.getErrors().stream()
                .map(error -> new ConfigSchemaError(pointer(error.getInstanceLocation()), error.getError()))
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
                throw new IllegalStateException("Config type schema is not on the classpath: " + resource);
            }
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
