package org.finos.calm.mcp.api.tools;

import io.quarkiverse.mcp.server.Tool;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * A tool for discovering what CALM is and how it works.
 */
public class CalmInfoTool {

    public static class CalmInfo {
        private final String description;

        public CalmInfo(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }

    @Tool(
            name = "getCalmInfo",
            description = "Returns an overview of CALM, including its purpose, core concepts, and benefits."
    )

    public CalmInfo getCalmInfo() {
        String desc = loadCalmOverview();
        return new CalmInfo(desc);
    }

    private String loadCalmOverview() {
        try (InputStream inputStream = getClass().getResourceAsStream("/prompts/calm-overview.md")) {
            if (inputStream == null) {
                return "CALM overview file not found. Please check the resource path.";
            }
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "Error loading CALM overview: " + e.getMessage();
        }
    }
}
