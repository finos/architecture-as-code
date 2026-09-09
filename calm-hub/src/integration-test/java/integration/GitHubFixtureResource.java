package integration;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import org.eclipse.jgit.api.Git;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Provisions two local, plain (non-bare) git repos - cloned over the file:// transport
 * exactly as {@code TestGitHubRepoSyncShould} proves works for a unit test - standing
 * in for two separate GitHub-hosted repos. "finos-repo" carries a control under the
 * "security" domain; "other-repo" carries one under "finance". Namespace "finos" is
 * configured with access group "group1", "other" with "group2" - see
 * {@link IntegrationTestGithubProfile} for how these feed calm.github.namespaces, and
 * GitHubUserAccessDomainReadIntegration for what this fixture is proving.
 */
public class GitHubFixtureResource implements QuarkusTestResourceLifecycleManager {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubFixtureResource.class);

    private Path originRoot;
    private Path cloneDirectory;

    @Override
    public Map<String, String> start() {
        try {
            originRoot = Files.createTempDirectory("calm-github-it-origin");
            cloneDirectory = Files.createTempDirectory("calm-github-it-clones");

            createRepo(originRoot.resolve("finos-repo.git"), "controls/security/access-control.json");
            createRepo(originRoot.resolve("other-repo.git"), "controls/finance/other-control.json");

            LOG.info("GitHub fixture repos created under {}", originRoot);
        } catch (Exception e) {
            throw new RuntimeException("Failed to set up GitHub fixture repos", e);
        }

        String baseUrl = originRoot.toUri().toString().replaceAll("/$", "");

        return Map.of(
                "calm.database.mode", "github",
                "calm.auth.enabled", "true",
                "calm.github.oauth.base-url", baseUrl,
                "calm.github.clone-directory", cloneDirectory.toString(),
                "calm.github.namespaces", "finos|finos-repo|main|group1,other|other-repo|main|group2"
        );
    }

    private void createRepo(Path repoDir, String controlRelativePath) throws Exception {
        Files.createDirectories(repoDir);
        try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
            Path controlFile = repoDir.resolve(controlRelativePath);
            Files.createDirectories(controlFile.getParent());
            Files.writeString(controlFile, "{}");
            git.add().addFilepattern(".").call();
            git.commit().setMessage("seed fixture control").call();
        }
    }

    @Override
    public void stop() {
        deleteRecursively(originRoot);
        deleteRecursively(cloneDirectory);
    }

    private void deleteRecursively(Path root) {
        if (root == null) {
            return;
        }
        try (var paths = Files.walk(root)) {
            paths.sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // best-effort cleanup
                }
            });
        } catch (IOException ignored) {
            // best-effort cleanup
        }
    }
}
