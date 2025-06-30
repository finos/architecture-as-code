package org.finos.calm.mcp.resources;

import io.quarkiverse.mcp.server.Resource;
import io.quarkiverse.mcp.server.TextResourceContents;
import io.quarkiverse.mcp.server.Tool;
import jakarta.inject.Singleton;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * MCP Resources for exposing CALM v1.0-rc1 schema files.
 * This class exposes the JSON Schema definitions that define the structure
 * and validation rules for CALM architecture models.
 */
@Singleton
public class CalmSchemaResources {

    private static final String SCHEMA_VERSION = "1.0-rc1";
    private static final String SCHEMA_BASE_PATH = "/calm-schema/meta/";

    @Resource(uri = "calm://schema/core", description = "Core CALM schema defining nodes, relationships, and fundamental architecture constructs")
    public TextResourceContents getCoreSchema() {
        return loadSchemaResource("core.json", "calm://schema/core", 
            "Core CALM schema defining nodes, relationships, and fundamental architecture constructs");
    }

    @Resource(uri = "calm://schema/calm", description = "Main CALM schema that combines all vocabulary definitions into a comprehensive architecture modeling language")
    public TextResourceContents getCalmSchema() {
        return loadSchemaResource("calm.json", "calm://schema/calm", 
            "Main CALM schema that combines all vocabulary definitions");
    }

    @Resource(uri = "calm://schema/control", description = "CALM control schema for compliance and governance definitions including security, audit, and regulatory controls")
    public TextResourceContents getControlSchema() {
        return loadSchemaResource("control.json", "calm://schema/control", 
            "CALM control schema for compliance and governance definitions");
    }

    @Resource(uri = "calm://schema/control-requirement", description = "CALM control requirement schema for defining compliance requirements and control specifications")
    public TextResourceContents getControlRequirementSchema() {
        return loadSchemaResource("control-requirement.json", "calm://schema/control-requirement", 
            "CALM control requirement schema for defining compliance requirements");
    }

    @Resource(uri = "calm://schema/evidence", description = "CALM evidence schema for compliance evidence and audit trails supporting governance and regulatory requirements")
    public TextResourceContents getEvidenceSchema() {
        return loadSchemaResource("evidence.json", "calm://schema/evidence", 
            "CALM evidence schema for compliance evidence and audit trails");
    }

    @Resource(uri = "calm://schema/flow", description = "CALM flow schema for defining business process flows and data movement patterns through architecture components")
    public TextResourceContents getFlowSchema() {
        return loadSchemaResource("flow.json", "calm://schema/flow", 
            "CALM flow schema for defining business process flows through architecture");
    }

    @Resource(uri = "calm://schema/interface", description = "CALM interface schema for defining communication endpoints, protocols, and API specifications between components")
    public TextResourceContents getInterfaceSchema() {
        return loadSchemaResource("interface.json", "calm://schema/interface", 
            "CALM interface schema for defining communication endpoints and protocols");
    }

    @Resource(uri = "calm://schema/units", description = "CALM units schema for measurement and quantification definitions including performance metrics and capacity planning")
    public TextResourceContents getUnitsSchema() {
        return loadSchemaResource("units.json", "calm://schema/units", 
            "CALM units schema for measurement and quantification definitions");
    }

    @Resource(uri = "calm://schema/release-notes", description = "CALM v1.0-rc1 release notes and changelog documenting features, changes, and migration guidance")
    public TextResourceContents getReleaseNotes() {
        return loadSchemaResource("../RELEASE_NOTES.md", "calm://schema/release-notes", 
            "CALM v" + SCHEMA_VERSION + " release notes and changelog");
    }

    @Resource(uri = "calm://schema/version-info", description = "CALM schema version information including available schemas, URLs, and usage guidance for v1.0-rc1")
    public TextResourceContents getVersionInfo() {
        String versionInfo = String.format("""
            # CALM Schema Version Information
            
            **Version:** %s
            **Schema Base URL:** https://calm.finos.org/release/%s/meta/
            **Local Schema Path:** %s
            
            ## Available Schema Files:
            
            - **core.json** - Core vocabulary (nodes, relationships, metadata)
            - **calm.json** - Main schema combining all vocabularies  
            - **control.json** - Controls and compliance definitions
            - **control-requirement.json** - Control requirements
            - **evidence.json** - Evidence and audit trail definitions
            - **flow.json** - Business process flow definitions
            - **interface.json** - Communication interface definitions
            - **units.json** - Measurement and unit definitions
            
            ## Schema URLs:
            
            All schemas are available at both:
            - Local resources: `calm://schema/{schema-name}`
            - Published URLs: `https://calm.finos.org/release/%s/meta/{schema-name}.json`
            
            ## Usage:
            
            These schemas define the structure and validation rules for CALM architecture models.
            Use them to validate CALM JSON documents and understand the available constructs.
            """, SCHEMA_VERSION, SCHEMA_VERSION, SCHEMA_BASE_PATH, SCHEMA_VERSION);
        
        return TextResourceContents.create("calm://schema/version-info", versionInfo);
    }

    @Tool(description = "The version of the schema that should be used for generating architectures")
    public TextResourceContents getSchemaUrl() {
        String schemaVersionInfo = """
                The version of the CALM Schema for creating architectures is: https://calm.finos.org/release/1.0-rc1/meta/calm.json
            """;

        return TextResourceContents.create("calm://schema/schema-url", schemaVersionInfo);
    }

    /**
     * Helper method to load schema resources from the classpath.
     * 
     * @param fileName The schema file name
     * @param uri The URI for the resource
     * @param description Description of the schema
     * @return TextResourceContents containing the schema content
     */
    private TextResourceContents loadSchemaResource(String fileName, String uri, String description) {
        String resourcePath = fileName.startsWith("../") ? 
            "/calm-schema/" + fileName.substring(3) : 
            SCHEMA_BASE_PATH + fileName;
            
        try (InputStream inputStream = getClass().getResourceAsStream(resourcePath)) {
            if (inputStream == null) {
                String errorMsg = String.format("""
                    Schema file not found: %s
                    
                    This schema should be available at: %s
                    
                    Description: %s
                    
                    The schema may be available online at:
                    https://calm.finos.org/release/%s/meta/%s
                    """, resourcePath, resourcePath, description, SCHEMA_VERSION, fileName);
                return TextResourceContents.create(uri, errorMsg);
            }
            
            String content = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
            
            // Add helpful header comment to JSON schemas
            if (fileName.endsWith(".json")) {
                String enhancedContent = String.format("""
                    /*
                     * CALM Schema: %s
                     * Version: %s
                     * Description: %s
                     * 
                     * This is a JSON Schema file that defines the structure and validation
                     * rules for CALM architecture models. Use this schema to validate
                     * your CALM JSON documents.
                     * 
                     * Online version: https://calm.finos.org/release/%s/meta/%s
                     */
                    
                    %s""", fileName, SCHEMA_VERSION, description, SCHEMA_VERSION, fileName, content);
                return TextResourceContents.create(uri, enhancedContent);
            }
            
            return TextResourceContents.create(uri, content);
        } catch (IOException e) {
            String errorMsg = String.format("""
                Error loading schema: %s
                
                Error: %s
                
                Description: %s
                
                Try accessing the online version at:
                https://calm.finos.org/release/%s/meta/%s
                """, fileName, e.getMessage(), description, SCHEMA_VERSION, fileName);
            return TextResourceContents.create(uri, errorMsg);
        }
    }
}
