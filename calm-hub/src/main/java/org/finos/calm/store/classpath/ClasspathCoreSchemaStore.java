package org.finos.calm.store.classpath;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Serves CALM meta-schemas (e.g. calm.json, core.json, flow.json) from JAR-bundled
 * resources when no database is available (GitHub storage mode). In Mongo/Nitrite
 * modes these schemas live in the database; here they are bundled at build time
 * under META-INF/calm-schemas/ so the /api/calm/schemas endpoints continue to work
 * without a database connection.
 */
@ApplicationScoped
@Typed(ClasspathCoreSchemaStore.class)
public class ClasspathCoreSchemaStore implements org.finos.calm.store.CoreSchemaStore {

    private static final String SCHEMA_BASE_PATH = "META-INF/calm-schemas/";
    private static final String VERSIONS_INDEX = SCHEMA_BASE_PATH + "versions.txt";

    private final Map<String, Map<String, Object>> schemaCache = new ConcurrentHashMap<>();
    private final List<String> versions;

    public ClasspathCoreSchemaStore() {
        this.versions = loadVersions();
    }

    @Override
    public List<String> getVersions() {
        return Collections.unmodifiableList(versions);
    }

    @Override
    public Map<String, Object> getSchemasForVersion(String version) {
        if (!versions.contains(version)) {
            return null;
        }
        return schemaCache.computeIfAbsent(version, this::loadSchemasForVersion);
    }

    @Override
    public void createSchemaVersion(String version, Map<String, Object> schemas) {
        throw new UnsupportedOperationException(
                "Schema creation is not supported in GitHub storage mode. Schemas are bundled at build time.");
    }

    private List<String> loadVersions() {
        try (InputStream is = Thread.currentThread().getContextClassLoader().getResourceAsStream(VERSIONS_INDEX)) {
            if (is == null) {
                return List.of();
            }
            List<String> result = new ArrayList<>();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String trimmed = line.trim();
                    if (!trimmed.isEmpty()) {
                        result.add(trimmed);
                    }
                }
            }
            return result;
        } catch (IOException e) {
            return List.of();
        }
    }

    private Map<String, Object> loadSchemasForVersion(String version) {
        String versionPath = SCHEMA_BASE_PATH + version + "/meta/";
        Map<String, Object> schemas = new HashMap<>();

        try (InputStream listing = Thread.currentThread().getContextClassLoader()
                .getResourceAsStream(SCHEMA_BASE_PATH + version + "/files.txt")) {
            if (listing == null) {
                return schemas;
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(listing, StandardCharsets.UTF_8))) {
                String fileName;
                while ((fileName = reader.readLine()) != null) {
                    String trimmed = fileName.trim();
                    if (trimmed.isEmpty()) continue;
                    String resourcePath = versionPath + trimmed;
                    Object schema = loadJsonResource(resourcePath);
                    if (schema != null) {
                        String schemaName = trimmed.replace(".json", "");
                        schemas.put(schemaName, schema);
                    }
                }
            }
        } catch (IOException e) {
            // return whatever we managed to load
        }
        return schemas;
    }

    private Object loadJsonResource(String path) {
        try (InputStream is = Thread.currentThread().getContextClassLoader().getResourceAsStream(path)) {
            if (is == null) {
                return null;
            }
            try (JsonReader reader = Json.createReader(is)) {
                JsonObject obj = reader.readObject();
                return obj.toString();
            }
        } catch (IOException e) {
            return null;
        }
    }
}
