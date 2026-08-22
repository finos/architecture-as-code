package org.finos.calm.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

@ApplicationScoped
public class GitHubMetrics {

    private final Counter syncSuccessCounter;
    private final Counter syncFailureCounter;
    private final Timer syncDurationTimer;
    private final Timer registryRebuildTimer;
    private final Counter sessionDecryptSuccessCounter;
    private final Counter sessionDecryptFailureCounter;
    private final AtomicLong lastSyncSuccessEpoch = new AtomicLong(0);

    @Inject
    public GitHubMetrics(MeterRegistry registry) {
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

        this.sessionDecryptSuccessCounter = Counter.builder("calm.github.session.decrypt")
                .tag("outcome", "success")
                .description("Number of successful session cookie decryptions")
                .register(registry);

        this.sessionDecryptFailureCounter = Counter.builder("calm.github.session.decrypt")
                .tag("outcome", "failure")
                .description("Number of failed session cookie decryptions")
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

    public void recordSessionDecryptSuccess() {
        sessionDecryptSuccessCounter.increment();
    }

    public void recordSessionDecryptFailure() {
        sessionDecryptFailureCounter.increment();
    }

    public Counter contentDetectedCounter(MeterRegistry registry, String type) {
        return Counter.builder("calm.github.content.detected")
                .tag("type", type)
                .description("Number of CALM documents detected by type")
                .register(registry);
    }
}
