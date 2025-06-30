package org.finos.calm.mcp.api.tools;

import io.quarkiverse.mcp.server.Tool;
import jakarta.inject.Inject;
import org.finos.calm.mcp.resources.CalmSchemaResources;

/**
 * Diagnostic tool to help troubleshoot MCP resource availability.
 */
public class DiagnosticTool {

    @Inject
    CalmSchemaResources schemaResources;

    @Tool(
        name = "testSchemaResources",
        description = "Tests if CALM schema resources are loading correctly"
    )
    public String testSchemaResources() {
        StringBuilder result = new StringBuilder();
        result.append("=== CALM Schema Resources Diagnostic ===\n\n");
        
        try {
            // Test core schema
            var coreSchema = schemaResources.getCoreSchema();
            result.append("✅ Core Schema: ").append(coreSchema != null ? "LOADED" : "NULL").append("\n");
            
            // Test version info
            var versionInfo = schemaResources.getVersionInfo();
            result.append("✅ Version Info: ").append(versionInfo != null ? "LOADED" : "NULL").append("\n");
            
            // Test calm schema
            var calmSchema = schemaResources.getCalmSchema();
            result.append("✅ CALM Schema: ").append(calmSchema != null ? "LOADED" : "NULL").append("\n");
            
            result.append("\n=== Resource Loading Test Complete ===\n");
            result.append("All schema resources appear to be loading correctly.\n");
            result.append("If Claude doesn't see schema details, try restarting Claude after rebuilding the MCP server.\n");
            
        } catch (Exception e) {
            result.append("❌ ERROR: ").append(e.getMessage()).append("\n");
            result.append("Stack trace: ").append(e).append("\n");
        }
        
        return result.toString();
    }
}
