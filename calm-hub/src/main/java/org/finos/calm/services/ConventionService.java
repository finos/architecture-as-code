package org.finos.calm.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.conventions.ConventionDefault;
import org.finos.calm.domain.conventions.ConventionSchemaError;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.CreateConventionRequest;
import org.finos.calm.domain.conventions.ResolvedConventionDefault;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionSchemaValidationException;
import org.finos.calm.domain.exception.ConventionVersionExistsException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.ConventionStore;
import org.finos.calm.store.NamespaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

/**
 * Conventions and namespace defaults. A write is checked against the schema of its convention type before it is stored.
 * A namespace inherits the default of its nearest ancestor that sets one (ADR 0019).
 */
@ApplicationScoped
public class ConventionService {

    private static final Logger LOG = LoggerFactory.getLogger(ConventionService.class);

    private final ConventionStore conventionStore;
    private final NamespaceStore namespaceStore;
    private final ConventionSchemaValidator validator;

    public ConventionService(ConventionStore conventionStore, NamespaceStore namespaceStore, ConventionSchemaValidator validator) {
        this.conventionStore = conventionStore;
        this.namespaceStore = namespaceStore;
        this.validator = validator;
    }

    public List<NamespaceResourceSummary> getConventionsForNamespace(String namespace, ConventionType type)
            throws NamespaceNotFoundException {
        return conventionStore.getConventionsForNamespace(namespace, type);
    }

    public int createConvention(CreateConventionRequest request, String namespace, ConventionType type)
            throws NamespaceNotFoundException, ConventionSchemaValidationException {
        requireValid(type, request);
        return conventionStore.createConventionForNamespace(request, namespace, type);
    }

    public List<String> getConventionVersions(String namespace, ConventionType type, int id)
            throws NamespaceNotFoundException, ConventionNotFoundException {
        return conventionStore.getConventionVersions(namespace, type, id);
    }

    public String getConventionForVersion(String namespace, ConventionType type, int id, String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionNotFoundException {
        return conventionStore.getConventionForVersion(namespace, type, id, version);
    }

    public void createConventionVersion(CreateConventionRequest request, String namespace, ConventionType type, int id,
                                    String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionExistsException,
            ConventionSchemaValidationException {
        requireValid(type, request);
        conventionStore.createConventionForVersion(request, namespace, type, id, version);
    }

    /**
     * @return the default that applies to {@code namespace}: its own, else that of its nearest ancestor. Empty when
     * no namespace in the chain sets one.
     */
    public Optional<ResolvedConventionDefault> resolveDefault(String namespace, ConventionType type)
            throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        for (String candidate = namespace; candidate != null; candidate = parent(candidate)) {
            Optional<ConventionDefault> found = conventionStore.getDefault(candidate, type);
            if (found.isEmpty()) {
                continue;
            }
            ConventionDefault conventionDefault = found.get();
            try {
                String content = conventionStore.readDefault(candidate, type, conventionDefault);
                return Optional.of(new ResolvedConventionDefault(type.getName(), candidate, conventionDefault.conventionId(),
                        conventionDefault.version(), !candidate.equals(namespace), parse(content)));
            } catch (NamespaceNotFoundException | ConventionNotFoundException | ConventionVersionNotFoundException e) {
                LOG.warn("Namespace [{}] names a {} default that cannot be read. Its parent is used instead",
                        candidate, type.getName(), e);
            }
        }
        return Optional.empty();
    }

    public ConventionDefault setDefault(String namespace, ConventionType type, int id, String version)
            throws NamespaceNotFoundException, ConventionNotFoundException, ConventionVersionNotFoundException {
        return conventionStore.setDefault(namespace, type, id, version);
    }

    public boolean deleteDefault(String namespace, ConventionType type) throws NamespaceNotFoundException {
        return conventionStore.deleteDefault(namespace, type);
    }

    static String parent(String namespace) {
        int dot = namespace.lastIndexOf('.');
        return dot < 0 ? null : namespace.substring(0, dot);
    }

    private void requireValid(ConventionType type, CreateConventionRequest request) throws ConventionSchemaValidationException {
        String json = request == null ? null : request.getConventionJson();
        if (json != null && json.getBytes(StandardCharsets.UTF_8).length > SchemaValidationLimits.MAX_CONVENTION_JSON_BYTES) {
            throw new ConventionSchemaValidationException(List.of(new ConventionSchemaError("",
                    "The convention is larger than " + SchemaValidationLimits.MAX_CONVENTION_JSON_BYTES + " bytes")));
        }
        List<ConventionSchemaError> errors = validator.validate(type, json);
        if (!errors.isEmpty()) {
            throw new ConventionSchemaValidationException(errors);
        }
    }

    private static JsonObject parse(String content) {
        try (JsonReader reader = Json.createReader(new StringReader(content))) {
            return reader.readObject();
        }
    }
}
