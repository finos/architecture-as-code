package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class DocifyTool {

    private final Logger log = LoggerFactory.getLogger(DocifyTool.class);

    @Tool(
            name = "renderDocsite",
            description = "Renders a static docsite from a CALM architecture document using the calm-cli and returns it as a zip blob"
    )
    public Map<String, Object> renderDocsite(
            @ToolArg(description = "JSON content of the CALM architecture") String architectureContent
    ) {
        if (architectureContent == null || architectureContent.trim().isEmpty()) {
            throw new IllegalArgumentException("Architecture content is required");
        }

        Path tempDir = null;
        Path archFile;
        Path outDir;

        try {
            tempDir = Files.createTempDirectory("calm-docify-");
            archFile = tempDir.resolve("input.arch.json");
            outDir = tempDir.resolve("website");

            Files.write(archFile, architectureContent.getBytes());
            Files.createDirectories(outDir);

            List<String> command = Arrays.asList(
                    "npx", "calm", "docify",
                    "--input", archFile.toString(),
                    "--output", outDir.toString()
            );

            log.info("Executing command: {}", String.join(" ", command));
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(findProjectRoot());

            Process process = pb.start();
            process.waitFor(30, TimeUnit.SECONDS);

            if (process.exitValue() != 0) {
                String err = readStream(process.getErrorStream());
                throw new RuntimeException("Docify failed:\n" + err);
            }

            byte[] zipBytes = zipFolder(outDir);
            String zipBase64 = Base64.getEncoder().encodeToString(zipBytes);

            return Map.of(
                    "content", List.of(Map.of(
                            "type", "blob",
                            "mimeType", "application/zip",
                            "blob", zipBase64,
                            "uri", "blob://rendered-docsite.zip"
                    ))
            );

        } catch (Exception e) {
            log.error("Failed to render docsite: {}", e.getMessage(), e);
            return Map.of(
                    "content", List.of(Map.of(
                            "type", "text",
                            "text", "❌ Failed to render docsite:\n" + e.getMessage()
                    ))
            );
        } finally {
            if (tempDir != null) {
                try {
                    Files.walk(tempDir)
                            .sorted(Comparator.reverseOrder())
                            .map(Path::toFile)
                            .forEach(File::delete);
                } catch (IOException ignored) {}
            }
        }
    }

    private File findProjectRoot() {
        Path currentDir = Paths.get(System.getProperty("user.dir"));
        while (currentDir != null) {
            Path cliDir = currentDir.resolve("cli");
            if (Files.exists(cliDir.resolve("package.json"))) {
                return cliDir.toFile();
            }
            currentDir = currentDir.getParent();
        }
        return new File(System.getProperty("user.dir"));
    }

    private String readStream(InputStream inputStream) throws IOException {
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }
        return output.toString();
    }

    private byte[] zipFolder(Path sourceDir) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            Files.walk(sourceDir).forEach(path -> {
                if (Files.isDirectory(path)) return;
                ZipEntry entry = new ZipEntry(sourceDir.relativize(path).toString());
                try {
                    zos.putNextEntry(entry);
                    Files.copy(path, zos);
                    zos.closeEntry();
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
        }
        return baos.toByteArray();
    }
}
