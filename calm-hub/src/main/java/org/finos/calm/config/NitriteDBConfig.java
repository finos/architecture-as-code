package org.finos.calm.config;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.bson.json.JsonParseException;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.mvstore.MVStoreModule;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Configuration for standalone mode using NitriteDB.
 * This class manages the lifecycle of the NitriteDB instance.
 */
@ApplicationScoped
public class NitriteDBConfig {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteDBConfig.class);

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @ConfigProperty(name = "calm.standalone.data-directory")
    String dataDirectory;

    @ConfigProperty(name = "calm.standalone.database-name", defaultValue = "calmSchemas")
    String databaseName;

    @ConfigProperty(name = "calm.standalone.username", defaultValue = "admin")
    String username;

    @ConfigProperty(name = "calm.standalone.password", defaultValue = "admin")
    String password;

    @ConfigProperty(name = "calm.standalone.init-script-path")
    String initScriptPath;

    private Nitrite db;

    @PostConstruct
    void initialize() {
        if ("standalone".equals(databaseMode)) {
            LOG.info("Starting NitriteDB in standalone mode");
            try {
                // Ensure data directory exists
                Path dataPath = Paths.get(dataDirectory);
                if (!Files.exists(dataPath)) {
                    Files.createDirectories(dataPath);
                }

                // Configure and open NitriteDB
                Path dbFilePath = dataPath.resolve(databaseName + ".db");

                // Create the database
                // Create the MVStoreModule with the file path
                MVStoreModule storeModule = MVStoreModule.withConfig()
                        .filePath(dbFilePath.toString())
                        .autoCommit(true)
                        .build();

                db = Nitrite.builder()
                        .loadModule(storeModule)
                        .openOrCreate(username, password);

                // Force initialization to ensure data is created
                try {
                    initializeDatabase();
                } catch (Exception e) {
                    LOG.error("Failed to initialize NitriteDB", e);
                    // Continue even if initialization fails
                }

                LOG.info("NitriteDB started successfully at {}", dbFilePath);
            } catch (IOException e) {
                LOG.error("Failed to start NitriteDB", e);
                throw new RuntimeException("Failed to start NitriteDB", e);
            }
        }
    }

    @PreDestroy
    void shutdown() {
        if (db != null && !db.isClosed()) {
            db.close();
            LOG.info("NitriteDB stopped");
        }
    }

    /**
     * Get the underlying NitriteDB instance.
     */
    @Produces
    @ApplicationScoped
    @StandaloneQualifier
    public Nitrite getNitriteDb() {
        return db;
    }

    /**
     * Checks if the database needs initialization.
     *
     * @return true if the database needs initialization, false otherwise
     */
    private boolean needsInitialization() {
        // Check if any collections exist
        return db.listCollectionNames().isEmpty();
    }

    /**
     * Initializes the database with data from the initialization script.
     *
     * @throws IOException if the initialization script cannot be read
     * @throws JsonParseException if the initialization script contains invalid JSON
     */

    /**
     * Extracts JSON content from a MongoDB script based on specific markers.
     *
     * @param scriptContent   The content of the MongoDB script
     * @param namespaceMarker The marker for the namespace section
     * @param versionMarker   The marker for the version section
     * @param endMarker       The marker for the end of the JSON content
     * @return The extracted JSON content, or null if not found
     */
    private String extractJsonFromScript(String scriptContent, String namespaceMarker, String versionMarker, String endMarker) {
        try {
            // Find the namespace section
            int namespaceIndex = scriptContent.indexOf(namespaceMarker);
            if (namespaceIndex == -1) {
                return null;
            }

            // Find the version section within the namespace section
            int versionIndex = scriptContent.indexOf(versionMarker, namespaceIndex);
            if (versionIndex == -1) {
                return null;
            }

            // Skip past the version marker to get to the JSON content
            int jsonStartIndex = versionIndex + versionMarker.length();

            // Find the end of the JSON content
            int jsonEndIndex = -1;
            int braceCount = 0;
            boolean inString = false;
            boolean escaped = false;

            for (int i = jsonStartIndex; i < scriptContent.length(); i++) {
                char c = scriptContent.charAt(i);

                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (c == '\\') {
                    escaped = true;
                    continue;
                }

                if (c == '"') {
                    inString = !inString;
                    continue;
                }

                if (!inString) {
                    if (c == '{') {
                        braceCount++;
                    } else if (c == '}') {
                        braceCount--;
                        if (braceCount == 0) {
                            jsonEndIndex = i + 1;
                            break;
                        }
                    }
                }
            }

            if (jsonEndIndex == -1) {
                return null;
            }

            // Extract the JSON content
            String jsonContent = scriptContent.substring(jsonStartIndex, jsonEndIndex);

            // Clean up the JSON content (remove leading/trailing whitespace, etc.)
            jsonContent = jsonContent.trim();

            return jsonContent;
        } catch (Exception e) {
            LOG.error("Failed to extract JSON from script: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extracts namespace values from a MongoDB script.
     *
     * @param scriptContent The content of the MongoDB script
     * @return A list of namespace values, or null if not found
     */
    private List<String> extractNamespacesFromScript(String scriptContent) {
        try {
            // Find the namespaces section
            String namespaceMarker = "db.namespaces.insertMany([";
            int namespaceIndex = scriptContent.indexOf(namespaceMarker);
            if (namespaceIndex == -1) {
                return null;
            }

            // Skip past the marker to get to the array content
            int arrayStartIndex = namespaceIndex + namespaceMarker.length();

            // Find the end of the array
            int arrayEndIndex = scriptContent.indexOf("]);", arrayStartIndex);
            if (arrayEndIndex == -1) {
                return null;
            }

            // Extract the array content
            String arrayContent = scriptContent.substring(arrayStartIndex, arrayEndIndex).trim();

            // Parse the array content to extract namespace values
            List<String> namespaces = new ArrayList<>();
            // Simple regex to match { namespace: "value" } patterns
            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("\\{\\s*namespace:\\s*\"([^\"]+)\"\\s*\\}");
            java.util.regex.Matcher matcher = pattern.matcher(arrayContent);

            while (matcher.find()) {
                namespaces.add(matcher.group(1));
            }

            if (namespaces.isEmpty()) {
                LOG.warn("No namespaces found in script");
                return null;
            }

            LOG.info("Extracted {} namespaces from script: {}", namespaces.size(), String.join(", ", namespaces));
            return namespaces;
        } catch (Exception e) {
            LOG.error("Failed to extract namespaces from script: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extracts pattern documents from a MongoDB script.
     *
     * @param scriptContent The content of the MongoDB script
     * @return A list of pattern documents, or null if not found
     */
    private List<Document> extractPatternsFromScript(String scriptContent) {
        try {
            // Find the patterns section
            String patternsMarker = "db.patterns.insertMany([";
            int patternsIndex = scriptContent.indexOf(patternsMarker);
            if (patternsIndex == -1) {
                LOG.warn("Patterns marker not found in script");
                return null;
            }

            // Skip past the marker to get to the array content
            int arrayStartIndex = patternsIndex + patternsMarker.length();

            // Find the end of the array
            int arrayEndIndex = scriptContent.indexOf("]);", arrayStartIndex);
            if (arrayEndIndex == -1) {
                LOG.warn("End of patterns array not found in script");
                return null;
            }

            // Extract the array content
            String arrayContent = scriptContent.substring(arrayStartIndex, arrayEndIndex).trim();

            // Parse the array content to extract pattern documents
            List<Document> patternDocuments = new ArrayList<>();

            // Split the content by namespace sections
            // This is a simplified approach - in a real-world scenario, you might want to use a more robust parser
            String[] namespaceSections = arrayContent.split("\\{\\s*namespace:\\s*\"");

            for (int i = 1; i < namespaceSections.length; i++) { // Start from 1 to skip the empty first element
                String section = namespaceSections[i];

                // Extract namespace
                int namespaceEndIndex = section.indexOf("\"");

                String namespace = section.substring(0, namespaceEndIndex);

                // Extract pattern JSON
                int versionsIndex = section.indexOf("\"1-0-0\":");

                // Find the opening brace of the JSON object
                int jsonStartIndex = section.indexOf("{", versionsIndex);

                // Find the closing brace of the JSON object
                // This is tricky because we need to account for nested braces
                int jsonEndIndex = -1;
                int braceCount = 1;
                boolean inString = false;
                boolean escaped = false;

                for (int j = jsonStartIndex + 1; j < section.length(); j++) {
                    char c = section.charAt(j);

                    if (escaped) {
                        escaped = false;
                        continue;
                    }

                    if (c == '\\') {
                        escaped = true;
                        continue;
                    }

                    if (c == '"') {
                        inString = !inString;
                        continue;
                    }

                    if (!inString) {
                        if (c == '{') {
                            braceCount++;
                        } else if (c == '}') {
                            braceCount--;
                            if (braceCount == 0) {
                                jsonEndIndex = j + 1;
                                break;
                            }
                        }
                    }
                }

                if (jsonEndIndex == -1) continue;

                // Extract the JSON content
                String patternJson = section.substring(jsonStartIndex, jsonEndIndex);

                // Create a pattern document
                Document patternDoc = Document.createDocument()
                        .put("namespace", namespace)
                        .put("patterns", List.of(
                                Document.createDocument()
                                        .put("patternId", 1)
                                        .put("versions", Document.createDocument()
                                                .put("1-0-0", patternJson)
                                        )
                        ));

                patternDocuments.add(patternDoc);
                LOG.info("Extracted pattern for namespace: {}", namespace);
            }

            if (patternDocuments.isEmpty()) {
                LOG.warn("No patterns found in script");
                return null;
            }

            LOG.info("Extracted {} pattern documents from script", patternDocuments.size());
            return patternDocuments;
        } catch (Exception e) {
            LOG.error("Failed to extract patterns from script: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extracts architecture documents from a MongoDB script.
     *
     * @param scriptContent The content of the MongoDB script
     * @return A list of architecture documents, or null if not found
     */
    private List<Document> extractArchitecturesFromScript(String scriptContent) {
        try {
            // Find the architectures section
            String architecturesMarker = "db.architectures.insertMany([";
            int architecturesIndex = scriptContent.indexOf(architecturesMarker);
            if (architecturesIndex == -1) {
                LOG.warn("Architectures marker not found in script");
                return null;
            }

            // Skip past the marker to get to the array content
            int arrayStartIndex = architecturesIndex + architecturesMarker.length();

            // Find the end of the array
            int arrayEndIndex = scriptContent.indexOf("]);", arrayStartIndex);
            if (arrayEndIndex == -1) {
                LOG.warn("End of architectures array not found in script");
                return null;
            }

            // Extract the array content
            String arrayContent = scriptContent.substring(arrayStartIndex, arrayEndIndex).trim();

            // Parse the array content to extract architecture documents
            List<Document> architectureDocuments = new ArrayList<>();

            // Split the content by namespace sections
            // This is a simplified approach - in a real-world scenario, you might want to use a more robust parser
            String[] namespaceSections = arrayContent.split("\\{\\s*namespace:\\s*\"");

            for (int i = 1; i < namespaceSections.length; i++) { // Start from 1 to skip the empty first element
                String section = namespaceSections[i];

                // Extract namespace
                int namespaceEndIndex = section.indexOf("\"");

                String namespace = section.substring(0, namespaceEndIndex);

                // Extract architecture JSON
                int versionsIndex = section.indexOf("\"1-0-0\":");

                // Find the opening brace of the JSON object
                int jsonStartIndex = section.indexOf("{", versionsIndex);

                // Find the closing brace of the JSON object
                // This is tricky because we need to account for nested braces
                int jsonEndIndex = -1;
                int braceCount = 1;
                boolean inString = false;
                boolean escaped = false;

                for (int j = jsonStartIndex + 1; j < section.length(); j++) {
                    char c = section.charAt(j);

                    if (escaped) {
                        escaped = false;
                        continue;
                    }

                    if (c == '\\') {
                        escaped = true;
                        continue;
                    }

                    if (c == '"') {
                        inString = !inString;
                        continue;
                    }

                    if (!inString) {
                        if (c == '{') {
                            braceCount++;
                        } else if (c == '}') {
                            braceCount--;
                            if (braceCount == 0) {
                                jsonEndIndex = j + 1;
                                break;
                            }
                        }
                    }
                }

                if (jsonEndIndex == -1) continue;

                // Extract the JSON content
                String architectureJson = section.substring(jsonStartIndex, jsonEndIndex);

                // Create an architecture document
                Document architectureDoc = Document.createDocument()
                        .put("namespace", namespace)
                        .put("architectures", List.of(
                                Document.createDocument()
                                        .put("architectureId", 1)
                                        .put("versions", Document.createDocument()
                                                .put("1-0-0", architectureJson)
                                        )
                        ));

                architectureDocuments.add(architectureDoc);
                LOG.info("Extracted architecture for namespace: {}", namespace);
            }

            if (architectureDocuments.isEmpty()) {
                LOG.warn("No architectures found in script");
                return null;
            }

            LOG.info("Extracted {} architecture documents from script", architectureDocuments.size());
            return architectureDocuments;
        } catch (Exception e) {
            LOG.error("Failed to extract architectures from script: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extracts flow documents from a MongoDB script.
     *
     * @param scriptContent The content of the MongoDB script
     * @return A list of flow documents, or null if not found
     */
    private List<Document> extractFlowsFromScript(String scriptContent) {
        try {
            // Find the flows section
            String flowsMarker = "db.flows.insertMany([";
            int flowsIndex = scriptContent.indexOf(flowsMarker);
            if (flowsIndex == -1) {
                LOG.warn("Flows marker not found in script");
                return null;
            }

            // Skip past the marker to get to the array content
            int arrayStartIndex = flowsIndex + flowsMarker.length();

            // Find the end of the array
            int arrayEndIndex = scriptContent.indexOf("]);", arrayStartIndex);
            if (arrayEndIndex == -1) {
                LOG.warn("End of flows array not found in script");
                return null;
            }

            // Extract the array content
            String arrayContent = scriptContent.substring(arrayStartIndex, arrayEndIndex).trim();

            // Parse the array content to extract flow documents
            List<Document> flowDocuments = new ArrayList<>();

            // Split the content by namespace sections
            // This is a simplified approach - in a real-world scenario, you might want to use a more robust parser
            String[] namespaceSections = arrayContent.split("\\{\\s*namespace:\\s*\"");

            for (int i = 1; i < namespaceSections.length; i++) { // Start from 1 to skip the empty first element
                String section = namespaceSections[i];

                // Extract namespace
                int namespaceEndIndex = section.indexOf("\"");

                String namespace = section.substring(0, namespaceEndIndex);

                // Extract flows array
                int flowsArrayStartIndex = section.indexOf("flows: [");

                // Find the end of the flows array
                int flowsArrayEndIndex = -1;
                int bracketCount = 1;
                boolean inString = false;
                boolean escaped = false;

                for (int j = flowsArrayStartIndex + 8; j < section.length(); j++) {
                    char c = section.charAt(j);

                    if (escaped) {
                        escaped = false;
                        continue;
                    }

                    if (c == '\\') {
                        escaped = true;
                        continue;
                    }

                    if (c == '"') {
                        inString = !inString;
                        continue;
                    }

                    if (!inString) {
                        if (c == '[') {
                            bracketCount++;
                        } else if (c == ']') {
                            bracketCount--;
                            if (bracketCount == 0) {
                                flowsArrayEndIndex = j + 1;
                                break;
                            }
                        }
                    }
                }

                if (flowsArrayEndIndex == -1) continue;

                // Extract the flows array content
                String flowsArrayContent = section.substring(flowsArrayStartIndex + 8, flowsArrayEndIndex);

                // Create a flow document for this namespace
                Document flowDoc = Document.createDocument()
                        .put("namespace", namespace)
                        .put("flows", new ArrayList<>());

                // Parse individual flows
                String[] flowSections = flowsArrayContent.split("\\{\\s*flowId:\\s*NumberInt\\(");

                for (int j = 1; j < flowSections.length; j++) { // Start from 1 to skip the empty first element
                    String flowSection = flowSections[j];

                    // Extract flow ID
                    int flowIdEndIndex = flowSection.indexOf(")");

                    int flowId = Integer.parseInt(flowSection.substring(0, flowIdEndIndex).trim());

                    // Extract versions
                    int versionsIndex = flowSection.indexOf("\"1-0-0\":");

                    // Find the opening brace of the JSON object
                    int jsonStartIndex = flowSection.indexOf("{", versionsIndex);

                    // Find the closing brace of the JSON object
                    int jsonEndIndex = -1;
                    int braceCount = 1;
                    inString = false;
                    escaped = false;

                    for (int k = jsonStartIndex + 1; k < flowSection.length(); k++) {
                        char c = flowSection.charAt(k);

                        if (escaped) {
                            escaped = false;
                            continue;
                        }

                        if (c == '\\') {
                            escaped = true;
                            continue;
                        }

                        if (c == '"') {
                            inString = !inString;
                            continue;
                        }

                        if (!inString) {
                            if (c == '{') {
                                braceCount++;
                            } else if (c == '}') {
                                braceCount--;
                                if (braceCount == 0) {
                                    jsonEndIndex = k + 1;
                                    break;
                                }
                            }
                        }
                    }

                    // Extract the JSON content
                    String flowJson = flowSection.substring(jsonStartIndex, jsonEndIndex);

                    // Add this flow to the flows list
                    List<Document> flows = (List<Document>) flowDoc.get("flows");
                    flows.add(Document.createDocument()
                            .put("flowId", flowId)
                            .put("versions", Document.createDocument()
                                    .put("1-0-0", flowJson)
                            )
                    );
                }

                // Only add the document if it has flows
                List<Document> flows = (List<Document>) flowDoc.get("flows");
                if (!flows.isEmpty()) {
                    flowDocuments.add(flowDoc);
                    LOG.info("Extracted {} flows for namespace: {}", flows.size(), namespace);
                }
            }

            if (flowDocuments.isEmpty()) {
                LOG.warn("No flows found in script");
                return null;
            }

            LOG.info("Extracted {} flow documents from script", flowDocuments.size());
            return flowDocuments;
        } catch (Exception e) {
            LOG.error("Failed to extract flows from script: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extracts schema documents from a MongoDB script.
     *
     * @param scriptContent The content of the MongoDB script
     * @return A list of schema documents, or null if not found
     */
    private List<Document> extractSchemasFromScript(String scriptContent) {
        try {
            // Find the schemas section
            String schemasMarker = "db.schemas.insertMany([";
            int schemasIndex = scriptContent.indexOf(schemasMarker);
            if (schemasIndex == -1) {
                LOG.warn("Schemas marker not found in script");
                return null;
            }

            // Skip past the marker to get to the array content
            int arrayStartIndex = schemasIndex + schemasMarker.length();

            // Find the end of the array
            int arrayEndIndex = scriptContent.indexOf("]);", arrayStartIndex);
            if (arrayEndIndex == -1) {
                LOG.warn("End of schemas array not found in script");
                return null;
            }

            // Extract the array content
            String arrayContent = scriptContent.substring(arrayStartIndex, arrayEndIndex).trim();

            // Parse the array content to extract schema documents
            List<Document> schemaDocuments = new ArrayList<>();

            // The schemas section is different from other collections
            // It contains a single document with a version and a schemas object
            // We'll extract this document directly

            // Find the opening brace of the first document
            int docStartIndex = arrayContent.indexOf("{");
            if (docStartIndex == -1) {
                LOG.warn("No schema document found in script");
                return null;
            }

            // Find the closing brace of the document
            // This is tricky because we need to account for nested braces
            int docEndIndex = -1;
            int braceCount = 1;
            boolean inString = false;
            boolean escaped = false;

            for (int i = docStartIndex + 1; i < arrayContent.length(); i++) {
                char c = arrayContent.charAt(i);

                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (c == '\\') {
                    escaped = true;
                    continue;
                }

                if (c == '"') {
                    inString = !inString;
                    continue;
                }

                if (!inString) {
                    if (c == '{') {
                        braceCount++;
                    } else if (c == '}') {
                        braceCount--;
                        if (braceCount == 0) {
                            docEndIndex = i + 1;
                            break;
                        }
                    }
                }
            }

            if (docEndIndex == -1) {
                LOG.warn("Could not find end of schema document in script");
                return null;
            }

            // Extract the document content
            String docContent = arrayContent.substring(docStartIndex, docEndIndex);

            // Create a schema document
            // We'll use the org.bson.Document to parse the JSON, then convert to Nitrite Document
            try {
                org.bson.Document bsonDoc = org.bson.Document.parse(docContent);

                // Convert to Nitrite Document
                Document schemaDoc = Document.createDocument();

                // Add version
                if (bsonDoc.containsKey("version")) {
                    schemaDoc.put("version", bsonDoc.getString("version"));
                }

                // Add schemas
                if (bsonDoc.containsKey("schemas")) {
                    // The schemas field is a complex object, we'll store it as a string
                    org.bson.Document schemasObj = (org.bson.Document) bsonDoc.get("schemas");
                    schemaDoc.put("schemas", schemasObj.toJson());
                }

                schemaDocuments.add(schemaDoc);
                LOG.info("Extracted schema document with version: {}", schemaDoc.get("version"));
            } catch (Exception e) {
                LOG.error("Failed to parse schema document: {}", e.getMessage());
                return null;
            }

            if (schemaDocuments.isEmpty()) {
                LOG.warn("No schemas found in script");
                return null;
            }

            LOG.info("Extracted {} schema documents from script", schemaDocuments.size());
            return schemaDocuments;
        } catch (Exception e) {
            LOG.error("Failed to extract schemas from script: {}", e.getMessage());
            return null;
        }
    }

    private void initializeDatabase() throws IOException, JsonParseException {
        boolean scriptExists = false;
        String scriptContent = null;

        if (initScriptPath != null) {
            Path scriptPath = Paths.get(initScriptPath);
            if (Files.exists(scriptPath)) {
                scriptExists = true;
                LOG.info("Initializing NitriteDB from script: {}", scriptPath);
                try {
                    // Read the script content
                    scriptContent = Files.readString(scriptPath);
                    LOG.info("Found initialization script with {} bytes", Files.size(scriptPath));
                } catch (IOException e) {
                    LOG.error("Failed to read initialization script: {}", e.getMessage());
                }
            } else {
                LOG.warn("Initialization script not found at {}", scriptPath);
            }
        }

        // For now, we'll just create the basic collections that our stores will use
        // regardless of whether a script was found

        // Create collections - just getting the collection creates it if it doesn't exist
        db.getCollection("architectures");
        db.getCollection("patterns");
        NitriteCollection namespaces = db.getCollection("namespaces");
        db.getCollection("domains");
        db.getCollection("flows");
        db.getCollection("schemas");
        NitriteCollection counters = db.getCollection("counters");

        // Initialize namespaces collection only if we can extract them from the script
        if (namespaces.find().size() == 0) {
            LOG.info("Checking for namespaces in initialization script");

            // Only extract namespaces from the script, no defaults
            if (scriptContent != null) {
                List<String> extractedNamespaces = extractNamespacesFromScript(scriptContent);
                if (extractedNamespaces != null && !extractedNamespaces.isEmpty()) {
                    // Insert the namespaces found in the script
                    for (String namespace : extractedNamespaces) {
                        namespaces.insert(Document.createDocument().put("namespace", namespace));
                    }
                    LOG.info("Namespaces initialized from script: {}", String.join(", ", extractedNamespaces));
                } else {
                    LOG.info("No namespaces found in script, skipping namespace initialization");
                }
            } else {
                LOG.info("No script content available, skipping namespace initialization");
            }
        } else {
            LOG.info("Namespaces collection already has data, skipping initialization");
        }

        // Initialize patterns collection with data from script
        NitriteCollection patterns = db.getCollection("patterns");
        if (patterns.find().size() == 0) {
            LOG.info("Checking for patterns in initialization script");

            // Only extract patterns from the script, no defaults
            if (scriptContent != null) {
                List<Document> extractedPatterns = extractPatternsFromScript(scriptContent);
                if (extractedPatterns != null && !extractedPatterns.isEmpty()) {
                    // Insert the patterns found in the script
                    for (Document patternDoc : extractedPatterns) {
                        patterns.insert(patternDoc);
                    }
                    LOG.info("Patterns initialized from script: {} documents", extractedPatterns.size());
                } else {
                    LOG.info("No patterns found in script, skipping patterns initialization");
                }
            } else {
                LOG.info("No script content available, skipping patterns initialization");
            }
        } else {
            LOG.info("Patterns collection already has data, skipping initialization");
        }

        // Initialize architectures collection with data from script
        NitriteCollection architectures = db.getCollection("architectures");
        if (architectures.find().size() == 0) {
            LOG.info("Checking for architectures in initialization script");

            // Only extract architectures from the script, no defaults
            if (scriptContent != null) {
                List<Document> extractedArchitectures = extractArchitecturesFromScript(scriptContent);
                if (extractedArchitectures != null && !extractedArchitectures.isEmpty()) {
                    // Insert the architectures found in the script
                    for (Document architectureDoc : extractedArchitectures) {
                        architectures.insert(architectureDoc);
                    }
                    LOG.info("Architectures initialized from script: {} documents", extractedArchitectures.size());
                } else {
                    LOG.info("No architectures found in script, skipping architectures initialization");
                }
            } else {
                LOG.info("No script content available, skipping architectures initialization");
            }
        } else {
            LOG.info("Architectures collection already has data, skipping initialization");
        }

        // Initialize flows collection with data from script
        NitriteCollection flows = db.getCollection("flows");
        if (flows.find().size() == 0) {
            LOG.info("Checking for flows in initialization script");

            // Only extract flows from the script, no defaults
            if (scriptContent != null) {
                List<Document> extractedFlows = extractFlowsFromScript(scriptContent);
                if (extractedFlows != null && !extractedFlows.isEmpty()) {
                    // Insert the flows found in the script
                    for (Document flowDoc : extractedFlows) {
                        flows.insert(flowDoc);
                    }
                    LOG.info("Flows initialized from script: {} documents", extractedFlows.size());
                } else {
                    LOG.info("No flows found in script, skipping flows initialization");
                }
            } else {
                LOG.info("No script content available, skipping flows initialization");
            }
        } else {
            LOG.info("Flows collection already has data, skipping initialization");
        }

        // Initialize schemas collection with data from script
        NitriteCollection schemas = db.getCollection("schemas");
        if (schemas.find().size() == 0) {
            LOG.info("Checking for schemas in initialization script");

            // Only extract schemas from the script, no defaults
            if (scriptContent != null) {
                List<Document> extractedSchemas = extractSchemasFromScript(scriptContent);
                if (extractedSchemas != null && !extractedSchemas.isEmpty()) {
                    // Insert the schemas found in the script
                    for (Document schemaDoc : extractedSchemas) {
                        schemas.insert(schemaDoc);
                    }
                    LOG.info("Schemas initialized from script: {} documents", extractedSchemas.size());
                } else {
                    LOG.info("No schemas found in script, skipping schemas initialization");
                }
            } else {
                LOG.info("No script content available, skipping schemas initialization");
            }
        } else {
            LOG.info("Schemas collection already has data, skipping initialization");
        }

        // Initialize counters document if it doesn't exist
        if (counters.find().size() == 0) {
            Document countersDoc = Document.createDocument()
                    .put("_id", "1")  // Use "1" as the ID to match NitriteCounterStore
                    .put("architecture", 1)
                    .put("pattern", 1)
                    .put("flow", 1)
                    .put("adr", 1);

            counters.insert(countersDoc);
            LOG.info("Counters document initialized");
        } else {
            LOG.info("Counters collection already has data, skipping initialization");
        }

        LOG.info("NitriteDB initialized with basic collections");
    }
}
