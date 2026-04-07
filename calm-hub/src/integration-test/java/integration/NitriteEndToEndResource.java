package integration;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Map;

public class NitriteEndToEndResource implements QuarkusTestResourceLifecycleManager {

    private static final Logger logger = LoggerFactory.getLogger(NitriteEndToEndResource.class);
    private Path tempDir;

    @Override
    public Map<String, String> start() {
        try {
            tempDir = Files.createTempDirectory("calm-nitrite-integration");
            logger.info("Created temp directory for Nitrite integration tests: {}", tempDir);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create temp directory for Nitrite integration tests", e);
        }

        return Map.of(
                "calm.database.mode", "standalone",
                "calm.standalone.data-directory", tempDir.toString(),
                "calm.standalone.database-name", "testdb",
                "calm.standalone.username", "admin",
                "calm.standalone.password", "admin",
                "quarkus.mongodb.devservices.enabled", "false"
        );
    }

    @Override
    public void stop() {
        if (tempDir != null) {
            try {
                Files.walkFileTree(tempDir, new SimpleFileVisitor<>() {
                    @Override
                    public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                        Files.delete(file);
                        return FileVisitResult.CONTINUE;
                    }

                    @Override
                    public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                        Files.delete(dir);
                        return FileVisitResult.CONTINUE;
                    }
                });
                logger.info("Cleaned up temp directory: {}", tempDir);
            } catch (IOException e) {
                logger.warn("Failed to clean up temp directory: {}", tempDir, e);
            }
        }
    }
}
