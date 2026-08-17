package org.finos.calm.store.github.util;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

@ApplicationScoped
public class InMemoryRegistryService {

    private static final Logger LOG = LoggerFactory.getLogger(InMemoryRegistryService.class);

    private volatile RegistrySnapshot snapshot = RegistrySnapshot.EMPTY;

    private final CalmContentDetector contentDetector;

    @Inject
    public InMemoryRegistryService(CalmContentDetector contentDetector) {
        this.contentDetector = contentDetector;
    }

    public RegistrySnapshot getSnapshot() {
        return snapshot;
    }

    public void rebuild(Map<String, Path> namespaceClonePaths) {
        Map<String, List<RegistryEntry>> byNamespace = new HashMap<>();
        Map<String, RegistryEntry> byQualifiedId = new HashMap<>();
        Map<CalmResourceType, List<RegistryEntry>> byType = new EnumMap<>(CalmResourceType.class);

        for (Map.Entry<String, Path> entry : namespaceClonePaths.entrySet()) {
            String namespace = entry.getKey();
            Path clonePath = entry.getValue();

            List<RegistryEntry> entries = scanDirectory(namespace, clonePath);
            byNamespace.put(namespace, entries);

            for (RegistryEntry registryEntry : entries) {
                byQualifiedId.put(namespace + ":" + registryEntry.uniqueId(), registryEntry);
                byType.computeIfAbsent(registryEntry.type(), k -> new ArrayList<>()).add(registryEntry);
            }
        }

        this.snapshot = new RegistrySnapshot(
                Map.copyOf(byNamespace),
                Map.copyOf(byQualifiedId),
                Map.copyOf(byType)
        );
        LOG.info("Registry rebuilt: {} namespaces, {} total entries",
                byNamespace.size(), byQualifiedId.size());
    }

    public Optional<RegistryEntry> findByUniqueId(String namespace, String uniqueId) {
        return snapshot.findByUniqueId(namespace, uniqueId);
    }

    public List<RegistryEntry> listByType(String namespace, CalmResourceType type) {
        return snapshot.listByType(namespace, type);
    }

    private List<RegistryEntry> scanDirectory(String namespace, Path root) {
        List<RegistryEntry> entries = new ArrayList<>();

        if (!Files.isDirectory(root)) {
            LOG.warn("Clone path does not exist for namespace [{}]: {}", namespace, root);
            return entries;
        }

        try (Stream<Path> walk = Files.walk(root)) {
            walk.filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".json") || p.toString().endsWith(".md"))
                    .filter(p -> !isHiddenOrMetadata(root, p))
                    .forEach(filePath -> {
                        RegistryEntry entry = parseFile(root, filePath);
                        if (entry != null && entry.type() != CalmResourceType.UNKNOWN) {
                            entries.add(entry);
                        }
                    });
        } catch (IOException e) {
            LOG.error("Failed to scan directory for namespace [{}]: {}", namespace, root, e);
        }

        return entries;
    }

    private RegistryEntry parseFile(Path root, Path filePath) {
        try {
            Path relativePath = root.relativize(filePath);
            String fileName = filePath.getFileName().toString();

            if (fileName.endsWith(".md")) {
                return parseMarkdownFile(root, filePath, relativePath);
            }

            String content = Files.readString(filePath);
            CalmResourceType type = contentDetector.detect(content, relativePath);

            if (type == CalmResourceType.UNKNOWN) {
                return null;
            }

            String uniqueId = extractUniqueId(content, relativePath);
            String name = extractName(content, relativePath);
            Instant lastModified = Files.getLastModifiedTime(filePath).toInstant();

            return new RegistryEntry(uniqueId, relativePath, type, name, lastModified);
        } catch (IOException e) {
            LOG.debug("Failed to parse file: {}", filePath, e);
            return null;
        }
    }

    private RegistryEntry parseMarkdownFile(Path root, Path filePath, Path relativePath) throws IOException {
        CalmResourceType type = detectMarkdownType(relativePath);
        if (type == CalmResourceType.UNKNOWN) {
            return null;
        }
        String fileName = filePath.getFileName().toString().replace(".md", "");
        if ("README".equalsIgnoreCase(fileName)) {
            return null;
        }
        String name = fileName.replace("-", " ");
        Instant lastModified = Files.getLastModifiedTime(filePath).toInstant();
        return new RegistryEntry(fileName, relativePath, type, name, lastModified);
    }

    private CalmResourceType detectMarkdownType(Path relativePath) {
        for (int i = 0; i < relativePath.getNameCount() - 1; i++) {
            String segment = relativePath.getName(i).toString().toLowerCase();
            switch (segment) {
                case "standards": return CalmResourceType.STANDARD;
                case "guidelines": return CalmResourceType.GUIDELINE;
                case "adrs": return CalmResourceType.ADR;
                default: break;
            }
        }
        return CalmResourceType.UNKNOWN;
    }

    private String extractUniqueId(String content, Path relativePath) {
        try (JsonReader reader = Json.createReader(new StringReader(content))) {
            JsonObject json = reader.readObject();
            if (json.containsKey("unique-id")) {
                return json.getString("unique-id");
            }
        } catch (Exception e) {
            // fall through to path-based derivation
        }
        String fileName = relativePath.getFileName().toString();
        return fileName.replace(".json", "");
    }

    private String extractName(String content, Path relativePath) {
        try (JsonReader reader = Json.createReader(new StringReader(content))) {
            JsonObject json = reader.readObject();
            if (json.containsKey("name")) {
                return json.getString("name");
            }
        } catch (Exception e) {
            // fall through to path-based derivation
        }
        String fileName = relativePath.getFileName().toString();
        return fileName.replace(".json", "");
    }

    private boolean isHiddenOrMetadata(Path root, Path filePath) {
        Path relative = root.relativize(filePath);
        String relativeStr = relative.toString();
        return relativeStr.startsWith(".") ||
                relativeStr.contains("/.") ||
                relativeStr.startsWith("node_modules") ||
                relativeStr.contains("/node_modules/");
    }
}
