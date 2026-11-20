package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.index.IndexOptions;
import org.dizitart.no2.index.IndexType;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.AdrSlugMapping;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrSlugExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Slug behaviour against a real in-memory Nitrite database, since the guarantee under test
 * (no two ADRs in a namespace share a slug) depends on the write path, not on mocked reads.
 */
class TestNitriteAdrStoreSlugsShould {

    private static final String NAMESPACE = "finos";
    private static final int WRITERS = 8;

    private Nitrite database;
    private NitriteNamespaceStore namespaceStore;
    private NitriteCounterStore counterStore;
    private NitriteAdrStore store;
    private final AtomicInteger nextId = new AtomicInteger(1);

    @BeforeEach
    void setup() throws NamespaceNotFoundException {
        database = Nitrite.builder().openOrCreate();
        namespaceStore = mock(NitriteNamespaceStore.class);
        counterStore = mock(NitriteCounterStore.class);
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);
        when(counterStore.getNextAdrSequenceValue()).thenAnswer(invocation -> nextId.getAndIncrement());
        store = new NitriteAdrStore(database, namespaceStore, counterStore);
    }

    @AfterEach
    void close() {
        database.close();
    }

    private static AdrMeta newAdr(String title, String requestedSlug) {
        return new AdrMeta.AdrMetaBuilder()
                .setNamespace(NAMESPACE)
                .setSlug(requestedSlug)
                .setRevision(1)
                .setAdr(new Adr.AdrBuilder().setTitle(title).setStatus(Status.draft).build())
                .build();
    }

    @Test
    void give_colliding_titles_suffixed_slugs_in_creation_order() throws Exception {
        assertThat(store.createAdrForNamespace(newAdr("Use Kafka", null)).getSlug(), is("use-kafka"));
        assertThat(store.createAdrForNamespace(newAdr("Use Kafka", null)).getSlug(), is("use-kafka-2"));
        assertThat(store.createAdrForNamespace(newAdr("Use Kafka!", null)).getSlug(), is("use-kafka-3"));
        assertThat(store.createAdrForNamespace(newAdr("2024", null)).getSlug(), is("adr-4"));

        assertThat(store.getAdrSlugs(NAMESPACE), contains(
                new AdrSlugMapping("use-kafka", 1), new AdrSlugMapping("use-kafka-2", 2),
                new AdrSlugMapping("use-kafka-3", 3), new AdrSlugMapping("adr-4", 4)));
        assertThat(store.getAdrIdBySlug(NAMESPACE, "use-kafka-2"), is(2));
    }

    @Test
    void refuse_a_requested_slug_that_is_taken_and_create_nothing() throws Exception {
        store.createAdrForNamespace(newAdr("Use Kafka", "events"));

        assertThrows(AdrSlugExistsException.class, () -> store.createAdrForNamespace(newAdr("Other", "events")));
        assertThat(store.countAdrsForNamespace(NAMESPACE), is(1));
    }

    @Test
    void return_the_slug_on_reads_writes_and_summaries() throws Exception {
        AdrMeta created = store.createAdrForNamespace(newAdr("Use Kafka", null));
        AdrMeta key = new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE).setId(created.getId()).setRevision(1).build();

        assertThat(store.getAdr(key).getSlug(), is("use-kafka"));
        assertThat(store.getAdrRevision(key).getSlug(), is("use-kafka"));
        AdrMeta revised = store.createAdrRevision(new AdrMeta.AdrMetaBuilder(key)
                .setAdr(new Adr.AdrBuilder().setTitle("Renamed").setStatus(Status.accepted).build()).build());
        assertThat(revised.getSlug(), is("use-kafka"));
        assertThat(revised.getAdr().getStatus(), is(Status.accepted));
        assertThat(store.updateAdrStatus(key, Status.rejected).getSlug(), is("use-kafka"));
        // The slug is immutable: a later title does not move it.
        assertThat(store.getAdrsForNamespace(NAMESPACE),
                contains(new NamespaceAdrSummary("Renamed", "rejected", created.getId(), "use-kafka")));
    }

    @Test
    void throw_for_an_unknown_slug_or_namespace() {
        assertThrows(AdrNotFoundException.class, () -> store.getAdrIdBySlug(NAMESPACE, "missing"));
        assertThrows(NamespaceNotFoundException.class, () -> store.getAdrIdBySlug("other", "missing"));
        assertThrows(NamespaceNotFoundException.class, () -> store.getAdrSlugs("other"));
    }

    @Test
    void give_concurrent_creates_with_the_same_title_distinct_slugs() throws Exception {
        List<String> slugs = createConcurrently(store, store);

        assertThat(new HashSet<>(slugs).size(), is(WRITERS));
        assertThat(slugs, containsInAnyOrder(expectedSlugs().toArray()));
    }

    @Test
    void let_the_unique_index_stop_a_writer_that_does_not_share_the_lock() throws Exception {
        // A second store instance has its own lock, like a second process on the same file.
        // Only the unique index the migration creates keeps the two apart.
        database.getCollection("adrs").createIndex(IndexOptions.indexOptions(IndexType.UNIQUE), "namespace", "slug");
        NitriteAdrStore otherWriter = new NitriteAdrStore(database, namespaceStore, counterStore);

        List<String> slugs = createConcurrently(store, otherWriter);

        assertThat(new HashSet<>(slugs).size(), is(WRITERS));
        List<String> stored = new ArrayList<>();
        for (Document header : database.getCollection("adrs").find()) {
            stored.add(header.get("slug", String.class));
        }
        assertThat(stored, containsInAnyOrder(expectedSlugs().toArray()));
    }

    private static List<String> expectedSlugs() {
        List<String> expected = new ArrayList<>(List.of("use-kafka"));
        for (int n = 2; n <= WRITERS; n++) {
            expected.add("use-kafka-" + n);
        }
        return expected;
    }

    private List<String> createConcurrently(NitriteAdrStore first, NitriteAdrStore second) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(WRITERS);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<String>> futures = new ArrayList<>();
            for (int i = 0; i < WRITERS; i++) {
                NitriteAdrStore writer = i % 2 == 0 ? first : second;
                Callable<String> create = () -> {
                    start.await();
                    return writer.createAdrForNamespace(newAdr("Use Kafka", null)).getSlug();
                };
                futures.add(executor.submit(create));
            }
            start.countDown();
            List<String> slugs = new ArrayList<>();
            for (Future<String> future : futures) {
                slugs.add(future.get(30, TimeUnit.SECONDS));
            }
            return slugs;
        } finally {
            executor.shutdownNow();
        }
    }
}
