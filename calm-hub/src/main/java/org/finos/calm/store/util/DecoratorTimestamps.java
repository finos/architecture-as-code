package org.finos.calm.store.util;

import java.time.Clock;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * The Hub-owned decorator times, as UTC ISO-8601 strings with millisecond precision, for example
 * {@code 2026-11-06T10:15:30.123Z}. Both stores keep them as strings, so they read back the same.
 */
public final class DecoratorTimestamps {

    public static final String CREATION_DATE_TIME_FIELD = "creationDateTime";
    public static final String UPDATE_DATE_TIME_FIELD = "updateDateTime";
    public static final String SUPERSEDED_DATE_TIME_FIELD = "supersededDateTime";

    private static final DateTimeFormatter FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private DecoratorTimestamps() {
    }

    public static String now() {
        return now(Clock.systemUTC());
    }

    static String now(Clock clock) {
        return FORMAT.format(clock.instant());
    }
}
