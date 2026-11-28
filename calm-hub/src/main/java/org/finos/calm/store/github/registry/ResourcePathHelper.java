package org.finos.calm.store.github.registry;

import java.nio.file.Path;
import java.util.Set;

/**
 * Derives the stable identity parts of a resource from its path within a namespace clone.
 *
 * <p>The filename before the first dot is the stem, the parent folders are the path, and the token
 * between the first and last dot of a compound extension is the variant. The first known type
 * folder is removed from the path so the same document resolves whether a repository stores it at
 * {@code patterns/foo.calm.json} or {@code team/patterns/foo.calm.json}.</p>
 */
public final class ResourcePathHelper {

    private static final Set<String> KNOWN_TYPE_DIRECTORIES = Set.of(
            "architectures", "patterns", "standards", "standard-nodes", "controls",
            "adrs", "flows", "interfaces", "timelines", "decorators");

    private ResourcePathHelper() {
    }

    /** The first known type folder in the path, or the immediate parent folder when none is known. */
    public static String typeRoot(Path relativePath) {
        if (relativePath == null) {
            return null;
        }
        for (int i = 0; i < relativePath.getNameCount() - 1; i++) {
            String segment = relativePath.getName(i).toString().toLowerCase();
            if (KNOWN_TYPE_DIRECTORIES.contains(segment)) {
                return segment;
            }
        }
        Path parent = relativePath.getParent();
        return parent == null || parent.getFileName() == null ? null : parent.getFileName().toString();
    }

    /** Slash-joined parent folders, without the first known type folder. {@code null} when none remain. */
    public static String path(Path relativePath) {
        if (relativePath == null || relativePath.getNameCount() < 2) {
            return null;
        }
        StringBuilder result = new StringBuilder();
        boolean typeRemoved = false;
        for (int i = 0; i < relativePath.getNameCount() - 1; i++) {
            String segment = relativePath.getName(i).toString();
            if (!typeRemoved && KNOWN_TYPE_DIRECTORIES.contains(segment.toLowerCase())) {
                typeRemoved = true;
                continue;
            }
            if (result.length() > 0) {
                result.append('/');
            }
            result.append(segment);
        }
        return result.length() == 0 ? null : result.toString();
    }

    /** The filename stem: everything before the first dot. */
    public static String stem(Path relativePath) {
        if (relativePath == null || relativePath.getFileName() == null) {
            return null;
        }
        String fileName = relativePath.getFileName().toString();
        int firstDot = fileName.indexOf('.');
        return firstDot > 0 ? fileName.substring(0, firstDot) : fileName;
    }

    /** The compound-extension token between the first and last dot; {@code null} for a single extension. */
    public static String variant(Path relativePath) {
        if (relativePath == null || relativePath.getFileName() == null) {
            return null;
        }
        String fileName = relativePath.getFileName().toString();
        int firstDot = fileName.indexOf('.');
        int lastDot = fileName.lastIndexOf('.');
        return firstDot > 0 && firstDot < lastDot ? fileName.substring(firstDot + 1, lastDot) : null;
    }
}
