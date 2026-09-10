package org.finos.calm.store.github.access;

import org.finos.calm.store.github.config.GitHubStoreConfig;
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

class TestNamespaceFileReaderShould {

    private static NamespaceFileReader readerFor(Path cloneDirectory) {
        return new NamespaceFileReader(new GitHubStoreConfig("", cloneDirectory.toString(), "https://api.github.com"));
    }

    @Test
    void read_a_regular_file_within_the_namespace_directory(@TempDir Path cloneDirectory) throws IOException {
        Path namespaceRoot = cloneDirectory.resolve("finos");
        Files.createDirectories(namespaceRoot.resolve("architectures"));
        Files.writeString(namespaceRoot.resolve("architectures/a.json"), "{}");

        String content = readerFor(cloneDirectory).readContained("finos", Path.of("architectures/a.json"));

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
                readerFor(cloneDirectory).readContained("finos", Path.of("standards/leak.md")));
        assertThat(e.getFile(), equalTo(symlink.toString()));
    }

    @Test
    void reject_a_symlink_pointing_at_a_host_path_outside_the_clone_directory_entirely(@TempDir Path cloneDirectory) throws IOException {
        assumeTrue(supportsSymlinks(cloneDirectory), "filesystem does not support symlinks");

        Path namespaceRoot = cloneDirectory.resolve("finos");
        Files.createDirectories(namespaceRoot.resolve("standards"));

        Path outsideClonesEntirely = Files.createTempFile("namespace-file-reader-test", ".txt");
        Files.writeString(outsideClonesEntirely, "host secret");
        try {
            Path symlink = namespaceRoot.resolve("standards/leak.md");
            Files.createSymbolicLink(symlink, outsideClonesEntirely);

            assertThrows(NoSuchFileException.class, () ->
                    readerFor(cloneDirectory).readContained("finos", Path.of("standards/leak.md")));
        } finally {
            Files.deleteIfExists(outsideClonesEntirely);
        }
    }

    @Test
    void reject_a_regular_file_reached_through_a_symlinked_intermediate_directory(
            @TempDir Path cloneDirectory) throws IOException {
        assumeTrue(supportsSymlinks(cloneDirectory), "filesystem does not support symlinks");

        // The leaf itself is a regular file - isSymbolicLink(target) is false here -
        // so only the toRealPath().startsWith(realRoot) containment check catches
        // this. Simulates a repo committing "standards" as a symlink to a directory
        // outside the namespace's own clone (e.g. a sibling namespace's clone), with
        // real files inside it.
        Path namespaceRoot = cloneDirectory.resolve("finos");
        Files.createDirectories(namespaceRoot);

        Path otherNamespaceRoot = cloneDirectory.resolve("other-namespace");
        Files.createDirectories(otherNamespaceRoot.resolve("standards"));
        Path secretFile = otherNamespaceRoot.resolve("standards/leak.md");
        Files.writeString(secretFile, "service-token-or-other-secret");

        Files.createSymbolicLink(namespaceRoot.resolve("standards"), otherNamespaceRoot.resolve("standards"));

        assertThrows(NoSuchFileException.class, () ->
                readerFor(cloneDirectory).readContained("finos", Path.of("standards/leak.md")));
    }

    @Test
    void reject_a_missing_file(@TempDir Path cloneDirectory) throws IOException {
        Files.createDirectories(cloneDirectory.resolve("finos"));

        assertThrows(NoSuchFileException.class, () ->
                readerFor(cloneDirectory).readContained("finos", Path.of("standards/does-not-exist.md")));
    }

    @Test
    void existsContained_returns_false_for_a_symlink_escape(@TempDir Path cloneDirectory) throws IOException {
        assumeTrue(supportsSymlinks(cloneDirectory), "filesystem does not support symlinks");

        Path namespaceRoot = cloneDirectory.resolve("finos");
        Files.createDirectories(namespaceRoot.resolve("standards"));
        Path outside = cloneDirectory.resolve("outside.txt");
        Files.writeString(outside, "secret");
        Files.createSymbolicLink(namespaceRoot.resolve("standards/a.md"), outside);

        assertThat(readerFor(cloneDirectory).existsContained("finos", Path.of("standards/a.md")), equalTo(false));
    }

    @Test
    void existsContained_returns_true_for_a_regular_contained_file(@TempDir Path cloneDirectory) throws IOException {
        Path namespaceRoot = cloneDirectory.resolve("finos");
        Files.createDirectories(namespaceRoot.resolve("standards"));
        Files.writeString(namespaceRoot.resolve("standards/a.md"), "content");

        assertThat(readerFor(cloneDirectory).existsContained("finos", Path.of("standards/a.md")), equalTo(true));
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
