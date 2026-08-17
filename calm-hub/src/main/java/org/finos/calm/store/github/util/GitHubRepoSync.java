package org.finos.calm.store.github.util;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.PullResult;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Handles git clone and pull operations for a single repository.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubRepoSync {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubRepoSync.class);

    public boolean cloneRepo(String repoFullName, String branch, Path targetDir, String token) {
        String url = "https://github.com/" + repoFullName + ".git";
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
            var pullCommand = git.pull();

            if (token != null && !token.isBlank()) {
                pullCommand.setCredentialsProvider(
                        new UsernamePasswordCredentialsProvider(token, ""));
            }

            PullResult result = pullCommand.call();
            if (result.isSuccessful()) {
                LOG.debug("Pulled updates for {}", repoDir.getFileName());
                return true;
            } else {
                LOG.warn("Pull not successful for {}: {}", repoDir.getFileName(), result.getMergeResult());
                return false;
            }
        } catch (GitAPIException | IOException e) {
            LOG.error("Failed to pull {}: {}", repoDir.getFileName(), e.getMessage());
            return false;
        }
    }

    public boolean isValidRepo(Path repoDir) {
        return Files.isDirectory(repoDir.resolve(".git"));
    }
}
