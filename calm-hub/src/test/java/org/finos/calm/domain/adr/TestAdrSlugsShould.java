package org.finos.calm.domain.adr;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.api.Test;

import java.util.stream.Stream;

import static org.finos.calm.resources.ResourceValidationConstants.CUSTOM_ID_REGEX;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.hamcrest.Matchers.nullValue;

class TestAdrSlugsShould {

    static Stream<Arguments> documentedTitles() {
        return Stream.of(
                Arguments.of("Use OAuth2", "use-oauth2"),
                Arguments.of("2024 Q1 Migration", "q1-migration"),
                Arguments.of("Use OAuth 2.0", "use-oauth-2-0"),
                Arguments.of("Adopt gRPC!", "adopt-grpc"),
                Arguments.of("API/gateway choice", "api-gateway-choice"),
                Arguments.of("Use Kafka (v3)", "use-kafka-v3"),
                Arguments.of("  ", null),
                Arguments.of("2024", null),
                Arguments.of("日本語", null)
        );
    }

    @ParameterizedTest
    @MethodSource("documentedTitles")
    void derive_the_documented_slug_for_each_title(String title, String expected) {
        String slug = AdrSlugs.derive(title);

        assertThat(slug, is(expected));
        if (slug != null) {
            assertThat(slug.matches(CUSTOM_ID_REGEX), is(true));
        }
    }

    @Test
    void return_null_for_a_null_title() {
        assertThat(AdrSlugs.derive(null), is(nullValue()));
    }

    @Test
    void truncate_a_long_title_at_a_hyphen_boundary() {
        String title = "Adopt a consistent naming convention for every internal service endpoint we expose";

        String slug = AdrSlugs.derive(title);

        assertThat(slug.length(), lessThanOrEqualTo(AdrSlugs.MAX_LENGTH));
        assertThat(slug, is("adopt-a-consistent-naming-convention-for-every-internal-service"));
        assertThat(slug.matches(CUSTOM_ID_REGEX), is(true));
    }

    @Test
    void cut_cleanly_when_the_limit_falls_just_before_a_hyphen() {
        String exact = "a".repeat(AdrSlugs.MAX_LENGTH);

        assertThat(AdrSlugs.derive(exact + " tail"), is(exact));
    }

    @Test
    void cut_a_single_overlong_word_hard_and_stay_valid() {
        String slug = AdrSlugs.derive("x".repeat(100));

        assertThat(slug.length(), is(AdrSlugs.MAX_LENGTH));
        assertThat(slug.matches(CUSTOM_ID_REGEX), is(true));
    }

    @Test
    void fall_back_to_the_numeric_id() {
        assertThat(AdrSlugs.fallback(42), is("adr-42"));
        assertThat(AdrSlugs.deriveOrFallback("2024", 42), is("adr-42"));
        assertThat(AdrSlugs.deriveOrFallback("Use OAuth2", 42), is("use-oauth2"));
    }

    @Test
    void spell_collision_suffixes_from_two() {
        assertThat(AdrSlugs.withSuffix("use-kafka", 1), is("use-kafka"));
        assertThat(AdrSlugs.withSuffix("use-kafka", 2), is("use-kafka-2"));
        assertThat(AdrSlugs.withSuffix("use-kafka", 3), is("use-kafka-3"));
    }

    @Test
    void validate_slugs_against_the_custom_id_pattern() {
        assertThat(AdrSlugs.isValid("use-kafka"), is(true));
        assertThat(AdrSlugs.isValid("1-use-kafka"), is(false));
        assertThat(AdrSlugs.isValid("use kafka"), is(false));
        assertThat(AdrSlugs.isValid(null), is(false));
    }
}
