package org.finos.calm.store.github.registry;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;

import java.io.StringReader;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Detects CALM resource types from JSON content and file path conventions.
 * Ported from the VSCode plugin's self-discovery logic: uses a combination of
 * JSON structure signals (nodes[], relationships[], moments[]) and parent
 * directory naming conventions (architectures/, patterns/, etc.).
 *
 * <p>{@code building-blocks/} is deliberately aliased to {@link RegistryResourceType#STANDARD}
 * rather than kept as its own type. "Building Block" was introduced as a new CALM Hub
 * resource type without going through the CALM concept design process; Office Hours
 * (2026-09-10, #3052) agreed it should be modelled as a {@code Standard} instead. Keeping
 * the directory case here (rather than deleting it) means repos already using the VSCode
 * plugin's building-blocks-directory convention for CALM/architecture JSON files keep
 * working — only the domain concept goes away, not the file layout.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class CalmContentDetector {

    public Optional<RegistryResourceType> detect(String jsonContent, Path filePath) {
        if (jsonContent == null || jsonContent.isBlank()) {
            return Optional.empty();
        }

        JsonObject json;
        try (JsonReader reader = Json.createReader(new StringReader(jsonContent))) {
            json = reader.readObject();
        } catch (Exception e) {
            return Optional.empty();
        }

        String parentDir = getParentDirectoryName(filePath);

        if (isTimeline(json)) {
            return Optional.of(RegistryResourceType.TIMELINE);
        }

        if (hasNodesOrRelationships(json)) {
            return detectByDirectoryHint(parentDir);
        }

        if (hasSchemaMatching(json, "flow")) {
            return Optional.of(RegistryResourceType.FLOW);
        }

        if (hasSchemaMatching(json, "interface")) {
            return Optional.of(RegistryResourceType.INTERFACE);
        }

        if (hasSchemaMatching(json, "control")) {
            return Optional.of(RegistryResourceType.CONTROL);
        }

        if (hasSchemaMatching(json, "decorator")) {
            return Optional.of(RegistryResourceType.DECORATOR);
        }

        return detectByDirectoryOnly(parentDir);
    }

    private boolean isTimeline(JsonObject json) {
        boolean hasMoments = json.containsKey("moments");
        boolean hasTimelineSchema = hasSchemaMatching(json, "timeline");
        return hasMoments || hasTimelineSchema;
    }

    private boolean hasNodesOrRelationships(JsonObject json) {
        return json.containsKey("nodes") || json.containsKey("relationships");
    }

    private boolean hasSchemaMatching(JsonObject json, String keyword) {
        if (!json.containsKey("$schema")) {
            return false;
        }
        String schema = json.getString("$schema", "");
        return schema.toLowerCase().contains(keyword);
    }

    private Optional<RegistryResourceType> detectByDirectoryHint(String parentDir) {
        if (parentDir == null) return Optional.empty();
        return switch (parentDir.toLowerCase()) {
            case "patterns" -> Optional.of(RegistryResourceType.PATTERN);
            case "architectures" -> Optional.of(RegistryResourceType.ARCHITECTURE);
            case "standards", "building-blocks" -> Optional.of(RegistryResourceType.STANDARD);
            case "flows" -> Optional.of(RegistryResourceType.FLOW);
            case "interfaces" -> Optional.of(RegistryResourceType.INTERFACE);
            case "adrs" -> Optional.of(RegistryResourceType.ADR);
            case "decorators" -> Optional.of(RegistryResourceType.DECORATOR);
            default -> Optional.empty();
        };
    }

    private Optional<RegistryResourceType> detectByDirectoryOnly(String parentDir) {
        if (parentDir == null) return Optional.empty();
        return switch (parentDir.toLowerCase()) {
            case "architectures" -> Optional.of(RegistryResourceType.ARCHITECTURE);
            case "patterns" -> Optional.of(RegistryResourceType.PATTERN);
            case "standards", "building-blocks" -> Optional.of(RegistryResourceType.STANDARD);
            case "controls" -> Optional.of(RegistryResourceType.CONTROL);
            case "adrs" -> Optional.of(RegistryResourceType.ADR);
            case "flows" -> Optional.of(RegistryResourceType.FLOW);
            case "interfaces" -> Optional.of(RegistryResourceType.INTERFACE);
            case "timelines" -> Optional.of(RegistryResourceType.TIMELINE);
            case "decorators" -> Optional.of(RegistryResourceType.DECORATOR);
            default -> Optional.empty();
        };
    }

    private String getParentDirectoryName(Path filePath) {
        if (filePath == null) {
            return null;
        }
        for (int i = 0; i < filePath.getNameCount() - 1; i++) {
            String segment = filePath.getName(i).toString().toLowerCase();
            if (isKnownDirectory(segment)) {
                return segment;
            }
        }
        if (filePath.getParent() != null) {
            Path fileName = filePath.getParent().getFileName();
            return fileName != null ? fileName.toString() : null;
        }
        return null;
    }

    private boolean isKnownDirectory(String name) {
        return switch (name) {
            case "architectures", "patterns", "standards",
                 "controls", "adrs", "flows", "interfaces", "timelines", "decorators",
                 "building-blocks" -> true;
            default -> false;
        };
    }
}
