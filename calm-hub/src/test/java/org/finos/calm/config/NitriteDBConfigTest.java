package org.finos.calm.config;

import io.quarkus.test.junit.QuarkusTest;
import org.dizitart.no2.Nitrite;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.MockitoAnnotations;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class NitriteDBConfigTest {

    @InjectMocks
    private NitriteDBConfig nitriteDBConfig;

    private Path tempDir;

    @BeforeEach
    public void setup() throws IOException {
        MockitoAnnotations.openMocks(this);
        // Create a temporary directory manually
        tempDir = Files.createTempDirectory("nitrite-test");

        nitriteDBConfig = new NitriteDBConfig();
        nitriteDBConfig.databaseMode = "standalone";
        nitriteDBConfig.dataDirectory = tempDir.toString();
        nitriteDBConfig.username = "testuser";
        nitriteDBConfig.password = "testpass";
        nitriteDBConfig.databaseName = "testdb";
    }

    @AfterEach
    public void cleanup() throws IOException {
        // Clean up the temporary directory
        if (tempDir != null && Files.exists(tempDir)) {
            Files.walk(tempDir)
                .sorted(java.util.Comparator.reverseOrder())
                .forEach(path -> {
                    try {
                        Files.delete(path);
                    } catch (IOException e) {
                        // Ignore
                    }
                });
        }
    }

    @Test
    public void testInitializeInStandaloneMode() throws Exception {
        // Given
        nitriteDBConfig.databaseMode = "standalone";

        // When
        nitriteDBConfig.initialize();

        // Then
        Nitrite db = nitriteDBConfig.getNitriteDb();
        assertNotNull(db, "Database should be initialized");
        assertFalse(db.isClosed(), "Database should be open");

        // Verify collections were created
        assertTrue(db.hasCollection("architectures"), "architectures collection should exist");
        assertTrue(db.hasCollection("patterns"), "patterns collection should exist");
        assertTrue(db.hasCollection("namespaces"), "namespaces collection should exist");
        assertTrue(db.hasCollection("domains"), "domains collection should exist");
        assertTrue(db.hasCollection("flows"), "flows collection should exist");
        assertTrue(db.hasCollection("schemas"), "schemas collection should exist");
        assertTrue(db.hasCollection("counters"), "counters collection should exist");
        assertTrue(db.hasCollection("decorators"), "decorators collection should exist");
    }

    @Test
    public void testInitializeInNonStandaloneMode() {
        // Given
        nitriteDBConfig.databaseMode = "mongo";

        // When
        nitriteDBConfig.initialize();

        // Then
        assertNull(nitriteDBConfig.getNitriteDb(), "Database should not be initialized in non-standalone mode");
    }

    @Test
    public void testGetNitriteDb() throws Exception {
        // Given
        nitriteDBConfig.initialize();

        // When
        Nitrite db = nitriteDBConfig.getNitriteDb();

        // Then
        assertNotNull(db, "getNitriteDb should return the database instance");
        assertFalse(db.isClosed(), "Database should be open");
    }

    @Test
    public void testShutdown() throws Exception {
        // Given
        nitriteDBConfig.initialize();
        Nitrite db = nitriteDBConfig.getNitriteDb();
        assertFalse(db.isClosed(), "Database should be open before shutdown");

        // When
        nitriteDBConfig.shutdown();

        // Then
        assertTrue(db.isClosed(), "Database should be closed after shutdown");
    }

    @Test
    public void testShutdownWithNullDb() {
        // Given
        nitriteDBConfig.databaseMode = "mongo";
        nitriteDBConfig.initialize();

        // When/Then - should not throw exception
        nitriteDBConfig.shutdown();
    }

    @Test
    public void testInitializeWithIOException() throws Exception {
        // Given
        nitriteDBConfig.databaseMode = "standalone";
        nitriteDBConfig.dataDirectory = "/non-existent-directory-that-cannot-be-created";

        // When/Then
        Exception exception = assertThrows(RuntimeException.class, () -> {
            nitriteDBConfig.initialize();
        });

        assertTrue(exception.getMessage().contains("Failed to start NitriteDB"), 
                "Exception message should indicate failure to start NitriteDB");
    }

    @Test
    public void testReadOnlyModeFailsFastWhenDbFileMissing() {
        // Given
        nitriteDBConfig.readOnly = true;
        // dataDirectory exists (tempDir) but the .db file has never been seeded

        // When/Then
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            nitriteDBConfig.initialize();
        });

        assertTrue(exception.getMessage().contains("Read-only mode requires a pre-seeded database file"),
                "Exception should explain that a pre-seeded .db is required");
    }

    @Test
    public void testReadOnlyModeOpensExistingDbWithoutCreatingCollections() throws Exception {
        // First create a writable database so the .db file exists
        nitriteDBConfig.initialize();
        nitriteDBConfig.shutdown();

        // Re-open in read-only mode
        NitriteDBConfig readOnlyConfig = new NitriteDBConfig();
        readOnlyConfig.databaseMode = "standalone";
        readOnlyConfig.dataDirectory = tempDir.toString();
        readOnlyConfig.username = "testuser";
        readOnlyConfig.password = "testpass";
        readOnlyConfig.databaseName = "testdb";
        readOnlyConfig.readOnly = true;

        // When
        readOnlyConfig.initialize();

        // Then
        Nitrite db = readOnlyConfig.getNitriteDb();
        assertNotNull(db, "Database should be opened in read-only mode");
        assertFalse(db.isClosed(), "Database should be open");

        readOnlyConfig.shutdown();
    }
}
