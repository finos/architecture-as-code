package org.finos.calm.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

class TestGitHubMetricsShould {

    private SimpleMeterRegistry registry;
    private GitHubMetrics metrics;

    @BeforeEach
    void setup() {
        registry = new SimpleMeterRegistry();
        metrics = new GitHubMetrics(registry);
    }

    @Test
    void record_sync_success_counter() {
        metrics.recordSyncSuccess(Duration.ofSeconds(2));
        metrics.recordSyncSuccess(Duration.ofSeconds(1));

        Counter counter = registry.find("calm.github.sync").tag("outcome", "success").counter();
        assertThat(counter, is(notNullValue()));
        assertThat(counter.count(), equalTo(2.0));
    }

    @Test
    void record_sync_failure_counter() {
        metrics.recordSyncFailure(Duration.ofSeconds(5));

        Counter counter = registry.find("calm.github.sync").tag("outcome", "failure").counter();
        assertThat(counter, is(notNullValue()));
        assertThat(counter.count(), equalTo(1.0));
    }

    @Test
    void record_sync_duration_timer() {
        metrics.recordSyncSuccess(Duration.ofMillis(500));
        metrics.recordSyncFailure(Duration.ofMillis(1500));

        Timer timer = registry.find("calm.github.sync.duration").timer();
        assertThat(timer, is(notNullValue()));
        assertThat(timer.count(), equalTo(2L));
        assertThat(timer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS), closeTo(2000.0, 50.0));
    }

    @Test
    void record_registry_rebuild_duration() {
        metrics.recordRegistryRebuild(Duration.ofMillis(200));

        Timer timer = registry.find("calm.github.registry.rebuild.duration").timer();
        assertThat(timer, is(notNullValue()));
        assertThat(timer.count(), equalTo(1L));
    }

    @Test
    void update_last_sync_success_epoch_on_success() {
        long beforeEpoch = System.currentTimeMillis() / 1000;
        metrics.recordSyncSuccess(Duration.ofMillis(100));

        Gauge gauge = registry.find("calm.github.sync.last_success_epoch_seconds").gauge();
        assertThat(gauge, is(notNullValue()));
        assertThat((long) gauge.value(), greaterThan(beforeEpoch - 1));
    }

    @Test
    void not_update_last_sync_success_epoch_on_failure() {
        metrics.recordSyncFailure(Duration.ofMillis(100));

        Gauge gauge = registry.find("calm.github.sync.last_success_epoch_seconds").gauge();
        assertThat(gauge, is(notNullValue()));
        assertThat(gauge.value(), equalTo(0.0));
    }
}
