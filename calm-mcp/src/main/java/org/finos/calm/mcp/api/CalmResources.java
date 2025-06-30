package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Resource;
import io.quarkiverse.mcp.server.TextResourceContents;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.finos.calm.mcp.api.namespaces.NamespaceClient;
import org.finos.calm.mcp.api.namespaces.NamespaceInformation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class CalmResources {

    private final Logger log = LoggerFactory.getLogger(CalmResources.class);

    @RestClient
    NamespaceClient namespaceClient;

    @Resource(
            uri = "calm://getting-started.md",
            name = "CALM Getting Started Guide",
            description = "A comprehensive getting started guide for CALM (Common Architecture Language Model) including key concepts, available tools, and example workflows.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getCalmGettingStartedGuide() {
        log.info("Serving CALM Getting Started Guide");
        return loadMarkdownResource("/calm-getting-started.md", "calm://getting-started.md");
    }

    @Resource(
            uri = "calm://api-reference.md",
            name = "CALM API Reference",
            description = "Quick reference guide for all available CALM MCP tools including parameters, examples, and common workflows.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getCalmApiReference() {
        log.info("Serving CALM API Reference");
        return loadMarkdownResource("/calm-api-reference.md", "calm://api-reference.md");
    }

    @Resource(
            uri = "calm://namespace-summary.md",
            name = "CALM Namespace Summary",
            description = "Dynamic summary of all available namespaces in CALM with their descriptions and available content.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getNamespaceSummary() {
        log.info("Generating CALM Namespace Summary");
        
        try {
            // Get all namespaces from the CALM Hub
            List<NamespaceInformation> namespaces = namespaceClient.getNamespaces().getValues()
                    .stream()
                    .map(NamespaceInformation::new)
                    .toList();
            
            // Generate markdown content
            StringBuilder content = new StringBuilder();
            content.append("# CALM Namespace Summary\n\n");
            content.append("This document provides an overview of all available namespaces in the CALM system.\n\n");
            content.append("*Generated on: ").append(java.time.LocalDateTime.now()).append("*\n\n");
            
            if (namespaces.isEmpty()) {
                content.append("No namespaces are currently available.\n");
            } else {
                content.append("## Available Namespaces (").append(namespaces.size()).append(")\n\n");
                
                for (NamespaceInformation namespace : namespaces) {
                    content.append("### ").append(namespace.getName()).append("\n\n");
                    content.append(namespace.getDescription()).append("\n\n");
                    content.append("**Namespace ID:** `").append(namespace.getName()).append("`\n\n");
                    content.append("---\n\n");
                }
                
                content.append("## Quick Actions\n\n");
                content.append("To explore these namespaces further, you can:\n\n");
                content.append("- Use `getArchitectures` with any namespace to see available architectures\n");
                content.append("- Use `getPatterns` with any namespace to see available patterns\n");
                content.append("- Use `getStandards` with any namespace to see available standards\n");
                content.append("- Use `getFlows` with any namespace to see available flows\n");
                content.append("- Use `getAdrs` with any namespace to see available ADRs\n\n");
            }
            
            return new TextResourceContents("calm://namespace-summary.md", content.toString(), "text/markdown");
            
        } catch (Exception e) {
            log.error("Error generating namespace summary: {}", e.getMessage());
            // Return a fallback content
            String fallbackContent = "# CALM Namespace Summary\n\n" +
                    "An error occurred while generating the namespace summary. " +
                    "Please try using the `getNamespaces` tool directly to see available namespaces.\n\n" +
                    "Error: " + e.getMessage();
            return new TextResourceContents("calm://namespace-summary.md", fallbackContent, "text/markdown");
        }
    }

    @Resource(
            uri = "calm://overview.md",
            name = "CALM Overview",
            description = "Overview of CALM (Common Architecture Language Model) including key concepts and features.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getCalmOverview() {
        log.info("Serving CALM Overview");
        return loadMarkdownResource("/calm-overview.md", "calm://overview.md");
    }

    @Resource(
            uri = "calm://glossary.md",
            name = "CALM Glossary",
            description = "Comprehensive glossary of CALM terms and concepts including nodes, interfaces, relationships, flows, and controls.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getCalmGlossary() {
        log.info("Serving CALM Glossary");
        return loadMarkdownResource("/glossary.md", "calm://glossary.md");
    }

    @Resource(
            uri = "calm://version.md",
            name = "CALM Version Reference",
            description = "Version-specific information and compatibility notes for the current CALM release.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getCalmVersion() {
        log.info("Serving CALM Version Reference");
        return loadMarkdownResource("/calm-version.md", "calm://version.md");
    }

    @Resource(
            uri = "calm://rules.md",
            name = "CALM Modeling Rules",
            description = "Essential rules and best practices for creating valid CALM architecture models.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getCalmRules() {
        log.info("Serving CALM Modeling Rules");
        return loadMarkdownResource("/rules.md", "calm://rules.md");
    }

    @Resource(
            uri = "calm://architecture-examples.md",
            name = "CALM Architecture Examples",
            description = "Examples and templates for creating CALM architecture definitions with nodes, interfaces, and relationships.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getArchitectureExamples() {
        log.info("Serving CALM Architecture Examples");
        return loadMarkdownResource("/architecture-example.md", "calm://architecture-examples.md");
    }

    @Resource(
            uri = "calm://node-examples.md",
            name = "CALM Node Examples",
            description = "Examples of different node types and configurations in CALM architectures.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getNodeExamples() {
        log.info("Serving CALM Node Examples");
        return loadMarkdownResource("/node-examples.md", "calm://node-examples.md");
    }

    @Resource(
            uri = "calm://interface-examples.md",
            name = "CALM Interface Examples",
            description = "Examples of interface definitions and schemas for CALM node communication.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getInterfaceExamples() {
        log.info("Serving CALM Interface Examples");
        return loadMarkdownResource("/interface-examples.md", "calm://interface-examples.md");
    }

    @Resource(
            uri = "calm://relationship-examples.md",
            name = "CALM Relationship Examples",
            description = "Examples of different relationship types and configurations between CALM nodes.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getRelationshipExamples() {
        log.info("Serving CALM Relationship Examples");
        return loadMarkdownResource("/relationship-examples.md", "calm://relationship-examples.md");
    }

    @Resource(
            uri = "calm://flow-examples.md",
            name = "CALM Flow Examples",
            description = "Examples of business process flows and data flows in CALM architectures.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getFlowExamples() {
        log.info("Serving CALM Flow Examples");
        return loadMarkdownResource("/flow-examples.md", "calm://flow-examples.md");
    }

    @Resource(
            uri = "calm://control-examples.md",
            name = "CALM Control Examples",
            description = "Examples of compliance controls, security policies, and governance mechanisms in CALM.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getControlExamples() {
        log.info("Serving CALM Control Examples");
        return loadMarkdownResource("/control-examples.md", "calm://control-examples.md");
    }

    @Resource(
            uri = "calm://metadata-examples.md",
            name = "CALM Metadata Examples",
            description = "Examples of metadata usage for enriching CALM elements with additional context.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getMetadataExamples() {
        log.info("Serving CALM Metadata Examples");
        return loadMarkdownResource("/metadata-examples.md", "calm://metadata-examples.md");
    }

    @Resource(
            uri = "calm://validation-tool.md",
            name = "CALM Validation Tool Guide",
            description = "Guide for using the CALM architecture validation tool that integrates with the calm-cli for validating architecture files.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getValidationToolGuide() {
        log.info("Serving CALM Validation Tool Guide");
        return loadMarkdownResource("/validation-tool.md", "calm://validation-tool.md");
    }

    @Resource(
            uri = "calm://validation-examples.md",
            name = "CALM Validation Examples",
            description = "Examples and test cases for using the CALM architecture validation tool with sample architectures and patterns.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getValidationExamples() {
        log.info("Serving CALM Validation Examples");
        return loadMarkdownResource("/validation-examples.md", "calm://validation-examples.md");
    }

    @Resource(
            uri = "calm://pattern-operations.md",
            name = "CALM Pattern Operations Guide",
            description = "Comprehensive guide for working with CALM patterns including examples, use cases, and best practices for pattern operations.",
            mimeType = "text/markdown"
    )
    public TextResourceContents getPatternOperations() {
        log.info("Serving CALM Pattern Operations Guide");
        return loadMarkdownResource("/pattern-operations.md", "calm://pattern-operations.md");
    }

    /**
     * Helper method to load markdown resources and handle errors consistently
     */
    private TextResourceContents loadMarkdownResource(String resourcePath, String uri) {
        try {
            InputStream inputStream = getClass().getResourceAsStream(resourcePath);
            if (inputStream == null) {
                log.error("Resource not found: {}", resourcePath);
                throw new RuntimeException("Resource not found: " + resourcePath);
            }
            
            String content = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
            inputStream.close();
            
            return new TextResourceContents(uri, content, "text/markdown");
            
        } catch (IOException e) {
            log.error("Error reading resource {}: {}", resourcePath, e.getMessage());
            throw new RuntimeException("Error reading resource: " + resourcePath, e);
        }
    }
}
