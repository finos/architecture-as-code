package org.finos.calm.store.github.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class TestGitHubFileReaderShould {

    @Test
    void read_a_regular_file_within_the_namespace_directory(@TempDir Path cloneDirectory) throws IOException {
        Path namespaceRoot = cloneDirectory.resolve("finos");
        Files.createDirectories(namespaceRoot.resolve("architectures"));
        Files.writeString(namespaceRoot.resolve("architectures/a.json"), "{}");

        String content = GitHubFileReader.readContained(cloneDirectory.toString(), "finos",
                Path.of("architectures/a.json"));

        assertThat(content, equalTo("{}"));
    }

    @Test
    void reject_a_symlink_pointing_outside_its_own_namespace_directory(@TempDir Path cloneDirectory) throws IOException {
        assumeTrue(supportsSymlinks(cloneDirectory), "filesystem does not support symlinks");

        // Simulates the real-world attack: a repo committing a symlink that, once JGit
        // checks it out, points at a file outside the namespace's own clone directory -
        // here, a sibling namespace's clone, but the same check equally rejects a link to
        // an arbitrary host path like /proc/self/environ.
        Path namespaceRoot = cloneDirectory.resolve("finos");
        Files.createDirectories(namespaceRoot.resolve("standards"));

        Path otherNamespaceRoot = cloneDirectory.resolve("other-namespace");
        Files.createDirectories(otherNamespaceRoot);
        Path secretFile = otherNamespaceRoot.resolve("secret.txt");
        Files.writeString(secretFile, "service-token-or-other-secret");

        Path symlink = namespaceRoot.resolve("standards/leak.md");
        Files.createSymbolicLink(symlink, secretFile);

        NoSuchFileException e = assertThrows(NoSuchFileException.class, () ->
                GitHubFileReader.readContained(cloneDirectory.toString(), "finos",
                        Path.of("standards/leak.md")));
        assertThat(e.getFile(), equalTo(symlink.toString()));
    }

    @Test
    void reject_a_symlink_pointing_at_a_host_path_outside_the_clone_directory_entirely(@TempDir Path cloneDirectory) throws IOException {
        assumeTrue(supportsSymlinks(cloneDirectory), "filesystem does not support symlinks");

        Path namespaceRoot = cloneDirectory.resolve("finos");
        Files.createDirectories(namespaceRoot.resolve("standards"));

        Path outsideClonesEntirely = Files.createTempFile("github-file-reader-test", ".txt");
        Files.writeString(outsideClonesEntirely, "host secret");
        try {
            Path symlink = namespaceRoot.resolve("standards/leak.md");
            Files.createSymbolicLink(symlink, outsideClonesEntirely);

            assertThrows(NoSuchFileException.class, () ->
                    GitHubFileReader.readContained(cloneDirectory.toString(), "finos",
                            Path.of("standards/leak.md")));
        } finally {
            Files.deleteIfExists(outsideClonesEntirely);
        }
    }

    @Test
    void reject_a_missing_file(@TempDir Path cloneDirectory) throws IOException {
        Files.createDirectories(cloneDirectory.resolve("finos"));

        assertThrows(NoSuchFileException.class, () ->
                GitHubFileReader.readContained(cloneDirectory.toString(), "finos",
                        Path.of("standards/does-not-exist.md")));
    }

    @Test
    void existsContained_returns_false_for_a_symlink_escape(@TempDir Path cloneDirectory) throws IOException {
        assumeTrue(supportsSymlinks(cloneDirectory), "filesystem does not support symlinks");

        Path namespaceRoot = cloneDirectory.resolve("finos");
        Files.createDirectories(namespaceRoot.resolve("standards"));
        Path outside = cloneDirectory.resolve("outside.txt");
        Files.writeString(outside, "secret");
        Files.createSymbolicLink(namespaceRoot.resolve("standards/a.md"), outside);

        assertThat(GitHubFileReader.existsContained(cloneDirectory.toString(), "finos",
                Path.of("standards/a.md")), equalTo(false));
    }

    @Test
    void existsContained_returns_true_for_a_regular_contained_file(@TempDir Path cloneDirectory) throws IOException {
        Path namespaceRoot = cloneDirectory.resolve("finos");
        Files.createDirectories(namespaceRoot.resolve("standards"));
        Files.writeString(namespaceRoot.resolve("standards/a.md"), "content");

        assertThat(GitHubFileReader.existsContained(cloneDirectory.toString(), "finos",
                Path.of("standards/a.md")), equalTo(true));
    }

    private static boolean supportsSymlinks(Path dir) {
        try {
            Path link = dir.resolve("symlink-support-probe");
            Files.createSymbolicLink(link, dir);
            Files.delete(link);
            return true;
        } catch (IOException | UnsupportedOperationException e) {
            return false;
        }
    }
}
