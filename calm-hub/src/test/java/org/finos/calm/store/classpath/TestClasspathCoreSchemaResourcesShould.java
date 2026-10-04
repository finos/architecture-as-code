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
 * Guards against drift between the versions.txt / files.txt index files hand-authored under
 * src/main/resources/META-INF/calm-schemas/ and the meta-schemas that the build copies from
 * the @finos/calm-schema npm packages into target/calm-schemas (see pom.xml's calm-schemas
 * resource block). When the root package.json adds a release, this test fails until the
 * index files list it. TestClasspathCoreSchemaStoreShould uses a test fixture that shadows
 * these resources on the test classpath, so it cannot catch this drift.
 */
class TestClasspathCoreSchemaResourcesShould {

    private static final Path COPIED_RELEASE_ROOT = Path.of("target", "calm-schemas", "release");
    private static final Path BUILT_SCHEMAS_ROOT = Path.of("target", "classes", "META-INF", "calm-schemas");

    @Test
    void list_every_copied_version_in_versions_txt() throws IOException {
        assumeSchemasBuilt();

        TreeSet<String> copiedVersions = new TreeSet<>();
        try (DirectoryStream<Path> dirs = Files.newDirectoryStream(COPIED_RELEASE_ROOT, Files::isDirectory)) {
            for (Path dir : dirs) {
                copiedVersions.add(dir.getFileName().toString());
            }
        }

        TreeSet<String> indexedVersions = new TreeSet<>(
                Files.readAllLines(BUILT_SCHEMAS_ROOT.resolve("versions.txt")));
        indexedVersions.removeIf(String::isBlank);

        assertThat(indexedVersions, equalTo(copiedVersions));
    }

    @Test
    void list_every_meta_json_file_for_each_indexed_version_in_its_files_txt() throws IOException {
        assumeSchemasBuilt();

        for (String version : Files.readAllLines(BUILT_SCHEMAS_ROOT.resolve("versions.txt"))) {
            if (version.isBlank()) {
                continue;
            }

            TreeSet<String> copied = new TreeSet<>();
            try (DirectoryStream<Path> files = Files.newDirectoryStream(
                    COPIED_RELEASE_ROOT.resolve(version).resolve("meta"), "*.json")) {
                for (Path file : files) {
                    copied.add(file.getFileName().toString());
                }
            }

            TreeSet<String> indexed = new TreeSet<>(
                    Files.readAllLines(BUILT_SCHEMAS_ROOT.resolve(version).resolve("files.txt")));
            indexed.removeIf(String::isBlank);

            assertThat("files.txt for version " + version, indexed, equalTo(copied));

            for (String fileName : indexed) {
                assertThat("build did not bundle " + version + "/meta/" + fileName,
                        Files.exists(BUILT_SCHEMAS_ROOT.resolve(version).resolve("meta").resolve(fileName)),
                        equalTo(true));
            }
        }
    }

    // -Pserver-only and -Dskip.npm do not copy the schemas.
    private static void assumeSchemasBuilt() {
        assumeTrue(Files.isDirectory(COPIED_RELEASE_ROOT) && Files.isDirectory(BUILT_SCHEMAS_ROOT),
                "run a full build (without -Pserver-only or -Dskip.npm) first");
    }
}
