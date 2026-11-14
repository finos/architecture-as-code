package org.finos.calm.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.configs.ConfigDefault;
import org.finos.calm.domain.configs.ConfigSchemaError;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.CreateConfigRequest;
import org.finos.calm.domain.configs.ResolvedConfigDefault;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigSchemaValidationException;
import org.finos.calm.domain.exception.ConfigVersionExistsException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.ConfigStore;
import org.finos.calm.store.NamespaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

/**
 * Configs and namespace defaults. A write is checked against the schema of its config type before it is stored.
 * A namespace inherits the default of its nearest ancestor that sets one (ADR 0019).
 */
@ApplicationScoped
public class ConfigService {

    private static final Logger LOG = LoggerFactory.getLogger(ConfigService.class);

    private final ConfigStore configStore;
    private final NamespaceStore namespaceStore;
    private final ConfigSchemaValidator validator;

    public ConfigService(ConfigStore configStore, NamespaceStore namespaceStore, ConfigSchemaValidator validator) {
        this.configStore = configStore;
        this.namespaceStore = namespaceStore;
        this.validator = validator;
    }

    public List<NamespaceResourceSummary> getConfigsForNamespace(String namespace, ConfigType type)
            throws NamespaceNotFoundException {
        return configStore.getConfigsForNamespace(namespace, type);
    }

    public int createConfig(CreateConfigRequest request, String namespace, ConfigType type)
            throws NamespaceNotFoundException, ConfigSchemaValidationException {
        requireValid(type, request);
        return configStore.createConfigForNamespace(request, namespace, type);
    }

    public List<String> getConfigVersions(String namespace, ConfigType type, int id)
            throws NamespaceNotFoundException, ConfigNotFoundException {
        return configStore.getConfigVersions(namespace, type, id);
    }

    public String getConfigForVersion(String namespace, ConfigType type, int id, String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionNotFoundException {
        return configStore.getConfigForVersion(namespace, type, id, version);
    }

    public void createConfigVersion(CreateConfigRequest request, String namespace, ConfigType type, int id,
                                    String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionExistsException,
            ConfigSchemaValidationException {
        requireValid(type, request);
        configStore.createConfigForVersion(request, namespace, type, id, version);
    }

    /**
     * @return the default that applies to {@code namespace}: its own, else that of its nearest ancestor. Empty when
     * no namespace in the chain sets one.
     */
    public Optional<ResolvedConfigDefault> resolveDefault(String namespace, ConfigType type)
            throws NamespaceNotFoundException {
        namespaceStore.requireNamespace(namespace);
        for (String candidate = namespace; candidate != null; candidate = parent(candidate)) {
            Optional<ConfigDefault> found = configStore.getDefault(candidate, type);
            if (found.isEmpty()) {
                continue;
            }
            ConfigDefault configDefault = found.get();
            try {
                String content = configStore.getConfigForVersion(candidate, type, configDefault.configId(),
                        configDefault.version());
                return Optional.of(new ResolvedConfigDefault(type.getName(), candidate, configDefault.configId(),
                        configDefault.version(), !candidate.equals(namespace), parse(content)));
            } catch (NamespaceNotFoundException | ConfigNotFoundException | ConfigVersionNotFoundException e) {
                LOG.warn("Namespace [{}] names a {} default that cannot be read. Its parent is used instead",
                        candidate, type.getName(), e);
            }
        }
        return Optional.empty();
    }

    public ConfigDefault setDefault(String namespace, ConfigType type, int id, String version)
            throws NamespaceNotFoundException, ConfigNotFoundException, ConfigVersionNotFoundException {
        return configStore.setDefault(namespace, type, id, version);
    }

    public boolean deleteDefault(String namespace, ConfigType type) throws NamespaceNotFoundException {
        return configStore.deleteDefault(namespace, type);
    }

    static String parent(String namespace) {
        int dot = namespace.lastIndexOf('.');
        return dot < 0 ? null : namespace.substring(0, dot);
    }

    private void requireValid(ConfigType type, CreateConfigRequest request) throws ConfigSchemaValidationException {
        String json = request == null ? null : request.getConfigJson();
        if (json != null && json.getBytes(StandardCharsets.UTF_8).length > SchemaValidationLimits.MAX_CONFIG_JSON_BYTES) {
            throw new ConfigSchemaValidationException(List.of(new ConfigSchemaError("",
                    "The config is larger than " + SchemaValidationLimits.MAX_CONFIG_JSON_BYTES + " bytes")));
        }
        List<ConfigSchemaError> errors = validator.validate(type, json);
        if (!errors.isEmpty()) {
            throw new ConfigSchemaValidationException(errors);
        }
    }

    private static JsonObject parse(String content) {
        try (JsonReader reader = Json.createReader(new StringReader(content))) {
            return reader.readObject();
        }
    }
}
