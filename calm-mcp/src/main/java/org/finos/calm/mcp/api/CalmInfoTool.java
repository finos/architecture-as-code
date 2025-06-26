package org.finos.calm.mcp.api;


import io.quarkiverse.mcp.server.Tool;

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
        String desc = """
            CALM (Common Architecture Language Model) is an open‑source specification developed by the Architecture as Code community under FINOS. \
            It enables software architects to define, validate, and visualize system architectures in a standardized, machine‑readable format, \
            bridging the gap between architectural intent and implementation.

            Developed to move architecture beyond static diagrams, CALM provides a common JSON meta‑schema for modeling nodes (services, databases, people), \
            relationships (interacts‑with, connects‑to, deployed‑in), and metadata. By treating architecture as code, CALM enables automation, version control, \
            consistency, compliance checks, and real‑time visualization in CI/CD pipelines.
            """;
        return new CalmInfo(desc);
    }
}
