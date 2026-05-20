package integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import org.bson.Document;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.mcp.tools.ArchitectureTools;
import org.finos.calm.mcp.tools.ControlTools;
import org.finos.calm.mcp.tools.DecoratorTools;
import org.finos.calm.mcp.tools.DomainTools;
import org.finos.calm.mcp.tools.NamespaceTools;
import org.finos.calm.mcp.tools.AdrTools;
import org.finos.calm.mcp.tools.PatternTools;
import org.finos.calm.mcp.tools.SearchTools;
import org.finos.calm.mcp.tools.StandardTools;
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
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;

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

    private static final String CONTROL_REQUIREMENT_JSON = """
            {
                "control-id": "mcp-test-control",
                "name": "MCP Test Control",
                "description": "Integration test control requirement"
            }
            """;

    private static final String CONTROL_CONFIGURATION_JSON = """
            {
                "control-id": "mcp-test-control",
                "value": "enforced",
                "environment": "integration-test"
            }
            """;

    private static final String STANDARD_JSON = "{\"name\": \"mcp-test-standard\"}";

    private static final String ADR_JSON = """
            {
              "title": "Use MongoDB for persistence",
              "contextAndProblemStatement": "We need a document store",
              "decisionDrivers": ["scalability"],
              "consideredOptions": [],
              "decisionOutcome": {"chosenOption": {"name": "MongoDB"}, "rationale": "Document storage"},
              "links": []
            }
            """;

    private static int createdArchitectureId;
    private static int createdDecoratorId;
    private static int createdControlId;
    private static int createdPatternId;
    private static int createdStandardId;
    private static int createdAdrId;

    @Inject
    ArchitectureTools architectureTools;

    @Inject
    ControlTools controlTools;

    @Inject
    DecoratorTools decoratorTools;

    @Inject
    NamespaceTools namespaceTools;

    @Inject
    DomainTools domainTools;

    @Inject
    PatternTools patternTools;

    @Inject
    SearchTools searchTools;

    @Inject
    StandardTools standardTools;

    @Inject
    AdrTools adrTools;

    private static String text(ToolResponse r) {
        return ((TextContent) r.firstContent()).text();
    }

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
        ToolResponse result = namespaceTools.listNamespaces();
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("finos"));
    }

    @Test
    @Order(2)
    void mcp_create_namespace() {
        ToolResponse result = namespaceTools.createNamespace("mcp-integration", "MCP integration test namespace");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("created successfully"));
    }

    @Test
    @Order(3)
    void mcp_list_namespaces_includes_created_namespace() {
        ToolResponse result = namespaceTools.listNamespaces();
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("finos"));
        assertThat(text(result), containsString("mcp-integration"));
    }

    @Test
    @Order(4)
    void mcp_create_duplicate_namespace_returns_error() {
        ToolResponse result = namespaceTools.createNamespace("finos", "duplicate");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("already exists"));
    }

    @Test
    @Order(5)
    void mcp_list_domains_returns_seeded_domain() {
        ToolResponse result = domainTools.listDomains();
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("security"));
    }

    // --- Architecture Tools ---

    @Test
    @Order(6)
    void mcp_create_architecture() {
        ToolResponse result = architectureTools.createArchitecture("finos", "MCP Test Arch", "Integration test architecture", ARCHITECTURE_JSON);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("created successfully"));

        Matcher matcher = ID_PATTERN.matcher(text(result));
        assertThat("Response should contain architecture ID", matcher.find());
        createdArchitectureId = Integer.parseInt(matcher.group(1));
        logger.info("Created architecture with ID: {}", createdArchitectureId);
    }

    @Test
    @Order(7)
    void mcp_list_architectures_contains_created() {
        ToolResponse result = architectureTools.listArchitectures("finos");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("MCP Test Arch"));
    }

    @Test
    @Order(8)
    void mcp_list_architecture_versions() {
        ToolResponse result = architectureTools.listArchitectureVersions("finos", createdArchitectureId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
    }

    @Test
    @Order(9)
    void mcp_get_architecture() {
        ToolResponse result = architectureTools.getArchitecture("finos", createdArchitectureId, "1.0.0");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("mcp-test-architecture"));
    }

    // --- Control Tools ---

    @Test
    @Order(10)
    void mcp_list_controls_for_domain() {
        ToolResponse result = controlTools.listControls("security");
        assertThat(result.isError(), is(false));
    }

    @Test
    @Order(11)
    void mcp_get_control_not_found() {
        ToolResponse result = controlTools.getControl("security", 999, "1.0.0");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    @Order(12)
    void mcp_list_control_versions_not_found() {
        ToolResponse result = controlTools.listControlVersions("security", 999);
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    // --- Decorator Tools ---

    @Test
    @Order(13)
    void mcp_create_decorator() {
        ToolResponse result = decoratorTools.createDecorator("finos", DECORATOR_JSON);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("created successfully"));

        Matcher matcher = ID_PATTERN.matcher(text(result));
        assertThat("Response should contain decorator ID", matcher.find());
        createdDecoratorId = Integer.parseInt(matcher.group(1));
        logger.info("Created decorator with ID: {}", createdDecoratorId);
    }

    @Test
    @Order(14)
    void mcp_get_decorator() {
        ToolResponse result = decoratorTools.getDecorator("finos", createdDecoratorId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("mcp-test-decorator"));
        assertThat(text(result), containsString("deployment"));
    }

    @Test
    @Order(15)
    void mcp_list_decorators_contains_created() {
        ToolResponse result = decoratorTools.listDecorators("finos", "", "");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("mcp-test-decorator"));
    }

    @Test
    @Order(16)
    void mcp_update_decorator() {
        ToolResponse result = decoratorTools.updateDecorator("finos", createdDecoratorId, UPDATED_DECORATOR_JSON);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("updated successfully"));
    }

    @Test
    @Order(17)
    void mcp_get_decorator_after_update() {
        ToolResponse result = decoratorTools.getDecorator("finos", createdDecoratorId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("completed"));
    }

    // --- Search Tools ---

    @Test
    @Order(18)
    void mcp_search_hub() {
        ToolResponse result = searchTools.searchHub("mcp-test");
        assertThat(result.isError(), is(false));
    }

    // --- Validation ---

    @Test
    @Order(19)
    void mcp_validation_rejects_invalid_namespace() {
        ToolResponse result = architectureTools.listArchitectures("invalid namespace!");
        assertThat(result.isError(), is(true));
    }

    @Test
    @Order(20)
    void mcp_validation_rejects_invalid_version() {
        ToolResponse result = architectureTools.getArchitecture("finos", 1, "not-a-version!");
        assertThat(result.isError(), is(true));
    }

    @Test
    @Order(21)
    void mcp_validation_rejects_blank_search_query() {
        ToolResponse result = searchTools.searchHub("");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("must not be blank"));
    }

    @Test
    @Order(22)
    void mcp_architecture_not_found_for_nonexistent_namespace() {
        ToolResponse result = architectureTools.listArchitectures("nonexistent");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    @Order(23)
    void mcp_get_architecture_version_not_found() {
        ToolResponse result = architectureTools.getArchitecture("finos", createdArchitectureId, "99.99.99");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    @Order(24)
    void mcp_validation_rejects_decorator_target_filter_with_spaces() {
        ToolResponse result = decoratorTools.listDecorators("finos", "/calm/namespaces/finos architectures/1", null);
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Target filter"));
    }

    @Test
    @Order(25)
    void mcp_validation_rejects_decorator_type_filter_with_newline() {
        ToolResponse result = decoratorTools.listDecorators("finos", null, "deployment\n");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Type filter"));
    }

    // --- updateArchitecture ---

    @Test
    @Order(26)
    void mcp_update_architecture_publishes_new_version() {
        ToolResponse result = architectureTools.updateArchitecture(
                "finos", createdArchitectureId, "1.1.0", "{\"name\": \"mcp-test-architecture-updated\"}", null, null);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("updated successfully"));
        assertThat(text(result), containsString("1.1.0"));
    }

    @Test
    @Order(27)
    void mcp_list_architecture_versions_includes_updated_version() {
        ToolResponse result = architectureTools.listArchitectureVersions("finos", createdArchitectureId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("1.1.0"));
    }

    @Test
    @Order(28)
    void mcp_list_architectures_preserves_name_after_update() {
        // Regression guard: prior to this change updateArchitecture silently nulled the
        // architecture's name and description, so listArchitectures would fall back to
        // "Architecture <id>" instead of the original "MCP Test Arch".
        ToolResponse result = architectureTools.listArchitectures("finos");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("MCP Test Arch"));
        assertThat(text(result), containsString("Integration test architecture"));
    }

    @Test
    @Order(29)
    void mcp_update_architecture_returns_error_for_nonexistent_architecture() {
        ToolResponse result = architectureTools.updateArchitecture(
                "finos", 999999, "1.1.0", "{\"name\": \"ghost\"}", null, null);
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    // --- Control Tools (create paths) ---

    @Test
    @Order(30)
    void mcp_create_control_requirement() {
        ToolResponse result = controlTools.createControlRequirement(
                "security", "MCP Test Control", "Integration test control requirement", CONTROL_REQUIREMENT_JSON);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("created successfully"));

        Matcher matcher = ID_PATTERN.matcher(text(result));
        assertThat("Response should contain control ID", matcher.find());
        createdControlId = Integer.parseInt(matcher.group(1));
        logger.info("Created control with ID: {}", createdControlId);
    }

    @Test
    @Order(31)
    void mcp_list_controls_contains_created() {
        ToolResponse result = controlTools.listControls("security");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("MCP Test Control"));
    }

    @Test
    @Order(32)
    void mcp_list_control_versions_after_create() {
        ToolResponse result = controlTools.listControlVersions("security", createdControlId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
    }

    @Test
    @Order(33)
    void mcp_get_control_after_create() {
        ToolResponse result = controlTools.getControl("security", createdControlId, "1.0.0");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("mcp-test-control"));
    }

    @Test
    @Order(34)
    void mcp_create_control_configuration() {
        ToolResponse result = controlTools.createControlConfiguration(
                "security", createdControlId, CONTROL_CONFIGURATION_JSON);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("created successfully"));
    }

    @Test
    @Order(35)
    void mcp_create_control_configuration_for_missing_control_returns_error() {
        ToolResponse result = controlTools.createControlConfiguration(
                "security", 99999, CONTROL_CONFIGURATION_JSON);
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    @Order(36)
    void mcp_create_control_requirement_rejects_invalid_json() {
        ToolResponse result = controlTools.createControlRequirement(
                "security", "Bad", "desc", "not-json");
        assertThat(result.isError(), is(true));
    }

    // --- Pattern Tools ---

    @Test
    @Order(37)
    void mcp_create_pattern() {
        ToolResponse result = patternTools.createPattern("finos", "MCP Test Pattern", "Integration test pattern", "{\"name\": \"mcp-test-pattern\"}");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("created successfully"));

        Matcher matcher = ID_PATTERN.matcher(text(result));
        assertThat("Response should contain pattern ID", matcher.find());
        createdPatternId = Integer.parseInt(matcher.group(1));
        logger.info("Created pattern with ID: {}", createdPatternId);
    }

    @Test
    @Order(38)
    void mcp_list_patterns_contains_created() {
        ToolResponse result = patternTools.listPatterns("finos");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("MCP Test Pattern"));
    }

    @Test
    @Order(39)
    void mcp_list_pattern_versions() {
        ToolResponse result = patternTools.listPatternVersions("finos", createdPatternId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
    }

    @Test
    @Order(40)
    void mcp_get_pattern() {
        ToolResponse result = patternTools.getPattern("finos", createdPatternId, "1.0.0");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("mcp-test-pattern"));
    }

    @Test
    @Order(41)
    void mcp_create_pattern_version() {
        ToolResponse result = patternTools.createPatternVersion("finos", createdPatternId, "1.1.0", "{\"name\": \"mcp-test-pattern-v2\"}");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("created successfully"));
        assertThat(text(result), containsString("1.1.0"));
    }

    @Test
    @Order(42)
    void mcp_list_pattern_versions_includes_new_version() {
        ToolResponse result = patternTools.listPatternVersions("finos", createdPatternId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("1.1.0"));
    }

    @Test
    @Order(43)
    void mcp_create_pattern_version_returns_error_for_duplicate_version() {
        ToolResponse result = patternTools.createPatternVersion("finos", createdPatternId, "1.1.0", "{\"name\": \"duplicate\"}");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("already exists"));
    }

    @Test
    @Order(44)
    void mcp_update_pattern() {
        ToolResponse result = patternTools.updatePattern("finos", createdPatternId, "1.1.0", "{\"name\": \"mcp-test-pattern-updated\"}");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("updated successfully"));
    }

    @Test
    @Order(45)
    void mcp_get_pattern_after_update() {
        ToolResponse result = patternTools.getPattern("finos", createdPatternId, "1.1.0");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("mcp-test-pattern-updated"));
    }

    @Test
    @Order(46)
    void mcp_list_patterns_returns_error_for_nonexistent_namespace() {
        ToolResponse result = patternTools.listPatterns("nonexistent");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    @Order(47)
    void mcp_get_pattern_returns_error_for_nonexistent_pattern() {
        ToolResponse result = patternTools.getPattern("finos", 999999, "1.0.0");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    @Order(48)
    void mcp_create_standard() {
        ToolResponse result = standardTools.createStandard("mcp-integration", "MCP Test Standard", "Integration test standard", STANDARD_JSON);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("created successfully"));
        Matcher matcher = ID_PATTERN.matcher(text(result));
        assertThat(matcher.find(), is(true));
        createdStandardId = Integer.parseInt(matcher.group(1));
        logger.info("Created standard with ID: {}", createdStandardId);
    }

    @Test
    @Order(49)
    void mcp_list_standards_contains_created() {
        ToolResponse result = standardTools.listStandards("mcp-integration");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("MCP Test Standard"));
    }

    @Test
    @Order(50)
    void mcp_list_standard_versions() {
        ToolResponse result = standardTools.listStandardVersions("mcp-integration", createdStandardId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
    }

    @Test
    @Order(51)
    void mcp_get_standard() {
        ToolResponse result = standardTools.getStandard("mcp-integration", createdStandardId, "1.0.0");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("mcp-test-standard"));
    }

    @Test
    @Order(52)
    void mcp_create_standard_new_version() {
        ToolResponse result = standardTools.createStandardVersion("mcp-integration", createdStandardId, "1.1.0", "{\"name\": \"mcp-test-standard-v2\"}");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("created successfully"));
        assertThat(text(result), containsString("1.1.0"));
    }

    @Test
    @Order(53)
    void mcp_standard_version_preserves_name() {
        ToolResponse result = standardTools.listStandards("mcp-integration");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("MCP Test Standard"));
    }

    @Test
    @Order(54)
    void mcp_list_standard_versions_after_new_version() {
        ToolResponse result = standardTools.listStandardVersions("mcp-integration", createdStandardId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.1.0"));
    }

    @Test
    @Order(55)
    void mcp_create_duplicate_standard_version_returns_error() {
        ToolResponse result = standardTools.createStandardVersion("mcp-integration", createdStandardId, "1.1.0", "{\"name\": \"duplicate\"}");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("already exists"));
    }

    @Test
    @Order(56)
    void mcp_list_standards_for_nonexistent_namespace_returns_error() {
        ToolResponse result = standardTools.listStandards("nonexistent");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    @Order(57)
    void mcp_create_adr() {
        ToolResponse result = adrTools.createAdr("finos", ADR_JSON);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("created successfully"));
        Matcher matcher = ID_PATTERN.matcher(text(result));
        assertThat(matcher.find(), is(true));
        createdAdrId = Integer.parseInt(matcher.group(1));
        logger.info("Created ADR with ID: {}", createdAdrId);
    }

    @Test
    @Order(58)
    void mcp_list_adrs_contains_created() {
        ToolResponse result = adrTools.listAdrs("finos");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("Use MongoDB for persistence"));
    }

    @Test
    @Order(59)
    void mcp_get_adr() {
        ToolResponse result = adrTools.getAdr("finos", createdAdrId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("MongoDB"));
    }

    @Test
    @Order(60)
    void mcp_list_adr_revisions() {
        ToolResponse result = adrTools.listAdrRevisions("finos", createdAdrId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1"));
    }

    @Test
    @Order(61)
    void mcp_get_adr_revision() {
        ToolResponse result = adrTools.getAdrRevision("finos", createdAdrId, 1);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("MongoDB"));
    }

    @Test
    @Order(62)
    void mcp_update_adr_creates_new_revision() {
        ToolResponse result = adrTools.updateAdr("finos", createdAdrId, ADR_JSON);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("revision 2"));
    }

    @Test
    @Order(63)
    void mcp_list_adr_revisions_after_update() {
        ToolResponse result = adrTools.listAdrRevisions("finos", createdAdrId);
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("2"));
    }

    @Test
    @Order(64)
    void mcp_update_adr_status() {
        ToolResponse result = adrTools.updateAdrStatus("finos", createdAdrId, "accepted");
        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("accepted"));
    }

    @Test
    @Order(65)
    void mcp_list_adrs_for_nonexistent_namespace_returns_error() {
        ToolResponse result = adrTools.listAdrs("nonexistent");
        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }
}
