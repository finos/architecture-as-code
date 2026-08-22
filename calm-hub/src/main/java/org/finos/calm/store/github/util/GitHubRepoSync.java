package org.finos.calm.store.github.util;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Handles git clone and sync operations for a single repository.
 * Uses fetch + reset instead of pull to handle upstream force-pushes gracefully.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubRepoSync {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubRepoSync.class);

    @Inject
    @ConfigProperty(name = "calm.github.oauth.base-url", defaultValue = "https://github.com")
    String githubBaseUrl;

    public boolean cloneRepo(String repoFullName, String branch, Path targetDir, String token) {
        String url = githubBaseUrl + "/" + repoFullName + ".git";
        try {
            Files.createDirectories(targetDir);
            CloneCommand clone = Git.cloneRepository()
                    .setURI(url)
                    .setDirectory(targetDir.toFile())
                    .setBranch(branch)
                    .setDepth(1);

            if (token != null && !token.isBlank()) {
                clone.setCredentialsProvider(
                        new UsernamePasswordCredentialsProvider(token, ""));
            }

            try (Git git = clone.call()) {
                LOG.info("Cloned {} (branch: {}) to {}", repoFullName, branch, targetDir);
                return true;
            }
        } catch (GitAPIException | IOException e) {
            LOG.error("Failed to clone {}: {}", repoFullName, e.getMessage());
            return false;
        }
    }

    public boolean pullRepo(Path repoDir, String token) {
        try (Git git = Git.open(repoDir.toFile())) {
            var fetchCommand = git.fetch();

            if (token != null && !token.isBlank()) {
                fetchCommand.setCredentialsProvider(
                        new UsernamePasswordCredentialsProvider(token, ""));
            }

            fetchCommand.call();
            git.reset()
                    .setMode(ResetCommand.ResetType.HARD)
                    .setRef("origin/" + git.getRepository().getBranch())
                    .call();

            LOG.debug("Fetched and reset for {}", repoDir.getFileName());
            return true;
        } catch (GitAPIException | IOException e) {
            LOG.error("Failed to sync {}: {}", repoDir.getFileName(), e.getMessage());
            return false;
        }
    }

    public boolean isValidRepo(Path repoDir) {
        return Files.isDirectory(repoDir.resolve(".git"));
    }
}
