package org.finos.calm.store.github.registry;

import io.quarkus.arc.lookup.LookupIfProperty;
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
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * In-memory index of every CALM resource file across all GitHub-mode namespace clones,
 * rebuilt from scratch each time {@link #rebuild} runs (on startup, and on the periodic
 * sync schedule). Reads always see one atomically-published, immutable
 * {@link RegistrySnapshot} — never a partially-built one.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class ResourceRegistry {

    private static final Logger LOG = LoggerFactory.getLogger(ResourceRegistry.class);

    private volatile RegistrySnapshot snapshot = RegistrySnapshot.EMPTY;

    private final CalmContentDetector contentDetector;

    @Inject
    public ResourceRegistry(CalmContentDetector contentDetector) {
        this.contentDetector = contentDetector;
    }

    public RegistrySnapshot getSnapshot() {
        return snapshot;
    }

    public void rebuild(Map<String, Path> namespaceClonePaths) {
        Map<String, List<RegistryEntry>> byNamespace = new HashMap<>();
        Map<String, RegistryEntry> byQualifiedId = new HashMap<>();

        for (Map.Entry<String, Path> entry : namespaceClonePaths.entrySet()) {
            String namespace = entry.getKey();
            Path clonePath = entry.getValue();

            List<RegistryEntry> entries = scanDirectory(namespace, clonePath);
            byNamespace.put(namespace, entries);

            for (RegistryEntry registryEntry : entries) {
                // A uniqueId is only guaranteed unique when a document sets its own
                // "unique-id" - the path-derived fallback (extractUniqueId) is just the
                // filename minus extension, so two files with the same name in different
                // subdirectories (e.g. patterns/a/foo.json and patterns/b/foo.json)
                // collide here. listByType still lists both (byNamespace is unaffected),
                // but a direct findByUniqueId lookup can only ever resolve to one - log
                // it so a colliding repo layout is at least diagnosable, not a silent
                // "wrong document served" surprise. entries is sorted by path below, so
                // which one wins is at least deterministic across rebuilds.
                String qualifiedId = namespace + ":" + registryEntry.uniqueId();
                RegistryEntry previous = byQualifiedId.put(qualifiedId, registryEntry);
                if (previous != null && !previous.filePath().equals(registryEntry.filePath())) {
                    LOG.warn("uniqueId collision in namespace [{}]: [{}] and [{}] both resolve to id [{}] - "
                                    + "only [{}] is reachable via a direct id lookup",
                            namespace, previous.filePath(), registryEntry.filePath(), registryEntry.uniqueId(),
                            registryEntry.filePath());
                }
            }
        }

        this.snapshot = new RegistrySnapshot(
                Map.copyOf(byNamespace),
                Map.copyOf(byQualifiedId)
        );
        LOG.info("Registry rebuilt: {} namespaces, {} total entries",
                byNamespace.size(), byQualifiedId.size());
    }

    public Optional<RegistryEntry> findByUniqueId(String namespace, String uniqueId) {
        return snapshot.findByUniqueId(namespace, uniqueId);
    }

    public List<RegistryEntry> listByType(String namespace, RegistryResourceType type) {
        return snapshot.listByType(namespace, type);
    }

    private List<RegistryEntry> scanDirectory(String namespace, Path root) {
        List<RegistryEntry> entries = new ArrayList<>();

        if (!Files.isDirectory(root)) {
            LOG.warn("Clone path does not exist for namespace [{}]: {}", namespace, root);
            return entries;
        }

        try (Stream<Path> walk = Files.walk(root)) {
            // NOFOLLOW_LINKS: don't index a symlink as if it were real repo content -
            // defense in depth alongside GitHubFileReader's read-time containment check,
            // which is the check that actually matters (this scan only runs once per
            // calm.github.sync-interval, so a symlink swapped in between rebuilds would
            // slip past a scan-time-only guard).
            walk.filter(p -> Files.isRegularFile(p, LinkOption.NOFOLLOW_LINKS))
                    .filter(p -> p.toString().endsWith(".json") || p.toString().endsWith(".md"))
                    .filter(p -> !isHiddenOrMetadata(root, p))
                    .forEach(filePath -> {
                        RegistryEntry entry = parseFile(root, filePath);
                        if (entry != null) {
                            entries.add(entry);
                        }
                    });
        } catch (IOException e) {
            LOG.error("Failed to scan directory for namespace [{}]: {}", namespace, root, e);
        }

        // Files.walk's iteration order is unspecified - without sorting, a
        // uniqueId collision (see rebuild()) could pick a different winner on every
        // rebuild even though the repo content hasn't changed. Sorting by path makes
        // that choice at least stable.
        entries.sort(Comparator.comparing(e -> e.filePath().toString()));
        return entries;
    }

    private RegistryEntry parseFile(Path root, Path filePath) {
        try {
            Path relativePath = root.relativize(filePath);
            String fileName = filePath.getFileName().toString();

            if (fileName.endsWith(".md")) {
                return parseMarkdownFile(filePath, relativePath);
            }

            String content = Files.readString(filePath);
            Optional<RegistryResourceType> type = contentDetector.detect(content, relativePath);

            if (type.isEmpty()) {
                return null;
            }

            String uniqueId = extractUniqueId(content, relativePath);
            String name = extractName(content, relativePath);
            Instant lastModified = Files.getLastModifiedTime(filePath).toInstant();

            return new RegistryEntry(uniqueId, relativePath, type.get(), name, lastModified);
        } catch (IOException e) {
            LOG.debug("Failed to parse file: {}", filePath, e);
            return null;
        }
    }

    private RegistryEntry parseMarkdownFile(Path filePath, Path relativePath) throws IOException {
        RegistryResourceType type = detectMarkdownType(relativePath);
        if (type == null) {
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

    private RegistryResourceType detectMarkdownType(Path relativePath) {
        for (int i = 0; i < relativePath.getNameCount() - 1; i++) {
            String segment = relativePath.getName(i).toString().toLowerCase();
            switch (segment) {
                case "standards", "building-blocks": return RegistryResourceType.STANDARD;
                case "adrs": return RegistryResourceType.ADR;
                default: break;
            }
        }
        return null;
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
        return stripFileExtensions(relativePath.getFileName().toString());
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
        return stripFileExtensions(relativePath.getFileName().toString());
    }

    private String stripFileExtensions(String fileName) {
        // Strip compound extensions: .calm.json, .architecture.json, .template.json, etc.
        int firstDot = fileName.indexOf('.');
        return firstDot > 0 ? fileName.substring(0, firstDot) : fileName;
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
