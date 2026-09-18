package org.finos.calm.config;

import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.LayoutStore;
import org.finos.calm.store.NamespaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Seeds a demo namespace, architecture, and layout on first startup in standalone mode,
 * so the Hub has something to render immediately without running init-nitrite.sh.
 * Only runs when the database is empty (no namespaces exist yet).
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class StandaloneDemoSeeder {

    private static final Logger LOG = LoggerFactory.getLogger(StandaloneDemoSeeder.class);

    @Inject
    NamespaceStore namespaceStore;

    @Inject
    ArchitectureStore architectureStore;

    @Inject
    LayoutStore layoutStore;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @ConfigProperty(name = "calm.standalone.seed-demo-data", defaultValue = "false")
    boolean seedDemoEnabled;

    void onStart(@Observes StartupEvent ev) {
        if (!"standalone".equals(databaseMode)) {
            return;
        }

        if (!seedDemoEnabled) {
            LOG.info("Demo data seeding disabled (calm.standalone.seed-demo-data=false) — skipping demo seed");
            return;
        }

        try {
            if (!namespaceStore.getNamespaces().isEmpty()) {
                LOG.info("Database already has data — skipping demo seed");
                return;
            }
        } catch (Exception e) {
            LOG.warn("Could not check existing namespaces — skipping demo seed", e);
            return;
        }

        LOG.info("Empty database detected — seeding demo data with layout");
        seedDemoData();
    }

    private void seedDemoData() {
        try {
            namespaceStore.createNamespace("demo", "Demo namespace with a seeded layout");

            String architectureJson = """
                {
                    "nodes": [
                        {
                            "unique-id": "web-app",
                            "node-type": "service",
                            "name": "Web Application",
                            "description": "Frontend web application serving user requests"
                        },
                        {
                            "unique-id": "api-gateway",
                            "node-type": "service",
                            "name": "API Gateway",
                            "description": "Routes and authenticates API requests"
                        },
                        {
                            "unique-id": "user-service",
                            "node-type": "service",
                            "name": "User Service",
                            "description": "Manages user accounts and authentication"
                        },
                        {
                            "unique-id": "order-service",
                            "node-type": "service",
                            "name": "Order Service",
                            "description": "Processes and manages orders"
                        },
                        {
                            "unique-id": "database",
                            "node-type": "database",
                            "name": "PostgreSQL",
                            "description": "Primary relational data store"
                        },
                        {
                            "unique-id": "message-queue",
                            "node-type": "service",
                            "name": "Message Queue",
                            "description": "Async event bus for inter-service communication"
                        }
                    ],
                    "relationships": [
                        {
                            "unique-id": "web-to-gateway",
                            "relationship-type": { "connects": { "source": { "node": "web-app" }, "destination": { "node": "api-gateway" } } },
                            "protocol": "HTTPS"
                        },
                        {
                            "unique-id": "gateway-to-user",
                            "relationship-type": { "connects": { "source": { "node": "api-gateway" }, "destination": { "node": "user-service" } } },
                            "protocol": "HTTPS"
                        },
                        {
                            "unique-id": "gateway-to-order",
                            "relationship-type": { "connects": { "source": { "node": "api-gateway" }, "destination": { "node": "order-service" } } },
                            "protocol": "HTTPS"
                        },
                        {
                            "unique-id": "user-to-db",
                            "relationship-type": { "connects": { "source": { "node": "user-service" }, "destination": { "node": "database" } } },
                            "protocol": "JDBC"
                        },
                        {
                            "unique-id": "order-to-db",
                            "relationship-type": { "connects": { "source": { "node": "order-service" }, "destination": { "node": "database" } } },
                            "protocol": "JDBC"
                        },
                        {
                            "unique-id": "order-to-queue",
                            "relationship-type": { "connects": { "source": { "node": "order-service" }, "destination": { "node": "message-queue" } } },
                            "protocol": "AMQP"
                        }
                    ],
                    "metadata": {
                        "_layout": {
                            "web-app":       { "x": 350, "y": 30,  "w": 200, "h": 60 },
                            "api-gateway":   { "x": 350, "y": 150, "w": 180, "h": 55 },
                            "user-service":  { "x": 150, "y": 300, "w": 180, "h": 55 },
                            "order-service": { "x": 550, "y": 300, "w": 180, "h": 55 },
                            "database":      { "x": 350, "y": 450, "w": 170, "h": 60 },
                            "message-queue": { "x": 700, "y": 450, "w": 180, "h": 55 }
                        }
                    }
                }
                """;

            Architecture architecture = new Architecture.ArchitectureBuilder()
                    .setNamespace("demo")
                    .setName("Microservices Demo")
                    .setDescription("A demo microservices architecture with a pre-seeded layout")
                    .setVersion("1.0.0")
                    .setArchitecture(architectureJson)
                    .build();

            Architecture created = architectureStore.createArchitectureForNamespace(architecture);
            int archId = created.getId();
            LOG.info("Seeded demo architecture (id={})", archId);

            String layoutJson = """
                {
                    "for": "/api/calm/namespaces/demo/architectures/%d",
                    "name": "Default",
                    "description": "Pre-seeded layout demonstrating width/height persistence",
                    "nodes": {
                        "web-app":       { "x": 350, "y": 30,  "w": 200, "h": 60 },
                        "api-gateway":   { "x": 350, "y": 150, "w": 180, "h": 55 },
                        "user-service":  { "x": 150, "y": 300, "w": 180, "h": 55 },
                        "order-service": { "x": 550, "y": 300, "w": 180, "h": 55 },
                        "database":      { "x": 350, "y": 450, "w": 170, "h": 60 },
                        "message-queue": { "x": 700, "y": 450, "w": 180, "h": 55 }
                    }
                }
                """.formatted(archId);

            layoutStore.upsertLayout("demo", archId, layoutJson);
            LOG.info("Seeded default layout for demo architecture");

        } catch (NamespaceNotFoundException e) {
            LOG.error("Failed to seed demo data — namespace not found after creation", e);
        } catch (Exception e) {
            LOG.error("Failed to seed demo data", e);
        }
    }
}
