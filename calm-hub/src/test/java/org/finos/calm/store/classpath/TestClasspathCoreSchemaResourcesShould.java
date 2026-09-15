package org.finos.calm.store.classpath;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.TreeSet;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Guards against drift between the canonical CALM schemas at ../calm/release and the
 * versions.txt / files.txt index files hand-authored under
 * src/main/resources/META-INF/calm-schemas/ (see pom.xml's calm-schemas resource
 * block, which copies the actual JSON content from ../calm/release at build time).
 * ClasspathCoreSchemaStoreShould exercises the store's read behaviour against a
 * separate test fixture (which intentionally shadows these production resources on
 * the test classpath), so it can't catch this drift itself - hence a dedicated test
 * reading the real build output and the source tree directly.
 */
class TestClasspathCoreSchemaResourcesShould {

    private static final Path RELEASE_ROOT = Path.of("..", "calm", "release");
    private static final Path BUILT_SCHEMAS_ROOT = Path.of("target", "classes", "META-INF", "calm-schemas");

    @Test
    void list_every_released_non_rc_version_in_versions_txt() throws IOException {
        assumeTrue(Files.isDirectory(BUILT_SCHEMAS_ROOT), "run `mvn process-resources` (or a full build) first");

        TreeSet<String> releasedVersions = new TreeSet<>();
        try (DirectoryStream<Path> dirs = Files.newDirectoryStream(RELEASE_ROOT, Files::isDirectory)) {
            for (Path dir : dirs) {
                String name = dir.getFileName().toString();
                if (!name.contains("-rc")) {
                    releasedVersions.add(name);
                }
            }
        }

        TreeSet<String> indexedVersions = new TreeSet<>(
                Files.readAllLines(BUILT_SCHEMAS_ROOT.resolve("versions.txt")));
        indexedVersions.removeIf(String::isBlank);

        assertThat(indexedVersions, equalTo(releasedVersions));
    }

    @Test
    void list_every_meta_json_file_for_each_indexed_version_in_its_files_txt() throws IOException {
        assumeTrue(Files.isDirectory(BUILT_SCHEMAS_ROOT), "run `mvn process-resources` (or a full build) first");

        for (String version : Files.readAllLines(BUILT_SCHEMAS_ROOT.resolve("versions.txt"))) {
            if (version.isBlank()) {
                continue;
            }

            TreeSet<String> onDisk = new TreeSet<>();
            try (DirectoryStream<Path> files = Files.newDirectoryStream(
                    RELEASE_ROOT.resolve(version).resolve("meta"), "*.json")) {
                for (Path file : files) {
                    onDisk.add(file.getFileName().toString());
                }
            }

            TreeSet<String> indexed = new TreeSet<>(
                    Files.readAllLines(BUILT_SCHEMAS_ROOT.resolve(version).resolve("files.txt")));
            indexed.removeIf(String::isBlank);

            assertThat("files.txt for version " + version, indexed, equalTo(onDisk));

            for (String fileName : indexed) {
                assertThat("build did not copy " + version + "/meta/" + fileName,
                        Files.exists(BUILT_SCHEMAS_ROOT.resolve(version).resolve("meta").resolve(fileName)),
                        equalTo(true));
            }
        }
    }
}
