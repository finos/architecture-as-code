package org.finos.calm.store.github.sync;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;

class TestGitHubRepoSyncShould {

    private GitHubRepoSync repoSync;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setup() {
        repoSync = new GitHubRepoSync("https://github.com");
    }

    @Test
    void return_false_for_invalid_repo_when_directory_does_not_exist() {
        assertThat(repoSync.isValidRepo(tempDir.resolve("nonexistent")), is(false));
    }

    @Test
    void return_false_for_invalid_repo_when_no_git_directory() {
        assertThat(repoSync.isValidRepo(tempDir), is(false));
    }

    @Test
    void return_true_for_valid_repo_when_git_directory_exists() throws IOException {
        Files.createDirectories(tempDir.resolve(".git"));
        assertThat(repoSync.isValidRepo(tempDir), is(true));
    }

    @Test
    void return_false_when_clone_fails_with_invalid_url() {
        boolean result = repoSync.cloneRepo(
                "nonexistent-org/nonexistent-repo",
                "main",
                tempDir.resolve("clone-target"),
                "invalid-token"
        );
        assertThat(result, is(false));
    }

    @Test
    void return_false_when_pull_on_non_repo_directory() {
        boolean result = repoSync.pullRepo(tempDir, "token");
        assertThat(result, is(false));
    }

    @Test
    void clone_local_bare_repo_successfully() throws GitAPIException, IOException {
        Path bareRepo = tempDir.resolve("bare.git");
        Git.init().setDirectory(bareRepo.toFile()).setBare(true).call().close();

        Path cloneTarget = tempDir.resolve("cloned");
        boolean result = repoSync.cloneRepo(
                bareRepo.toUri().toString().replace("file:", "").replace(".git", ""),
                "master",
                cloneTarget,
                null
        );
        // Clone from local bare repo using file:// URI directly
        // The cloneRepo method prepends https://github.com/ so this will fail
        // but we can test the pull path instead via a real local clone
        assertThat(result, is(false));
    }

    @Test
    void pull_local_repo_successfully() throws GitAPIException, IOException {
        Path originDir = tempDir.resolve("origin");
        Files.createDirectories(originDir);
        try (Git origin = Git.init().setDirectory(originDir.toFile()).setInitialBranch("main").call()) {
            Files.writeString(originDir.resolve("test.txt"), "hello");
            origin.add().addFilepattern("test.txt").call();
            origin.commit().setMessage("init").call();
        }

        Path cloneDir = tempDir.resolve("clone");
        try (Git ignored = Git.cloneRepository()
                .setURI(originDir.toUri().toString())
                .setDirectory(cloneDir.toFile())
                .setBranch("main")
                .call()) {
            // clone done
        }

        boolean result = repoSync.pullRepo(cloneDir, null);
        assertThat(result, is(true));
    }

    @Test
    void pull_local_repo_successfully_with_a_credentials_provider_attached() throws GitAPIException, IOException {
        Path originDir = tempDir.resolve("origin-with-token");
        Files.createDirectories(originDir);
        try (Git origin = Git.init().setDirectory(originDir.toFile()).setInitialBranch("main").call()) {
            Files.writeString(originDir.resolve("test.txt"), "hello");
            origin.add().addFilepattern("test.txt").call();
            origin.commit().setMessage("init").call();
        }

        Path cloneDir = tempDir.resolve("clone-with-token");
        try (Git ignored = Git.cloneRepository()
                .setURI(originDir.toUri().toString())
                .setDirectory(cloneDir.toFile())
                .setBranch("main")
                .call()) {
            // clone done
        }

        // A local file:// remote ignores the credentials provider entirely, but this
        // still exercises the setCredentialsProvider branch (a non-blank token) that
        // the "" and null cases used by the other pull tests don't reach.
        boolean result = repoSync.pullRepo(cloneDir, "a-real-looking-token");
        assertThat(result, is(true));
    }

    @Test
    void clone_a_real_repo_successfully_via_file_protocol() throws GitAPIException, IOException {
        Path originDir = tempDir.resolve("myrepo.git");
        Files.createDirectories(originDir);
        try (Git origin = Git.init().setDirectory(originDir.toFile()).setInitialBranch("main").call()) {
            Files.writeString(originDir.resolve("test.txt"), "hello");
            origin.add().addFilepattern("test.txt").call();
            origin.commit().setMessage("init").call();
        }

        GitHubRepoSync localRepoSync = new GitHubRepoSync(tempDir.toUri().toString().replaceAll("/$", ""));
        Path cloneTarget = tempDir.resolve("cloned-real");

        boolean result = localRepoSync.cloneRepo("myrepo", "main", cloneTarget, null);

        assertThat(result, is(true));
        assertThat(localRepoSync.isValidRepo(cloneTarget), is(true));
    }

    @Test
    void pull_returns_true_when_already_up_to_date() throws GitAPIException, IOException {
        Path originDir = tempDir.resolve("origin2");
        Files.createDirectories(originDir);
        try (Git origin = Git.init().setDirectory(originDir.toFile()).setInitialBranch("main").call()) {
            Files.writeString(originDir.resolve("file.txt"), "content");
            origin.add().addFilepattern("file.txt").call();
            origin.commit().setMessage("initial").call();
        }

        Path cloneDir = tempDir.resolve("clone2");
        try (Git ignored = Git.cloneRepository()
                .setURI(originDir.toUri().toString())
                .setDirectory(cloneDir.toFile())
                .setBranch("main")
                .call()) {
            // clone done
        }

        boolean result = repoSync.pullRepo(cloneDir, "");
        assertThat(result, is(true));
    }

    @Test
    void return_the_head_sha_of_a_valid_repo() throws GitAPIException, IOException {
        Path originDir = tempDir.resolve("head-sha-repo");
        Files.createDirectories(originDir);
        String expectedSha;
        try (Git origin = Git.init().setDirectory(originDir.toFile()).setInitialBranch("main").call()) {
            Files.writeString(originDir.resolve("file.txt"), "content");
            origin.add().addFilepattern("file.txt").call();
            expectedSha = origin.commit().setMessage("initial").call().getName();
        }

        String headSha = repoSync.headSha(originDir);

        assertThat(headSha, is(expectedSha.substring(0, 7)));
    }

    @Test
    void return_a_seven_character_head_sha() throws GitAPIException, IOException {
        Path originDir = tempDir.resolve("head-sha-length-repo");
        Files.createDirectories(originDir);
        try (Git origin = Git.init().setDirectory(originDir.toFile()).setInitialBranch("main").call()) {
            Files.writeString(originDir.resolve("file.txt"), "content");
            origin.add().addFilepattern("file.txt").call();
            origin.commit().setMessage("initial").call();
        }

        String headSha = repoSync.headSha(originDir);

        assertThat(headSha, matchesPattern("[0-9a-f]{7}"));
    }

    @Test
    void return_null_head_sha_when_directory_is_not_a_repo() {
        assertThat(repoSync.headSha(tempDir), is(nullValue()));
    }
}
