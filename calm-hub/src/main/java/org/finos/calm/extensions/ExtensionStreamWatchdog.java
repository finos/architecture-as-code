package org.finos.calm.extensions;

import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Closes each extension stream at its maximum time, also a stream that Hub never writes (ADR 0011). Hub owns its
 * thread: the watchdog starts and stops with the application, and a stop closes every stream that is still open.
 */
@ApplicationScoped
public class ExtensionStreamWatchdog {

    private final Map<ExtensionEventStream, ScheduledFuture<?>> open = new ConcurrentHashMap<>();
    private ScheduledThreadPoolExecutor executor;

    void onStart(@Observes StartupEvent event) {
        start();
    }

    void onStop(@Observes ShutdownEvent event) {
        stop();
    }

    /** A watchdog that runs until {@link #stop}, for code that Hub does not start, such as a unit test. */
    static ExtensionStreamWatchdog started() {
        ExtensionStreamWatchdog watchdog = new ExtensionStreamWatchdog();
        watchdog.start();
        return watchdog;
    }

    synchronized void start() {
        if (executor == null) {
            executor = new ScheduledThreadPoolExecutor(1, task -> {
                Thread thread = new Thread(task, "extension-stream-watchdog");
                thread.setDaemon(true);
                return thread;
            });
            // A closed stream cancels its expiry, so the queue holds only open streams.
            executor.setRemoveOnCancelPolicy(true);
        }
    }

    /** Stops the thread and closes each open stream, which frees its slot and cancels its backend call. */
    void stop() {
        ScheduledThreadPoolExecutor stopping;
        synchronized (this) {
            stopping = executor;
            executor = null;
        }
        if (stopping != null) {
            stopping.shutdownNow();
            try {
                // So that no thread of this application outlives it.
                stopping.awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        open.keySet().forEach(ExtensionEventStream::close);
    }

    /** Closes {@code stream} after {@code delayNanos}. False when the watchdog is stopped, so the stream must close. */
    synchronized boolean watch(ExtensionEventStream stream, long delayNanos) {
        if (executor == null) {
            return false;
        }
        open.put(stream, executor.schedule(stream::expire, delayNanos, TimeUnit.NANOSECONDS));
        return true;
    }

    /** Synchronized with {@link #watch}, so that a stream that expires at once does not stay in {@code open}. */
    synchronized void forget(ExtensionEventStream stream) {
        ScheduledFuture<?> expiry = open.remove(stream);
        if (expiry != null) {
            expiry.cancel(false);
        }
    }

    /** The streams that the watchdog will close. For tests: it must go back to 0. */
    int watched() {
        return open.size();
    }
}
