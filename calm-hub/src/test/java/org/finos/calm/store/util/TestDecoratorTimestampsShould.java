package org.finos.calm.store.util;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

class TestDecoratorTimestampsShould {

    @Test
    void format_the_time_in_utc_with_milliseconds() {
        Clock clock = Clock.fixed(Instant.parse("2026-11-06T10:15:30.123456Z"), ZoneId.of("Asia/Tokyo"));

        assertThat(DecoratorTimestamps.now(clock), is("2026-11-06T10:15:30.123Z"));
    }

    @Test
    void keep_the_milliseconds_when_they_are_zero() {
        Clock clock = Clock.fixed(Instant.parse("2026-11-06T10:15:30Z"), ZoneId.of("UTC"));

        assertThat(DecoratorTimestamps.now(clock), is("2026-11-06T10:15:30.000Z"));
    }
}
