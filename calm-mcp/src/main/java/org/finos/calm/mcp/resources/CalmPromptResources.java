package org.finos.calm.mcp.resources;

import io.quarkiverse.mcp.server.Resource;
import io.quarkiverse.mcp.server.TextResourceContents;
import jakarta.inject.Singleton;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * MCP Resources for exposing CALM prompt files as resources.
 * This class exposes all markdown files from the resources/prompts folder
 * via the MCP server for use by AI assistants and other clients.
 */
@Singleton
public class CalmPromptResources {

    @Resource(uri = "calm://prompts/calm-overview", description = "Overview of CALM (Common Architecture Language Model) including its purpose, core concepts, and benefits for modeling system architectures")
    public TextResourceContents getCalmOverview() {
        return loadMarkdownResource("/prompts/calm-overview.md", "calm://prompts/calm-overview");
    }

    @Resource(uri = "calm://prompts/calm-version", description = "CALM version reference for release/1.0-rc1 with version-specific notes and naming conventions")
    public TextResourceContents getCalmVersion() {
        return loadMarkdownResource("/prompts/calm-version.md", "calm://prompts/calm-version");
    }

    @Resource(uri = "calm://prompts/architecture-examples", description = "Complete CALM architecture examples showing single-file and multi-file approaches with nodes, relationships, and flows")
    public TextResourceContents getArchitectureExamples() {
        return loadMarkdownResource("/prompts/architecture-examples.md", "calm://prompts/architecture-examples");
    }

    @Resource(uri = "calm://prompts/control-examples", description = "CALM control examples demonstrating compliance and governance configurations with custom control-requirement schemas")
    public TextResourceContents getControlExamples() {
        return loadMarkdownResource("/prompts/control-examples.md", "calm://prompts/control-examples");
    }

    @Resource(uri = "calm://prompts/flow-examples", description = "CALM flow examples showing business-level data movement and actions across architecture with transitions and relationships")
    public TextResourceContents getFlowExamples() {
        return loadMarkdownResource("/prompts/flow-examples.md", "calm://prompts/flow-examples");
    }

    @Resource(uri = "calm://prompts/glossary", description = "CALM terminology glossary defining nodes, interfaces, relationships, flows, controls, and other key architecture concepts")
    public TextResourceContents getGlossary() {
        return loadMarkdownResource("/prompts/glossary.md", "calm://prompts/glossary");
    }

    @Resource(uri = "calm://prompts/interface-examples", description = "CALM interface examples showing modular communication endpoints including Kafka, gRPC, and HTTP interface definitions")
    public TextResourceContents getInterfaceExamples() {
        return loadMarkdownResource("/prompts/interface-examples.md", "calm://prompts/interface-examples");
    }

    @Resource(uri = "calm://prompts/metadata-examples", description = "CALM metadata examples demonstrating how to enrich architecture models with additional context and annotations")
    public TextResourceContents getMetadataExamples() {
        return loadMarkdownResource("/prompts/metadata-examples.md", "calm://prompts/metadata-examples");
    }

    @Resource(uri = "calm://prompts/node-examples", description = "CALM node examples showing different node types (services, databases, systems) with required fields and configurations")
    public TextResourceContents getNodeExamples() {
        return loadMarkdownResource("/prompts/node-examples.md", "calm://prompts/node-examples");
    }

    @Resource(uri = "calm://prompts/relationship-examples", description = "CALM relationship examples defining structural and behavioral connections between nodes with various relationship types")
    public TextResourceContents getRelationshipExamples() {
        return loadMarkdownResource("/prompts/relationship-examples.md", "calm://prompts/relationship-examples");
    }

    @Resource(uri = "calm://prompts/rules", description = "CALM modeling rules and best practices for creating valid architecture models with proper schema compliance")
    public TextResourceContents getRules() {
        return loadMarkdownResource("/prompts/rules.md", "calm://prompts/rules");
    }

    /**
     * Helper method to load markdown resources from the classpath.
     * 
     * @param resourcePath The path to the resource file
     * @param uri The URI for the resource
     * @return TextResourceContents containing the markdown content
     */
    private TextResourceContents loadMarkdownResource(String resourcePath, String uri) {
        try (InputStream inputStream = getClass().getResourceAsStream(resourcePath)) {
            if (inputStream == null) {
                return TextResourceContents.create(uri, "Resource not found: " + resourcePath);
            }
            String content = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
            return TextResourceContents.create(uri, content);
        } catch (IOException e) {
            return TextResourceContents.create(uri, "Error loading resource: " + e.getMessage());
        }
    }
}
