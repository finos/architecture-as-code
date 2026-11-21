package org.finos.calm.store.github.sync;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.RepositoryCache;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.eclipse.jgit.util.FS;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Comparator;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Handles git clone and sync operations for a single repository.
 * Uses fetch + reset instead of pull to handle upstream force-pushes gracefully.
 *
 * <p>Both {@link #cloneRepo} and {@link #pullRepo} set an explicit JGit transport timeout
 * ({@code calm.github.git.timeout-seconds}) — without one, an unresponsive remote hangs the
 * command indefinitely. That matters more here than a plain slow request: {@code pullRepo}
 * runs from {@link GitHubSyncScheduler}, which is {@code @Scheduled(concurrentExecution =
 * SKIP)} — a hung fetch doesn't just block one tick, it blocks every future tick from ever
 * starting (SKIP only prevents overlap, it doesn't time out a stuck execution), so the
 * namespace silently stops updating until the process is restarted.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubRepoSync {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubRepoSync.class);
    private static final Set<PosixFilePermission> OWNER_ONLY_PERMISSIONS =
            PosixFilePermissions.fromString("rwx------");

    private final String githubBaseUrl;
    private final int gitTimeoutSeconds;

    @Inject
    public GitHubRepoSync(@ConfigProperty(name = "calm.github.oauth.base-url", defaultValue = "https://github.com") String githubBaseUrl,
                           @ConfigProperty(name = "calm.github.git.timeout-seconds", defaultValue = "30") int gitTimeoutSeconds) {
        this.githubBaseUrl = githubBaseUrl;
        this.gitTimeoutSeconds = gitTimeoutSeconds;
    }

    public boolean cloneRepo(String repoFullName, String branch, Path targetDir, String token) {
        String url = expectedRemoteUrl(repoFullName);
        try {
            if (Files.exists(targetDir, LinkOption.NOFOLLOW_LINKS)) {
                deleteRecursively(targetDir);
            }
            createRestrictedDirectories(targetDir);
            CloneCommand clone = Git.cloneRepository()
                    .setURI(url)
                    .setDirectory(targetDir.toFile())
                    .setBranch(branch)
                    .setDepth(1)
                    .setTimeout(gitTimeoutSeconds);

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

    public boolean pullRepo(Path repoDir, String repoFullName, String branch, String token) {
        if (!isValidRepo(repoDir, repoFullName)) {
            LOG.error("Refusing to sync {}: repository is invalid or origin remote does not match {}",
                    repoDir.getFileName(), repoFullName);
            return false;
        }
        return pullRepo(repoDir, branch, token);
    }

    /**
     * Fetches and hard-resets {@code repoDir} to {@code origin/<branch>}. {@code branch}
     * is the configured branch, deliberately not whatever the local checkout currently
     * happens to be on: if an operator changes a namespace's configured branch without
     * wiping its clone directory, {@code isValidRepo} still sees a valid repo and this
     * runs instead of a fresh clone - resetting to the configured branch (rather than the
     * stale local one) is what makes that change actually take effect, instead of leaving
     * the working tree permanently pointed at the old branch while
     * {@code GitHubFileHistoryClient} queries version history against the new one.
     */
    public boolean pullRepo(Path repoDir, String branch, String token) {
        try (Git git = Git.open(repoDir.toFile())) {
            String originUrl = git.getRepository().getConfig().getString("remote", "origin", "url");
            if (originUrl == null || originUrl.isBlank()) {
                LOG.error("Failed to sync {}: missing origin remote URL", repoDir.getFileName());
                return false;
            }

            var fetchCommand = git.fetch().setTimeout(gitTimeoutSeconds);

            if (token != null && !token.isBlank()) {
                fetchCommand.setCredentialsProvider(
                        new UsernamePasswordCredentialsProvider(token, ""));
            }

            fetchCommand.call();
            git.reset()
                    .setMode(ResetCommand.ResetType.HARD)
                    .setRef("origin/" + branch)
                    .call();

            LOG.debug("Fetched and reset {} to origin/{}", repoDir.getFileName(), branch);
            return true;
        } catch (GitAPIException | IOException e) {
            LOG.error("Failed to sync {}: {}", repoDir.getFileName(), e.getMessage());
            return false;
        }
    }

    public boolean isValidRepo(Path repoDir) {
        if (repoDir == null || !Files.isDirectory(repoDir.resolve(".git"), LinkOption.NOFOLLOW_LINKS)) {
            return false;
        }
        return RepositoryCache.FileKey.isGitRepository(repoDir.resolve(".git").toFile(), FS.DETECTED);
    }

    public boolean isValidRepo(Path repoDir, String repoFullName) {
        if (!isValidRepo(repoDir) || repoFullName == null || repoFullName.isBlank()) {
            return false;
        }
        String expectedUrl = expectedRemoteUrl(repoFullName);
        try (Git git = Git.open(repoDir.toFile())) {
            String originUrl = git.getRepository().getConfig().getString("remote", "origin", "url");
            if (!expectedUrl.equals(originUrl)) {
                LOG.warn("Existing checkout at {} has origin '{}' instead of expected '{}' — treating as invalid",
                        repoDir, originUrl, expectedUrl);
                return false;
            }
            return true;
        } catch (IOException e) {
            LOG.warn("Failed to inspect git repository at {}: {}", repoDir, e.getMessage());
            return false;
        }
    }

    private String expectedRemoteUrl(String repoFullName) {
        return githubBaseUrl + "/" + repoFullName + ".git";
    }

    private static void createRestrictedDirectories(Path targetDir) throws IOException {
        if (targetDir.getFileSystem().supportedFileAttributeViews().contains("posix")) {
            Files.createDirectories(targetDir, PosixFilePermissions.asFileAttribute(OWNER_ONLY_PERMISSIONS));
            Files.setPosixFilePermissions(targetDir, OWNER_ONLY_PERMISSIONS);
        } else {
            Files.createDirectories(targetDir);
        }
    }

    private static void deleteRecursively(Path root) throws IOException {
        try (Stream<Path> walk = Files.walk(root)) {
            for (Path p : walk.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(p);
            }
        }
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
