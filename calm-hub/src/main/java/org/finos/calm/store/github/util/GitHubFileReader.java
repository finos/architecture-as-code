package org.finos.calm.store.github.util;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;

/**
 * Centralised, containment-checked file reads for the GitHub-backed stores.
 *
 * <p>Repo content is untrusted: anyone who can land a commit on a synced repo's
 * configured branch controls every path and file this reads. Without this guard, a
 * symlink tracked in the repo (JGit checks out POSIX symlinks by default, and nothing
 * in the clone/sync path overrides that) pointing outside the namespace's own clone
 * directory — at another namespace's clone, or at a host path like
 * {@code /proc/self/environ}, where {@code calm.github.service-token} lives in the
 * process environment — would otherwise be followed and served verbatim through the
 * public read API.
 *
 * <p>The check is against the real (symlink-resolved) location of the file actually
 * read, not the nominal path, and containment is verified against the SPECIFIC
 * namespace's own subdirectory — not just the overall {@code clone-directory} root.
 * A root-level-only check would still let a symlink into a <em>sibling</em>
 * namespace's clone pass, defeating that namespace's own {@code accessGroups}
 * restriction even though both directories sit under the same configured root.
 *
 * <p>This check runs at read time, not just at registry-scan time: the registry is
 * rebuilt only every {@code calm.github.sync-interval} seconds, so a symlink swapped
 * in between rebuilds (a TOCTOU window against {@code GitHubRepoSync}'s
 * {@code reset --hard}) would otherwise slip past a scan-time-only guard.
 */
public final class GitHubFileReader {

    private GitHubFileReader() {
    }

    /**
     * Reads {@code relativeFilePath} from within {@code cloneDirectory}/{@code namespace},
     * refusing to follow a symlink — direct or via an intermediate path component — that
     * would escape that namespace's own clone directory.
     *
     * @throws NoSuchFileException if the resolved target is a symlink, does not exist, or
     *                              its real path falls outside the namespace's clone directory
     * @throws IOException         if the read itself fails
     */
    public static String readContained(String cloneDirectory, String namespace, Path relativeFilePath) throws IOException {
        Path namespaceRoot = Path.of(cloneDirectory, namespace);
        Path target = namespaceRoot.resolve(relativeFilePath);
        if (!isContained(namespaceRoot, target)) {
            throw new NoSuchFileException(target.toString());
        }
        return Files.readString(target);
    }

    /**
     * Same containment guard as {@link #readContained}, without reading the file — for
     * call sites (e.g. an optional sibling file) that need to check existence first.
     */
    public static boolean existsContained(String cloneDirectory, String namespace, Path relativeFilePath) {
        Path namespaceRoot = Path.of(cloneDirectory, namespace);
        Path target = namespaceRoot.resolve(relativeFilePath);
        return Files.exists(target) && isContained(namespaceRoot, target);
    }

    private static boolean isContained(Path namespaceRoot, Path target) {
        // Reject a direct symlink target outright, regardless of where it points -
        // simplest and most defensible: repo content never legitimately needs to be a
        // symlink for any resource this reads.
        if (Files.isSymbolicLink(target)) {
            return false;
        }
        try {
            Path realRoot = namespaceRoot.toRealPath();
            Path realTarget = target.toRealPath();
            return realTarget.startsWith(realRoot);
        } catch (IOException e) {
            // Doesn't exist, or a component along the way doesn't resolve - not contained.
            return false;
        }
    }
}
