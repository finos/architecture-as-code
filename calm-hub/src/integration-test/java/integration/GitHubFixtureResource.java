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
 *
 * <p>"finos-repo" also carries a {@code building-blocks/rate-limit-policy.json} file -
 * see {@link GitHubReworkBehaviorIntegration} for what that proves (the Building
 * Block-to-Standard alias, and the "latest" removal, end to end against a real local clone
 * rather than a mock).
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

            createRepo(originRoot.resolve("finos-repo.git"), Map.of(
                    "controls/security/access-control.json", "{}",
                    "building-blocks/rate-limit-policy.json", "{\"name\":\"Rate Limit Policy\"}"
            ));
            createRepo(originRoot.resolve("other-repo.git"), Map.of(
                    "controls/finance/other-control.json", "{}"
            ));

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

    private void createRepo(Path repoDir, Map<String, String> filesByRelativePath) throws Exception {
        Files.createDirectories(repoDir);
        try (Git git = Git.init().setDirectory(repoDir.toFile()).setInitialBranch("main").call()) {
            for (Map.Entry<String, String> file : filesByRelativePath.entrySet()) {
                Path target = repoDir.resolve(file.getKey());
                Files.createDirectories(target.getParent());
                Files.writeString(target, file.getValue());
            }
            git.add().addFilepattern(".").call();
            git.commit().setMessage("seed fixture content").call();
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
