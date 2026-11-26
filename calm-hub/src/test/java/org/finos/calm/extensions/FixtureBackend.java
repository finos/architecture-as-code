package org.finos.calm.extensions;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** A loopback HTTP server that records the last request and sends a set reply. */
public final class FixtureBackend implements AutoCloseable {

    /** What the backend received. {@code headers} has lower-case names. */
    public record Received(String method, String pathAndQuery, Map<String, List<String>> headers, String body) {

        public String header(String name) {
            List<String> values = headers.get(name.toLowerCase());
            return values == null ? null : values.getFirst();
        }
    }

    /** The reply to send. A positive {@code delayMillis} sleeps first. */
    public record Reply(int status, Map<String, String> headers, byte[] body, long delayMillis) {

        public static Reply json(int status, String json) {
            return new Reply(status, Map.of("Content-Type", "application/json"), json.getBytes(StandardCharsets.UTF_8), 0);
        }
    }

    /**
     * A reply that the backend writes in parts, flushing each one. After the first part it waits for {@code gate}, when
     * there is one, so a test can read the first part while the backend has not finished.
     */
    public record Stream(int status, String contentType, List<String> parts, CountDownLatch gate) {

        public static Stream events(String... parts) {
            return new Stream(200, "text/event-stream", List.of(parts), null);
        }
    }

    private final HttpServer server;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final AtomicReference<Received> received = new AtomicReference<>();
    private final AtomicInteger brokenStreams = new AtomicInteger();
    private volatile Reply reply = Reply.json(200, "{}");
    private volatile Stream stream;
    private volatile CountDownLatch headerGate;

    public FixtureBackend() {
        this(0);
    }

    public FixtureBackend(int port) {
        try {
            server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), port), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.createContext("/", this::handle);
        // A stream holds its thread, so each exchange gets its own.
        server.setExecutor(executor);
        server.start();
    }

    /** A free loopback port, for a test profile that must know the backend URL before it starts. */
    public static int freePort() {
        try (java.net.ServerSocket socket = new java.net.ServerSocket(0, 0, InetAddress.getLoopbackAddress())) {
            return socket.getLocalPort();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public URI url(String path) {
        return URI.create("http://localhost:" + server.getAddress().getPort() + path);
    }

    public void reply(Reply next) {
        reply = next;
        stream = null;
    }

    public void stream(Stream next) {
        stream = next;
    }

    /** The next replies wait for {@code gate} before they send their headers. */
    public void holdHeaders(CountDownLatch gate) {
        headerGate = gate;
    }

    /** True when the caller closed the connection while the backend was writing a stream. */
    public boolean streamBroken() {
        return brokenStreams.get() > 0;
    }

    /** The streams that the caller closed while the backend was writing them. */
    public int brokenStreams() {
        return brokenStreams.get();
    }

    /** The last request, or null. */
    public Received received() {
        return received.get();
    }

    public void reset() {
        received.set(null);
        reply = Reply.json(200, "{}");
        stream = null;
        headerGate = null;
        brokenStreams.set(0);
    }

    private void handle(HttpExchange exchange) throws IOException {
        Map<String, List<String>> headers = new java.util.HashMap<>();
        exchange.getRequestHeaders().forEach((name, values) -> headers.put(name.toLowerCase(), values));
        URI uri = exchange.getRequestURI();
        String pathAndQuery = uri.getRawPath() + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        received.set(new Received(exchange.getRequestMethod(), pathAndQuery, headers, body));
        Stream parts = stream;
        if (parts != null) {
            writeStream(exchange, parts);
            return;
        }
        Reply current = reply;
        CountDownLatch gate = headerGate;
        try {
            if (gate != null && !gate.await(10, TimeUnit.SECONDS)) {
                throw new IOException("The test did not open the header gate");
            }
            if (current.delayMillis() > 0) {
                Thread.sleep(current.delayMillis());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        current.headers().forEach((name, value) -> exchange.getResponseHeaders().add(name, value));
        exchange.sendResponseHeaders(current.status(), current.body().length == 0 ? -1 : current.body().length);
        if (current.body().length > 0) {
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(current.body());
            }
        }
        exchange.close();
    }

    private void writeStream(HttpExchange exchange, Stream parts) throws IOException {
        exchange.getResponseHeaders().add("Content-Type", parts.contentType());
        exchange.sendResponseHeaders(parts.status(), 0);
        try (OutputStream out = exchange.getResponseBody()) {
            for (int i = 0; i < parts.parts().size(); i++) {
                out.write(parts.parts().get(i).getBytes(StandardCharsets.UTF_8));
                out.flush();
                if (i == 0 && parts.gate() != null && !parts.gate().await(10, TimeUnit.SECONDS)) {
                    throw new IOException("The test did not open the gate");
                }
            }
        } catch (IOException e) {
            brokenStreams.incrementAndGet();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            exchange.close();
        }
    }

    @Override
    public void close() {
        server.stop(0);
        executor.shutdownNow();
    }
}
