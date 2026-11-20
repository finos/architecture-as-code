package org.finos.calm.store.util;

import org.finos.calm.domain.exception.AdrSlugExistsException;
import org.finos.calm.domain.exception.StorageWriteException;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestAdrSlugAllocatorShould {

    @Test
    void claim_a_valid_requested_slug() throws Exception {
        Set<String> taken = new HashSet<>();

        assertThat(AdrSlugAllocator.allocate("my-slug", "Use Kafka", 1, taken::add), is("my-slug"));
        assertThat(taken, is(Set.of("my-slug")));
    }

    @Test
    void refuse_a_requested_slug_that_is_taken() {
        Set<String> taken = new HashSet<>(Set.of("my-slug"));

        assertThrows(AdrSlugExistsException.class,
                () -> AdrSlugAllocator.allocate("my-slug", "Use Kafka", 1, taken::add));
    }

    @Test
    void derive_from_the_title_when_the_requested_slug_is_invalid_or_absent() throws Exception {
        Set<String> taken = new HashSet<>();

        assertThat(AdrSlugAllocator.allocate("not a slug", "Use Kafka", 1, taken::add), is("use-kafka"));
        assertThat(AdrSlugAllocator.allocate(null, "Use Kafka", 2, taken::add), is("use-kafka-2"));
        assertThat(AdrSlugAllocator.allocate(null, "Use Kafka", 3, taken::add), is("use-kafka-3"));
        assertThat(AdrSlugAllocator.allocate(null, "2024", 4, taken::add), is("adr-4"));
    }

    @Test
    void give_up_when_no_candidate_can_be_claimed() {
        assertThrows(StorageWriteException.class,
                () -> AdrSlugAllocator.allocateDerived("Use Kafka", 1, slug -> false));
    }
}
