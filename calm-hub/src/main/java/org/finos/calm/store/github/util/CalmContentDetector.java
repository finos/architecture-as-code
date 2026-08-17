package org.finos.calm.store.github.util;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;

import java.io.StringReader;
import java.nio.file.Path;

/**
 * Detects CALM resource types from JSON content and file path conventions.
 * Ported from the VSCode plugin's self-discovery logic: uses a combination of
 * JSON structure signals (nodes[], relationships[], moments[]) and parent
 * directory naming conventions (architectures/, patterns/, etc.).
 */
@ApplicationScoped
public class CalmContentDetector {

    public CalmResourceType detect(String jsonContent, Path filePath) {
        if (jsonContent == null || jsonContent.isBlank()) {
            return CalmResourceType.UNKNOWN;
        }

        JsonObject json;
        try (JsonReader reader = Json.createReader(new StringReader(jsonContent))) {
            json = reader.readObject();
        } catch (Exception e) {
            return CalmResourceType.UNKNOWN;
        }

        String parentDir = getParentDirectoryName(filePath);

        if (isTimeline(json)) {
            return CalmResourceType.TIMELINE;
        }

        if (hasNodesOrRelationships(json)) {
            return detectByDirectoryHint(parentDir, CalmResourceType.UNKNOWN);
        }

        if (hasSchemaMatching(json, "flow")) {
            return CalmResourceType.FLOW;
        }

        if (hasSchemaMatching(json, "interface")) {
            return CalmResourceType.INTERFACE;
        }

        if (hasSchemaMatching(json, "control")) {
            return CalmResourceType.CONTROL;
        }

        if (hasSchemaMatching(json, "decorator")) {
            return CalmResourceType.DECORATOR;
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

    private CalmResourceType detectByDirectoryHint(String parentDir, CalmResourceType fallback) {
        if (parentDir == null) return fallback;
        return switch (parentDir.toLowerCase()) {
            case "patterns" -> CalmResourceType.PATTERN;
            case "architectures" -> CalmResourceType.ARCHITECTURE;
            case "standards" -> CalmResourceType.STANDARD;
            case "guidelines" -> CalmResourceType.GUIDELINE;
            case "flows" -> CalmResourceType.FLOW;
            case "interfaces" -> CalmResourceType.INTERFACE;
            case "adrs" -> CalmResourceType.ADR;
            case "decorators" -> CalmResourceType.DECORATOR;
            default -> fallback;
        };
    }

    private CalmResourceType detectByDirectoryOnly(String parentDir) {
        if (parentDir == null) return CalmResourceType.UNKNOWN;
        return switch (parentDir.toLowerCase()) {
            case "architectures" -> CalmResourceType.ARCHITECTURE;
            case "patterns" -> CalmResourceType.PATTERN;
            case "standards" -> CalmResourceType.STANDARD;
            case "guidelines" -> CalmResourceType.GUIDELINE;
            case "controls" -> CalmResourceType.CONTROL;
            case "adrs" -> CalmResourceType.ADR;
            case "flows" -> CalmResourceType.FLOW;
            case "interfaces" -> CalmResourceType.INTERFACE;
            case "timelines" -> CalmResourceType.TIMELINE;
            case "decorators" -> CalmResourceType.DECORATOR;
            default -> CalmResourceType.UNKNOWN;
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
            case "architectures", "patterns", "standards", "guidelines",
                 "controls", "adrs", "flows", "interfaces", "timelines", "decorators" -> true;
            default -> false;
        };
    }
}
