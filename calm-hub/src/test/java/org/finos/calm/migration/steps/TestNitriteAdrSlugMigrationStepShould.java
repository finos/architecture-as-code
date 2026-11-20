package org.finos.calm.migration.steps;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.exceptions.UniqueConstraintException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.dizitart.no2.filters.FluentFilter.where;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Runs against a real in-memory Nitrite database, since what matters here is what ends up
 * stored and whether Nitrite will accept the unique index afterwards.
 */
class TestNitriteAdrSlugMigrationStepShould {

    private Nitrite database;
    private NitriteCollection headers;
    private NitriteCollection versions;
    private NitriteAdrSlugMigrationStep step;

    @BeforeEach
    void setup() {
        database = Nitrite.builder().openOrCreate();
        headers = database.getCollection("adrs");
        versions = database.getCollection("adrVersions");
        step = new NitriteAdrSlugMigrationStep(database);
    }

    @AfterEach
    void close() {
        database.close();
    }

    private void adr(String namespace, int adrId, String slug, String... titlesByRevision) {
        Document header = Document.createDocument().put("namespace", namespace).put("adrId", adrId);
        if (slug != null) {
            header.put("slug", slug);
        }
        headers.insert(header);
        for (int revision = 1; revision <= titlesByRevision.length; revision++) {
            String title = titlesByRevision[revision - 1];
            if (title == null) {
                continue;
            }
            versions.insert(Document.createDocument().put("namespace", namespace).put("adrId", adrId)
                    .put("version", String.valueOf(revision)).put("content", "{\"title\":\"" + title + "\"}"));
        }
    }

    private Map<String, String> slugs() {
        Map<String, String> slugs = new HashMap<>();
        for (Document header : headers.find()) {
            slugs.put(header.get("namespace", String.class) + "/" + header.get("adrId", Integer.class),
                    header.get("slug", String.class));
        }
        return slugs;
    }

    @Test
    void run_at_schema_version_sixteen() {
        assertThat(step.fromVersion(), is(16));
    }

    @Test
    void derive_slugs_from_revision_one_and_suffix_collisions_in_id_order() {
        // Inserted out of order: the step must not depend on storage order.
        adr("finos", 3, null, "use kafka");
        adr("finos", 1, null, "Use Kafka", "Renamed Later");
        adr("finos", 2, null, "Use Kafka!");
        adr("other", 4, null, "Use Kafka");

        step.apply();

        assertThat(slugs(), is(Map.of(
                "finos/1", "use-kafka", "finos/2", "use-kafka-2", "finos/3", "use-kafka-3", "other/4", "use-kafka")));
    }

    @Test
    void be_idempotent_and_keep_existing_slugs() {
        adr("finos", 1, null, "Use Kafka");
        adr("finos", 2, "use-kafka", "Something Else");

        step.apply();
        Map<String, String> first = slugs();
        step.apply();

        assertThat(first, is(Map.of("finos/1", "use-kafka-2", "finos/2", "use-kafka")));
        assertThat(slugs(), is(first));
    }

    @Test
    void fall_back_to_the_earliest_revision_then_to_the_numeric_id() {
        adr("finos", 1, null, null, "Second Revision Title");
        adr("finos", 2, null);
        adr("finos", 3, null, "2024");
        versions.insert(Document.createDocument().put("namespace", "finos").put("adrId", 4)
                .put("version", "1").put("content", "not json"));
        headers.insert(Document.createDocument().put("namespace", "finos").put("adrId", 4));

        step.backfill();

        assertThat(slugs(), is(Map.of(
                "finos/1", "second-revision-title", "finos/2", "adr-2", "finos/3", "adr-3", "finos/4", "adr-4")));
    }

    @Test
    void create_a_unique_index_that_refuses_a_duplicate_slug() {
        adr("finos", 1, null, "Use Kafka");

        step.apply();

        assertThat(headers.hasIndex("namespace", "slug"), is(true));
        assertThrows(UniqueConstraintException.class, () -> headers.insert(
                Document.createDocument().put("namespace", "finos").put("adrId", 2).put("slug", "use-kafka")));
    }

    @Test
    void not_create_the_index_while_a_header_has_no_slug() {
        adr("finos", 1, null, "Use Kafka");
        headers.insert(Document.createDocument().put("adrId", 9));

        step.apply();

        assertThat(headers.hasIndex("namespace", "slug"), is(false));
        assertThat(headers.find(where("adrId").eq(9)).firstOrNull().get("slug", String.class) == null, is(true));
    }
}
