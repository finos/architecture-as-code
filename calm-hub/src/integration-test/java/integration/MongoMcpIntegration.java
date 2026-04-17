package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.mcp.tools.ArchitectureTools;
import org.finos.calm.mcp.tools.ControlTools;
import org.finos.calm.mcp.tools.DecoratorTools;
import org.finos.calm.mcp.tools.FlowTools;
import org.finos.calm.mcp.tools.NamespaceTools;
import org.finos.calm.mcp.tools.SearchTools;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MongoMcpIntegration {

    private static final Logger logger = LoggerFactory.getLogger(MongoMcpIntegration.class);

    private static final Pattern ID_PATTERN = Pattern.compile("ID: (\\d+)");

    private static final String ARCHITECTURE_JSON = "{\"name\": \"mcp-test-architecture\"}";

    private static final String DECORATOR_JSON = """
            {
                "unique-id": "mcp-test-decorator",
                "type": "deployment",
                "target": ["/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "target-type": ["architecture"],
                "applies-to": ["mcp-test-node"],
                "data": {"status": "deployed", "environment": "integration-test"}
            }
            """;

    private static final String UPDATED_DECORATOR_JSON = """
            {
                "unique-id": "mcp-test-decorator",
                "type": "deployment",
                "target": ["/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "target-type": ["architecture"],
                "applies-to": ["mcp-test-node"],
                "data": {"status": "completed", "environment": "integration-test"}
            }
            """;

    private static int createdArchitectureId;
    private static int createdDecoratorId;

    @Inject
    ArchitectureTools architectureTools;

    @Inject
    ControlTools controlTools;

    @Inject
    DecoratorTools decoratorTools;

    @Inject
    FlowTools flowTools;

    @Inject
    NamespaceTools namespaceTools;

    @Inject
    SearchTools searchTools;

    @BeforeEach
    public void setup() {
        String mongoUri = ConfigProvider.getConfig().getValue("quarkus.mongodb.connection-string", String.class);
        String mongoDatabase = ConfigProvider.getConfig().getValue("quarkus.mongodb.database", String.class);

        if (mongoUri == null || mongoUri.isBlank()) {
            logger.error("MongoDB URI is not set. Check the EndToEndResource configuration.");
            throw new IllegalStateException("MongoDB URI is not set. Check the EndToEndResource configuration.");
        }

        try (MongoClient mongoClient = MongoClients.create(mongoUri)) {
            MongoDatabase database = mongoClient.getDatabase(mongoDatabase);

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("architectures")) {
                database.createCollection("architectures");
                database.getCollection("architectures").insertOne(
                        new Document("namespace", "finos").append("architectures", new ArrayList<>())
                );
            }

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("decorators")) {
                database.createCollection("decorators");
                database.getCollection("decorators").insertOne(
                        new Document("namespace", "finos").append("decorators", new ArrayList<>())
                );
            }

            if (!database.listCollectionNames().into(new ArrayList<>()).contains("flows")) {
                database.createCollection("flows");
                database.getCollection("flows").insertOne(
                        new Document("namespace", "finos").append("flows", new ArrayList<>())
                );
            }

            MongoSetup.counterSetup(database);
            MongoSetup.namespaceSetup(database);
            MongoSetup.domainSetup(database);
        }
    }

    // --- Namespace Tools ---

    @Test
    @Order(1)
    void mcp_list_namespaces_returns_seeded_namespace() {
        String result = namespaceTools.listNamespaces();
        assertThat(result, containsString("finos"));
    }

    @Test
    @Order(2)
    void mcp_create_namespace() {
        String result = namespaceTools.createNamespace("mcp-integration", "MCP integration test namespace");
        assertThat(result, containsString("created successfully"));
    }

    @Test
    @Order(3)
    void mcp_list_namespaces_includes_created_namespace() {
        String result = namespaceTools.listNamespaces();
        assertThat(result, containsString("finos"));
        assertThat(result, containsString("mcp-integration"));
    }

    @Test
    @Order(4)
    void mcp_create_duplicate_namespace_returns_error() {
        String result = namespaceTools.createNamespace("finos", "duplicate");
        assertThat(result, containsString("already exists"));
    }

    @Test
    @Order(5)
    void mcp_list_domains_returns_seeded_domain() {
        String result = namespaceTools.listDomains();
        assertThat(result, containsString("security"));
    }

    // --- Architecture Tools ---

    @Test
    @Order(6)
    void mcp_create_architecture() {
        String result = architectureTools.createArchitecture("finos", "MCP Test Arch", "Integration test architecture", ARCHITECTURE_JSON);
        assertThat(result, containsString("created successfully"));

        Matcher matcher = ID_PATTERN.matcher(result);
        assertThat("Response should contain architecture ID", matcher.find());
        createdArchitectureId = Integer.parseInt(matcher.group(1));
        logger.info("Created architecture with ID: {}", createdArchitectureId);
    }

    @Test
    @Order(7)
    void mcp_list_architectures_contains_created() {
        String result = architectureTools.listArchitectures("finos");
        assertThat(result, containsString("MCP Test Arch"));
    }

    @Test
    @Order(8)
    void mcp_list_architecture_versions() {
        String result = architectureTools.listArchitectureVersions("finos", createdArchitectureId);
        assertThat(result, containsString("1.0.0"));
    }

    @Test
    @Order(9)
    void mcp_get_architecture() {
        String result = architectureTools.getArchitecture("finos", createdArchitectureId, "1.0.0");
        assertThat(result, containsString("mcp-test-architecture"));
    }

    // --- Control Tools ---

    @Test
    @Order(10)
    void mcp_list_controls_for_domain() {
        String result = controlTools.listControls("security");
        assertThat(result, not(startsWith("Error:")));
    }

    // --- Decorator Tools ---

    @Test
    @Order(11)
    void mcp_create_decorator() {
        String result = decoratorTools.createDecorator("finos", DECORATOR_JSON);
        assertThat(result, containsString("created successfully"));

        Matcher matcher = ID_PATTERN.matcher(result);
        assertThat("Response should contain decorator ID", matcher.find());
        createdDecoratorId = Integer.parseInt(matcher.group(1));
        logger.info("Created decorator with ID: {}", createdDecoratorId);
    }

    @Test
    @Order(12)
    void mcp_get_decorator() {
        String result = decoratorTools.getDecorator("finos", createdDecoratorId);
        assertThat(result, containsString("mcp-test-decorator"));
        assertThat(result, containsString("deployment"));
    }

    @Test
    @Order(13)
    void mcp_list_decorators_contains_created() {
        String result = decoratorTools.listDecorators("finos", "", "");
        assertThat(result, containsString("mcp-test-decorator"));
    }

    @Test
    @Order(14)
    void mcp_update_decorator() {
        String result = decoratorTools.updateDecorator("finos", createdDecoratorId, UPDATED_DECORATOR_JSON);
        assertThat(result, containsString("updated successfully"));
    }

    @Test
    @Order(15)
    void mcp_get_decorator_after_update() {
        String result = decoratorTools.getDecorator("finos", createdDecoratorId);
        assertThat(result, containsString("completed"));
    }

    // --- Flow Tools ---

    @Test
    @Order(16)
    void mcp_list_flows() {
        String result = flowTools.listFlows("finos");
        assertThat(result, not(startsWith("Error:")));
    }

    // --- Search Tools ---

    @Test
    @Order(17)
    void mcp_search_hub() {
        String result = searchTools.searchHub("mcp-test");
        assertThat(result, not(startsWith("Error:")));
    }

    // --- Validation ---

    @Test
    @Order(18)
    void mcp_validation_rejects_invalid_namespace() {
        String result = architectureTools.listArchitectures("invalid namespace!");
        assertThat(result, startsWith("Error:"));
    }

    @Test
    @Order(19)
    void mcp_validation_rejects_invalid_version() {
        String result = architectureTools.getArchitecture("finos", 1, "not-a-version!");
        assertThat(result, startsWith("Error:"));
    }

    @Test
    @Order(20)
    void mcp_validation_rejects_blank_search_query() {
        String result = searchTools.searchHub("");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("must not be blank"));
    }

    @Test
    @Order(21)
    void mcp_architecture_not_found_for_nonexistent_namespace() {
        String result = architectureTools.listArchitectures("nonexistent");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("not found"));
    }

    @Test
    @Order(22)
    void mcp_get_architecture_version_not_found() {
        String result = architectureTools.getArchitecture("finos", createdArchitectureId, "99.99.99");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("not found"));
    }
}
