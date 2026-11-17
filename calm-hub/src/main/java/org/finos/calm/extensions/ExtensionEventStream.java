package org.finos.calm.extensions;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * A {@code text/event-stream} reply that Hub passes on while it arrives (ADR 0011). Hub reads the events of the backend
 * and writes each one again with only its {@code event} and {@code data} fields, so a backend cannot set an event id or
 * a reconnect time. A limit ends the stream with an {@code error} event from Hub: the backend is silent for the idle
 * timeout, the stream is open for longer than its maximum time, or the backend sends more than max-response-bytes.
 * When the caller goes away, for example with Stop in the UI, Hub closes the backend connection too. After a terminal
 * event, such as the {@code done} of a chat reply, Hub ends the stream and closes the backend connection.
 */
public final class ExtensionEventStream implements HttpResponse.BodySubscriber<ExtensionEventStream>, AutoCloseable {

    /** One event: its name, and its data with a line feed between data lines. */
    public record Event(String name, String data) {}

    /**
     * How a dedicated Hub endpoint streams: the backend must reply with an event stream, {@code events} drops an event
     * that it does not accept, and the stream ends after an event named in {@code terminal}.
     */
    public record Policy(Predicate<Event> events, Set<String> terminal) {}

    private static final Logger LOG = LoggerFactory.getLogger(ExtensionEventStream.class);
    private static final Pattern EVENT_NAME = Pattern.compile("^[A-Za-z][A-Za-z0-9_.-]{0,63}$");
    /** A comment line while the backend is silent, so a closed caller connection shows and proxies keep the stream open. */
    static final Duration HEARTBEAT = Duration.ofSeconds(5);
    private static final byte[] COMMENT = ":\n".getBytes(StandardCharsets.US_ASCII);
    private static final Object END = new Object();

    private final String extensionId;
    private final String routeId;
    private final ExtensionLimits limits;
    private final Predicate<Event> filter;
    private final Set<String> terminal;
    private final Runnable release;
    private final long heartbeatNanos;
    private final BlockingQueue<Object> items = new LinkedBlockingQueue<>();
    private final AtomicBoolean closed = new AtomicBoolean();
    private volatile Flow.Subscription subscription;

    /**
     * {@code filter} drops an event that it does not accept. The stream ends after it writes an event named in
     * {@code terminal}. {@code release} runs once, when the stream closes.
     */
    ExtensionEventStream(String extensionId, String routeId, ExtensionLimits limits, Predicate<Event> filter,
                         Set<String> terminal, Runnable release) {
        this(extensionId, routeId, limits, filter, terminal, release, HEARTBEAT);
    }

    ExtensionEventStream(String extensionId, String routeId, ExtensionLimits limits, Predicate<Event> filter,
                         Set<String> terminal, Runnable release, Duration heartbeat) {
        this.extensionId = extensionId;
        this.routeId = routeId;
        this.limits = limits;
        this.filter = filter;
        this.terminal = terminal;
        this.release = release;
        this.heartbeatNanos = heartbeat.toNanos();
    }

    @Override
    public CompletionStage<ExtensionEventStream> getBody() {
        // Complete at once, so that the call returns when the headers arrive and the body follows.
        return CompletableFuture.completedFuture(this);
    }

    @Override
    public void onSubscribe(Flow.Subscription subscription) {
        this.subscription = subscription;
        if (closed.get()) {
            subscription.cancel();
        } else {
            // One part at a time, so that Hub holds at most one part of a slow caller's stream.
            subscription.request(1);
        }
    }

    @Override
    public void onNext(List<ByteBuffer> item) {
        items.add(item);
    }

    @Override
    public void onError(Throwable error) {
        items.add(error);
    }

    @Override
    public void onComplete() {
        items.add(END);
    }

    /** Writes the events to the caller until the backend ends the stream, a limit stops it or the caller goes away. */
    public void writeTo(OutputStream out) {
        long deadline = System.nanoTime() + limits.maxStreamDuration().toNanos();
        long idleUntil = System.nanoTime() + limits.streamIdleTimeout().toNanos();
        Parser parser = new Parser();
        long size = 0;
        try {
            while (true) {
                long now = System.nanoTime();
                if (now - deadline >= 0) {
                    stop(out, "The extension reply took too long", "reached its maximum time");
                    return;
                }
                if (now - idleUntil >= 0) {
                    stop(out, "The extension stopped replying", "was silent for the idle timeout");
                    return;
                }
                long wait = Math.min(Math.min(deadline - now, idleUntil - now), heartbeatNanos);
                Object item = items.poll(wait, TimeUnit.NANOSECONDS);
                if (item == null) {
                    out.write(COMMENT);
                    out.flush();
                    continue;
                }
                if (item == END) {
                    return;
                }
                if (item instanceof Throwable error) {
                    LOG.warn("Extension {} route {} stream failed: {}", extensionId, routeId, error.toString());
                    stop(out, "The extension failed", null);
                    return;
                }
                @SuppressWarnings("unchecked")
                List<ByteBuffer> buffers = (List<ByteBuffer>) item;
                for (ByteBuffer buffer : buffers) {
                    size += buffer.remaining();
                    if (size > limits.maxResponseBytes()) {
                        stop(out, "The extension reply is too large", "sent more than max-response-bytes");
                        return;
                    }
                    for (Event event : parser.read(buffer)) {
                        if (filter.test(event)) {
                            out.write(frame(event));
                            if (terminal.contains(event.name())) {
                                out.flush();
                                return;
                            }
                        }
                    }
                }
                out.flush();
                idleUntil = System.nanoTime() + limits.streamIdleTimeout().toNanos();
                subscription.request(1);
            }
        } catch (IOException e) {
            // The caller went away. Closing the stream cancels the backend call.
            LOG.debug("The caller of extension {} route {} closed the stream", extensionId, routeId);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            close();
        }
    }

    /** Cancels the backend call and frees the stream slot. Safe to call more than once. */
    @Override
    public void close() {
        if (closed.compareAndSet(false, true)) {
            Flow.Subscription current = subscription;
            if (current != null) {
                current.cancel();
            }
            release.run();
        }
    }

    private void stop(OutputStream out, String message, String reason) throws IOException {
        if (reason != null) {
            LOG.warn("Extension {} route {} stream {}, so Hub ended it", extensionId, routeId, reason);
        }
        out.write(frame(new Event("error", "{\"message\":\"" + message + "\"}")));
        out.flush();
    }

    static byte[] frame(Event event) {
        // "message" is the name of an event with no event field.
        StringBuilder text = new StringBuilder(event.name().equals("message") ? "" : "event: " + event.name() + "\n");
        for (String line : event.data().split("\n", -1)) {
            text.append("data: ").append(line).append('\n');
        }
        return text.append('\n').toString().getBytes(StandardCharsets.UTF_8);
    }

    /** Splits the backend bytes into events with the rules of the HTML event stream format. */
    static final class Parser {

        private final ByteArrayOutputStream line = new ByteArrayOutputStream();
        private boolean afterCarriageReturn;
        private boolean firstLine = true;
        private String name;
        private StringBuilder data;

        List<Event> read(ByteBuffer buffer) {
            List<Event> events = new ArrayList<>();
            while (buffer.hasRemaining()) {
                byte b = buffer.get();
                if (afterCarriageReturn && b == '\n') {
                    afterCarriageReturn = false;
                    continue;
                }
                afterCarriageReturn = b == '\r';
                if (b == '\n' || b == '\r') {
                    Event event = endLine();
                    if (event != null) {
                        events.add(event);
                    }
                } else {
                    // A line ends only at CR or LF, which never occur inside a multi-byte UTF-8 character.
                    line.write(b);
                }
            }
            return events;
        }

        private Event endLine() {
            String text = line.toString(StandardCharsets.UTF_8);
            line.reset();
            if (firstLine) {
                firstLine = false;
                if (text.startsWith("\uFEFF")) {
                    text = text.substring(1);
                }
            }
            if (text.isEmpty()) {
                Event event = data == null ? null : new Event(name == null || name.isEmpty() ? "message" : name, data.toString());
                name = null;
                data = null;
                return event != null && EVENT_NAME.matcher(event.name()).matches() ? event : null;
            }
            int colon = text.indexOf(':');
            if (colon == 0) {
                return null;
            }
            String field = colon < 0 ? text : text.substring(0, colon);
            String value = colon < 0 ? "" : text.substring(colon + 1);
            if (value.startsWith(" ")) {
                value = value.substring(1);
            }
            if (field.equals("event")) {
                name = value;
            } else if (field.equals("data")) {
                data = data == null ? new StringBuilder(value) : data.append('\n').append(value);
            }
            // Hub drops id and retry, so the browser never reconnects to the extension by itself.
            return null;
        }
    }
}
