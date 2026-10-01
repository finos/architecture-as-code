package org.finos.calm.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

@ApplicationScoped
public class GitHubMetrics {

    private final Counter syncSuccessCounter;
    private final Counter syncFailureCounter;
    private final Timer syncDurationTimer;
    private final Timer registryRebuildTimer;
    private final AtomicLong lastSyncSuccessEpoch = new AtomicLong(0);

    // quarkus.micrometer.enabled is build-time-fixed and disabled under every custom
    // test profile in this module (see application.properties), so no MeterRegistry
    // bean exists while running plain unit tests. Instance<T> — unlike injecting
    // MeterRegistry directly — defers resolution to runtime instead of failing CDI's
    // build-time validation, and falls back to an unregistered in-memory registry so
    // this bean still works there, it just doesn't export anything.
    @Inject
    public GitHubMetrics(Instance<MeterRegistry> registryInstance) {
        this(registryInstance.isResolvable() ? registryInstance.get() : new SimpleMeterRegistry());
    }

    // Package-private: lets tests supply a MeterRegistry directly.
    GitHubMetrics(MeterRegistry registry) {
        this.syncSuccessCounter = Counter.builder("calm.github.sync")
                .tag("outcome", "success")
                .description("Number of successful GitHub sync operations")
                .register(registry);

        this.syncFailureCounter = Counter.builder("calm.github.sync")
                .tag("outcome", "failure")
                .description("Number of failed GitHub sync operations")
                .register(registry);

        this.syncDurationTimer = Timer.builder("calm.github.sync.duration")
                .description("Duration of GitHub sync operations")
                .register(registry);

        this.registryRebuildTimer = Timer.builder("calm.github.registry.rebuild.duration")
                .description("Duration of in-memory registry rebuilds")
                .register(registry);

        registry.gauge("calm.github.sync.last_success_epoch_seconds", lastSyncSuccessEpoch);
    }

    public void recordSyncSuccess(Duration duration) {
        syncSuccessCounter.increment();
        syncDurationTimer.record(duration);
        lastSyncSuccessEpoch.set(System.currentTimeMillis() / 1000);
    }

    public void recordSyncFailure(Duration duration) {
        syncFailureCounter.increment();
        syncDurationTimer.record(duration);
    }

    public void recordRegistryRebuild(Duration duration) {
        registryRebuildTimer.record(duration);
    }
}
