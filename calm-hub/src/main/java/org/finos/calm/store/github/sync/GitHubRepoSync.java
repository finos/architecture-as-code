package org.finos.calm.store.github.sync;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.ObjectId;
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

    private final String githubBaseUrl;

    @Inject
    public GitHubRepoSync(@ConfigProperty(name = "calm.github.oauth.base-url", defaultValue = "https://github.com") String githubBaseUrl) {
        this.githubBaseUrl = githubBaseUrl;
    }

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

    /**
     * The commit SHA a clone directory's working tree currently holds, truncated to 7
     * characters to match the abbreviated SHAs {@code GitHubFileHistoryClient} returns from
     * the GitHub commits API — a version list mixing 7-char and 40-char entries would be
     * inconsistent. Every clone is {@code --depth 1} ({@link #cloneRepo}), so this is the
     * only version the local tree can honestly attest to; anything else requires the API.
     *
     * @return the abbreviated HEAD SHA, or {@code null} if {@code repoDir} isn't a valid
     * git repository (mirrors {@link #isValidRepo} rather than throwing).
     */
    public String headSha(Path repoDir) {
        if (!isValidRepo(repoDir)) {
            return null;
        }
        try (Git git = Git.open(repoDir.toFile())) {
            ObjectId head = git.getRepository().resolve("HEAD");
            return head == null ? null : head.abbreviate(7).name();
        } catch (IOException e) {
            LOG.error("Failed to resolve HEAD for {}: {}", repoDir.getFileName(), e.getMessage());
            return null;
        }
    }
}
