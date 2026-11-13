package org.finos.calm.services;

import io.quarkus.runtime.StartupEvent;
import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.core.json.DecodeException;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.finos.calm.config.DecoratorConfig;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorSchemaError;
import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSchemaValidationException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.DecoratorTooLargeException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.ReservedDecoratorTypeException;
import org.finos.calm.store.DecoratorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * The write rules for decorators, shared by REST and MCP. A reserved type can only be written by
 * its configured principals, a decorator whose {@code $schema} Hub knows must match it, and a reserved
 * type is append-only.
 */
@ApplicationScoped
public class DecoratorWriteService {

    private static final Logger LOG = LoggerFactory.getLogger(DecoratorWriteService.class);

    private final DecoratorStore decoratorStore;
    private final DecoratorConfig config;
    private final DecoratorSchemaValidator schemaValidator;

    @Inject
    public DecoratorWriteService(DecoratorStore decoratorStore, DecoratorConfig config, DecoratorSchemaValidator schemaValidator) {
        this.decoratorStore = decoratorStore;
        this.config = config;
        this.schemaValidator = schemaValidator;
    }

    // A mistyped reserved-type key leaves the type open, so say which types are reserved.
    void logReservedTypes(@Observes StartupEvent event) {
        if (config.reserved().isEmpty()) {
            LOG.info("No decorator type is reserved");
            return;
        }
        String types = new TreeMap<>(config.reserved()).entrySet().stream()
                .map(entry -> entry.getKey() + " (" + entry.getValue().writers().size() + " writers)")
                .collect(Collectors.joining(", "));
        LOG.info("Reserved decorator types: {}", types);
    }

    public static String principalName(SecurityIdentity identity) {
        return identity == null || identity.isAnonymous() ? null : identity.getPrincipal().getName();
    }

    public boolean isReserved(String type) {
        return type != null && config.reserved().containsKey(type);
    }

    public int createDecorator(String principal, String namespace, String decoratorJson)
            throws NamespaceNotFoundException, ReservedDecoratorTypeException, DecoratorSchemaValidationException,
            DecoratorTooLargeException {
        // In GitHub mode the checks below would ask the caller to fix a decorator that Hub can never store.
        decoratorStore.requireWritable();
        requireSize(decoratorJson);
        JsonObject decorator = parse(decoratorJson);
        requireFieldTypes(decorator);
        requireWriter(principal, typeOf(decorator));
        requireValid(decorator);
        return decoratorStore.createDecorator(namespace, decoratorJson);
    }

    /**
     * Updates a decorator in place, or, when the old or new type is reserved, stores a new decorator
     * that supersedes it (reserved types are append-only).
     *
     * @return the ID of the current decorator: {@code id}, or the new ID if the decorator was superseded
     */
    public int updateDecorator(String principal, String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException,
            ReservedDecoratorTypeException, DecoratorSchemaValidationException,
            DecoratorTooLargeException {
        decoratorStore.requireWritable();
        requireSize(decoratorJson);
        JsonObject decorator = parse(decoratorJson);
        requireFieldTypes(decorator);
        Optional<Decorator> existing = decoratorStore.getDecoratorById(namespace, id);
        if (existing.isPresent()) {
            requireWriter(principal, existing.get().getType());
        }
        String type = typeOf(decorator);
        requireWriter(principal, type);
        requireValid(decorator);
        if (existing.isPresent() && (isReserved(existing.get().getType()) || isReserved(type))) {
            return decoratorStore.supersedeDecorator(namespace, id, decoratorJson);
        }
        // The store refuses a missing decorator (GitHub mode: 501) or a superseded one, also when a concurrent write
        // supersedes it after the checks above.
        decoratorStore.updateDecorator(namespace, id, decoratorJson);
        return id;
    }

    /**
     * Deletes a decorator with its whole history. Only a global admin may delete (the REST endpoint needs
     * GLOBAL_ADMIN, and MCP has no delete tool), and a global admin need not be a writer of the reserved types.
     * The delete fails if another write supersedes the current decorator first.
     */
    public void deleteDecorator(String namespace, int id)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException {
        // In GitHub mode the history lookup finds nothing, so without this a delete gives 404 and not 501.
        decoratorStore.requireWritable();
        int currentId = decoratorStore.getDecoratorHistory(namespace, id).getFirst().getId();
        decoratorStore.deleteCurrentDecoratorHistory(namespace, currentId);
    }

    // The caller controls the size, and the schema check makes every error before Hub keeps the first ones.
    // Vert.x cannot stop at the error cap: Basic output has no limit option, and only Flag output stops
    // early, with no errors. So this size limit is what bounds the cost.
    // A char is at least one UTF-8 byte, so a long string is refused without a copy.
    private static void requireSize(String decoratorJson) throws DecoratorTooLargeException {
        if (decoratorJson != null && (decoratorJson.length() > SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES
                || decoratorJson.getBytes(StandardCharsets.UTF_8).length > SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES)) {
            throw new DecoratorTooLargeException();
        }
    }

    // Hub reads these fields itself, whether or not the decorator has a $schema.
    private static void requireFieldTypes(JsonObject decorator) {
        for (String field : List.of("$schema", "unique-id", "type")) {
            if (decorator.containsKey(field) && !(decorator.getValue(field) instanceof String)) {
                throw new JsonParseException("Decorator field '" + field + "' must be a string");
            }
        }
        for (String field : List.of("target", "target-type", "applies-to")) {
            if (decorator.containsKey(field)
                    && !(decorator.getValue(field) instanceof JsonArray array && array.stream().allMatch(String.class::isInstance))) {
                throw new JsonParseException("Decorator field '" + field + "' must be an array of strings");
            }
        }
    }

    private void requireWriter(String principal, String type) throws ReservedDecoratorTypeException {
        if (!isReserved(type)) {
            return;
        }
        List<String> writers = config.reserved().get(type).writers();
        if (principal == null || !writers.contains(principal)) {
            throw new ReservedDecoratorTypeException(type);
        }
    }

    private void requireValid(JsonObject decorator) throws DecoratorSchemaValidationException {
        List<DecoratorSchemaError> errors = schemaValidator.validate(decorator);
        if (!errors.isEmpty()) {
            throw new DecoratorSchemaValidationException(errors);
        }
    }

    private static JsonObject parse(String decoratorJson) {
        if (decoratorJson == null) {
            throw new JsonParseException("Decorator JSON must be a JSON object");
        }
        try {
            return new JsonObject(decoratorJson);
        } catch (DecodeException | ClassCastException e) {
            throw new JsonParseException("Decorator JSON must be a JSON object");
        }
    }

    private static String typeOf(JsonObject decorator) {
        return decorator.getValue("type") instanceof String type ? type : null;
    }
}
