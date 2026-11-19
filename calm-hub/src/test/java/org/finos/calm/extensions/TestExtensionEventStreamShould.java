package org.finos.calm.extensions;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.startsWith;

class TestExtensionEventStreamShould {

    private final AtomicInteger released = new AtomicInteger();
    private final RecordingSubscription subscription = new RecordingSubscription();
    private final ExtensionStreamWatchdog watchdog = ExtensionStreamWatchdog.started();

    @AfterEach
    void stopWatchdog() {
        watchdog.stop();
    }

    /** Counts the parts that the stream asks for, and whether it cancelled the backend call. */
    private static final class RecordingSubscription implements Flow.Subscription {
        private volatile int requested;
        private volatile boolean cancelled;

        @Override
        public void request(long n) {
            requested += (int) n;
        }

        @Override
        public void cancel() {
            cancelled = true;
        }
    }

    private ExtensionEventStream stream(ExtensionLimits limits, java.util.function.Predicate<ExtensionEventStream.Event> filter) {
        ExtensionEventStream stream = new ExtensionEventStream("knowledge", "chat", limits, filter, Set.of(),
                released::incrementAndGet, watchdog, Duration.ofMillis(20));
        stream.onSubscribe(subscription);
        return stream;
    }

    private static ExtensionLimits limits(int maxBytes, Duration idle, Duration max) {
        return new ExtensionLimits(Duration.ofSeconds(1), Duration.ofSeconds(1), 1024, maxBytes, 4, 2, 2, 2, idle, max);
    }

    private static List<ByteBuffer> part(String text) {
        return List.of(ByteBuffer.wrap(text.getBytes(StandardCharsets.UTF_8)));
    }

    private static String written(ExtensionEventStream stream) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        stream.writeTo(out);
        return out.toString(StandardCharsets.UTF_8);
    }

    @Test
    void write_each_event_again_with_only_its_name_and_data() {
        ExtensionEventStream stream = stream(limits(1024, Duration.ofSeconds(5), Duration.ofSeconds(5)), event -> true);
        stream.onNext(part("\uFEFFid: 7\r\nretry: 1\r\nevent: delta\r\ndata: {\"text\":\r\ndata: \"a\"}\r\n\r\n: comment\n\n"));
        stream.onNext(part("data: plain\n\nevent: bad name\ndata: x\n\nevent: done\ndata\n\n"));
        stream.onComplete();

        assertThat(written(stream), equalTo("event: delta\ndata: {\"text\":\ndata: \"a\"}\n\ndata: plain\n\nevent: done\ndata: \n\n"));
        assertThat(subscription.requested, is(3));
        assertThat(released.get(), is(1));
    }

    @Test
    void read_an_event_that_two_parts_split_also_between_cr_and_lf() {
        ExtensionEventStream stream = stream(limits(1024, Duration.ofSeconds(5), Duration.ofSeconds(5)), event -> true);
        byte[] bytes = "event: delta\r\ndata: {\"text\":\"é\"}\r\n\r\n".getBytes(StandardCharsets.UTF_8);
        stream.onNext(List.of(ByteBuffer.wrap(bytes, 0, 13)));
        stream.onNext(List.of(ByteBuffer.wrap(bytes, 13, 10), ByteBuffer.wrap(bytes, 23, bytes.length - 23)));
        stream.onComplete();

        assertThat(written(stream), equalTo("event: delta\ndata: {\"text\":\"é\"}\n\n"));
    }

    @Test
    void leave_out_an_event_that_the_filter_refuses() {
        ExtensionEventStream stream = stream(limits(1024, Duration.ofSeconds(5), Duration.ofSeconds(5)),
                event -> !event.name().equals("citation"));
        stream.onNext(part("event: citation\ndata: {}\n\nevent: done\ndata: {}\n\n"));
        stream.onComplete();

        assertThat(written(stream), equalTo("event: done\ndata: {}\n\n"));
    }

    @Test
    void end_with_an_error_event_and_cancel_the_backend_when_the_reply_is_too_large() {
        ExtensionEventStream stream = stream(limits(40, Duration.ofSeconds(5), Duration.ofSeconds(5)), event -> true);
        stream.onNext(part("event: delta\ndata: {\"text\":\"one\"}\n\n"));
        stream.onNext(part("event: delta\ndata: {\"text\":\"two\"}\n\n"));

        assertThat(written(stream), equalTo("event: delta\ndata: {\"text\":\"one\"}\n\n"
                + "event: error\ndata: {\"message\":\"The extension reply is too large\"}\n\n"));
        assertThat(subscription.cancelled, is(true));
        assertThat(released.get(), is(1));
    }

    @Test
    void end_with_an_error_event_when_the_backend_is_silent_for_the_idle_timeout_and_send_comments_while_it_waits() {
        ExtensionEventStream stream = stream(limits(1024, Duration.ofMillis(150), Duration.ofSeconds(5)), event -> true);
        stream.onNext(part("event: delta\ndata: {\"text\":\"a\"}\n\n"));

        String text = written(stream);

        assertThat(text, startsWith("event: delta\ndata: {\"text\":\"a\"}\n\n:\n"));
        assertThat(text.endsWith("event: error\ndata: {\"message\":\"The extension stopped replying\"}\n\n"), is(true));
        assertThat(subscription.cancelled, is(true));
    }

    @Test
    void end_with_an_error_event_at_the_maximum_time_also_while_events_arrive() throws Exception {
        ExtensionEventStream stream = stream(limits(1 << 20, Duration.ofSeconds(5), Duration.ofMillis(200)), event -> true);
        Thread producer = Thread.ofVirtual().start(() -> {
            for (int i = 0; i < 100 && !subscription.cancelled; i++) {
                stream.onNext(part("event: delta\ndata: {\"text\":\"x\"}\n\n"));
                try {
                    Thread.sleep(10);
                } catch (InterruptedException e) {
                    return;
                }
            }
        });

        String text = written(stream);
        producer.join();

        assertThat(text.endsWith("event: error\ndata: {\"message\":\"The extension reply took too long\"}\n\n"), is(true));
        assertThat(subscription.cancelled, is(true));
    }

    @Test
    void count_the_maximum_time_from_when_hub_opens_the_stream_not_from_when_the_writer_starts() throws Exception {
        ExtensionEventStream stream = stream(limits(1024, Duration.ofSeconds(5), Duration.ofMillis(100)), event -> true);
        Thread.sleep(150);

        assertThat(written(stream), equalTo("event: error\ndata: {\"message\":\"The extension reply took too long\"}\n\n"));
        assertThat(subscription.cancelled, is(true));
        assertThat(released.get(), is(1));
    }

    @Test
    void close_a_stream_that_hub_never_writes_at_its_maximum_time() throws Exception {
        ExtensionEventStream stream = stream(limits(1024, Duration.ofSeconds(5), Duration.ofMillis(100)), event -> true);
        try {
            long end = System.nanoTime() + Duration.ofSeconds(5).toNanos();
            while (released.get() == 0 && System.nanoTime() < end) {
                Thread.sleep(10);
            }

            assertThat(released.get(), is(1));
            assertThat(subscription.cancelled, is(true));
            assertThat(watchdog.watched(), is(0));
        } finally {
            stream.close();
        }
    }

    @Test
    void free_the_slot_once_when_the_stream_closes_more_than_once() {
        ExtensionEventStream stream = stream(limits(1024, Duration.ofSeconds(5), Duration.ofMillis(100)), event -> true);
        stream.close();
        stream.close();
        stream.expire();

        assertThat(released.get(), is(1));
        assertThat(watchdog.watched(), is(0));
    }

    @Test
    void close_each_open_stream_and_end_the_watchdog_thread_when_hub_stops_and_watch_again_after_a_restart()
            throws Exception {
        AtomicReference<Thread> expiredOn = new AtomicReference<>();
        ExtensionEventStream expiring = new ExtensionEventStream("knowledge", "chat",
                limits(1024, Duration.ofSeconds(5), Duration.ofMillis(50)), event -> true, Set.of(),
                () -> expiredOn.set(Thread.currentThread()), watchdog);
        ExtensionEventStream open = stream(limits(1024, Duration.ofSeconds(5), Duration.ofSeconds(300)), event -> true);
        long end = System.nanoTime() + Duration.ofSeconds(5).toNanos();
        while (expiredOn.get() == null && System.nanoTime() < end) {
            Thread.sleep(10);
        }
        assertThat(expiredOn.get().getName(), is("extension-stream-watchdog"));

        watchdog.stop();

        assertThat(subscription.cancelled, is(true));
        assertThat(released.get(), is(1));
        assertThat(watchdog.watched(), is(0));
        expiredOn.get().join(5000);
        assertThat(expiredOn.get().isAlive(), is(false));
        // A stream that opens while Hub stops closes at once.
        AtomicInteger stoppedReleases = new AtomicInteger();
        new ExtensionEventStream("knowledge", "chat", limits(1024, Duration.ofSeconds(5), Duration.ofSeconds(300)),
                event -> true, Set.of(), stoppedReleases::incrementAndGet, watchdog);
        assertThat(stoppedReleases.get(), is(1));

        watchdog.start();
        CountDownLatch restarted = new CountDownLatch(1);
        new ExtensionEventStream("knowledge", "chat", limits(1024, Duration.ofSeconds(5), Duration.ofMillis(50)),
                event -> true, Set.of(), restarted::countDown, watchdog);
        assertThat(restarted.await(5, TimeUnit.SECONDS), is(true));
        expiring.close();
        open.close();
    }

    @Test
    void end_with_an_error_event_when_the_backend_connection_fails() {
        ExtensionEventStream stream = stream(limits(1024, Duration.ofSeconds(5), Duration.ofSeconds(5)), event -> true);
        stream.onNext(part("event: delta\ndata: {\"text\":\"a\"}\n\n"));
        stream.onError(new IOException("connection reset"));

        assertThat(written(stream), equalTo("event: delta\ndata: {\"text\":\"a\"}\n\n"
                + "event: error\ndata: {\"message\":\"The extension failed\"}\n\n"));
    }

    @Test
    void cancel_the_backend_call_and_free_the_slot_once_when_the_caller_goes_away() {
        ExtensionEventStream stream = stream(limits(1024, Duration.ofSeconds(5), Duration.ofSeconds(5)), event -> true);
        stream.onNext(part("event: delta\ndata: {\"text\":\"a\"}\n\n"));
        OutputStream closed = new OutputStream() {
            @Override
            public void write(int b) throws IOException {
                throw new IOException("Broken pipe");
            }
        };

        stream.writeTo(closed);
        stream.close();

        assertThat(subscription.cancelled, is(true));
        assertThat(released.get(), is(1));
    }

    @ParameterizedTest
    @ValueSource(strings = {"done", "error"})
    void end_after_a_terminal_event_and_cancel_the_backend_that_keeps_sending(String terminal) {
        ExtensionEventStream stream = new ExtensionEventStream("knowledge", "chat",
                limits(1024, Duration.ofSeconds(5), Duration.ofSeconds(5)), event -> true, Set.of("done", "error"),
                released::incrementAndGet, watchdog, Duration.ofMillis(20));
        stream.onSubscribe(subscription);
        // The backend sends more and does not end its reply.
        stream.onNext(part("event: delta\ndata: {\"text\":\"a\"}\n\nevent: " + terminal + "\ndata: {}\n\n"
                + "event: delta\ndata: {\"text\":\"late\"}\n\n"));

        assertThat(written(stream), equalTo("event: delta\ndata: {\"text\":\"a\"}\n\nevent: " + terminal + "\ndata: {}\n\n"));
        assertThat(subscription.cancelled, is(true));
        assertThat(released.get(), is(1));
    }

    @Test
    void cancel_a_subscription_that_arrives_after_the_stream_closed() {
        ExtensionEventStream stream = new ExtensionEventStream("knowledge", "chat",
                limits(1024, Duration.ofSeconds(5), Duration.ofSeconds(5)), event -> true, Set.of(), released::incrementAndGet, watchdog);
        stream.close();
        stream.onSubscribe(subscription);

        assertThat(subscription.cancelled, is(true));
        assertThat(subscription.requested, is(0));
        assertThat(stream.getBody().toCompletableFuture().join(), is(stream));
    }
}
