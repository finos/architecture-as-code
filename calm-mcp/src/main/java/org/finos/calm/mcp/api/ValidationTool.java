package org.finos.calm.mcp.api;

import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * A tool for validating CALM architecture files using the calm-cli.
 */
public class ValidationTool {

    private final Logger log = LoggerFactory.getLogger(ValidationTool.class);

    public static class ValidationResult {
        private boolean success;
        private String output;
        private String error;
        private int exitCode;

        public ValidationResult(boolean success, String output, String error, int exitCode) {
            this.success = success;
            this.output = output;
            this.error = error;
            this.exitCode = exitCode;
        }

        // Getters
        public boolean isSuccess() { return success; }
        public String getOutput() { return output; }
        public String getError() { return error; }
        public int getExitCode() { return exitCode; }
    }

    @Tool(
            name = "validateCalmArchitecture",
            description = "Validates a CALM architecture file against a pattern using the calm-cli. " +
                         "Accepts architecture and pattern content as strings and returns validation results. " +
                         "The tool will create temporary files for validation and clean them up automatically."
    )
    public ValidationResult validateCalmArchitecture(
            @ToolArg(description = "JSON content of the CALM architecture to validate") String architectureContent,
            @ToolArg(description = "JSON content of the CALM pattern to validate against (optional)") String patternContent,
            @ToolArg(description = "Run in strict mode - fail on warnings (optional, default: false)") Boolean strict,
            @ToolArg(description = "Output format - json or junit (optional, default: json)") String format) {
        
        if (architectureContent == null || architectureContent.trim().isEmpty()) {
            log.error("Architecture content is required for validation");
            return new ValidationResult(false, "", "Architecture content is required", -1);
        }

        // Set defaults
        boolean strictMode = strict != null ? strict : false;
        String outputFormat = format != null ? format : "json";

        Path tempDir = null;
        Path architectureFile = null;
        Path patternFile = null;

        try {
            // Create temporary directory
            tempDir = Files.createTempDirectory("calm-validation-");
            log.info("Created temporary directory for validation: {}", tempDir);

            // Write architecture content to temporary file
            architectureFile = tempDir.resolve("architecture.json");
            Files.write(architectureFile, architectureContent.getBytes());
            log.debug("Written architecture content to: {}", architectureFile);

            // Write pattern content to temporary file if provided
            if (patternContent != null && !patternContent.trim().isEmpty()) {
                patternFile = tempDir.resolve("pattern.json");
                Files.write(patternFile, patternContent.getBytes());
                log.debug("Written pattern content to: {}", patternFile);
            }

            // Build command
            List<String> command = buildValidationCommand(architectureFile, patternFile, strictMode, outputFormat);
            log.info("Executing validation command: {}", String.join(" ", command));

            // Execute command
            ProcessBuilder processBuilder = new ProcessBuilder(command);
            processBuilder.directory(findProjectRoot());
            
            Process process = processBuilder.start();

            // Read output and error streams
            String output = readStream(process.getInputStream());
            String error = readStream(process.getErrorStream());

            // Wait for process to complete
            boolean finished = process.waitFor(30, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.error("Validation process timed out");
                return new ValidationResult(false, "", "Validation process timed out", -1);
            }

            int exitCode = process.exitValue();
            boolean success = exitCode == 0;

            log.info("Validation completed with exit code: {}", exitCode);
            if (!success) {
                log.warn("Validation failed. Error output: {}", error);
            }

            return new ValidationResult(success, output, error, exitCode);

        } catch (IOException e) {
            log.error("IOException during validation: {}", e.getMessage());
            return new ValidationResult(false, "", "IO error: " + e.getMessage(), -1);
        } catch (InterruptedException e) {
            log.error("Validation process was interrupted: {}", e.getMessage());
            Thread.currentThread().interrupt();
            return new ValidationResult(false, "", "Process interrupted: " + e.getMessage(), -1);
        } finally {
            // Clean up temporary files
            cleanupTempFiles(tempDir, architectureFile, patternFile);
        }
    }

    private List<String> buildValidationCommand(Path architectureFile, Path patternFile, boolean strict, String format) {
        List<String> command = new ArrayList<>();
        
        // Use npx to run the CLI if it's not globally installed
        command.add("npx");
        command.add("@finos/calm-cli");
        command.add("validate");
        
        // Add architecture file
        command.add("-a");
        command.add(architectureFile.toString());
        
        // Add pattern file if provided
        if (patternFile != null) {
            command.add("-p");
            command.add(patternFile.toString());
        }
        
        // Add format option
        command.add("-f");
        command.add(format);
        
        // Add strict mode if enabled
        if (strict) {
            command.add("--strict");
        }
        
        // Add verbose logging
        command.add("-v");
        
        return command;
    }

    private File findProjectRoot() {
        // Start from current working directory and look for the CLI directory
        Path currentDir = Paths.get(System.getProperty("user.dir"));
        
        while (currentDir != null) {
            Path cliDir = currentDir.resolve("cli");
            if (Files.exists(cliDir) && Files.isDirectory(cliDir)) {
                Path packageJson = cliDir.resolve("package.json");
                if (Files.exists(packageJson)) {
                    log.debug("Found CLI directory at: {}", cliDir);
                    return cliDir.toFile();
                }
            }
            currentDir = currentDir.getParent();
        }
        
        // Fallback to current directory
        log.warn("Could not find CLI directory, using current working directory");
        return new File(System.getProperty("user.dir"));
    }

    private String readStream(java.io.InputStream inputStream) throws IOException {
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }
        return output.toString();
    }

    private void cleanupTempFiles(Path tempDir, Path architectureFile, Path patternFile) {
        try {
            if (architectureFile != null && Files.exists(architectureFile)) {
                Files.delete(architectureFile);
                log.debug("Deleted temporary architecture file: {}", architectureFile);
            }
            if (patternFile != null && Files.exists(patternFile)) {
                Files.delete(patternFile);
                log.debug("Deleted temporary pattern file: {}", patternFile);
            }
            if (tempDir != null && Files.exists(tempDir)) {
                Files.delete(tempDir);
                log.debug("Deleted temporary directory: {}", tempDir);
            }
        } catch (IOException e) {
            log.warn("Failed to clean up temporary files: {}", e.getMessage());
        }
    }
}
