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

    private final HttpServer server;
    private final AtomicReference<Received> received = new AtomicReference<>();
    private volatile Reply reply = Reply.json(200, "{}");

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
    }

    /** The last request, or null. */
    public Received received() {
        return received.get();
    }

    public void reset() {
        received.set(null);
        reply = Reply.json(200, "{}");
    }

    private void handle(HttpExchange exchange) throws IOException {
        Map<String, List<String>> headers = new java.util.HashMap<>();
        exchange.getRequestHeaders().forEach((name, values) -> headers.put(name.toLowerCase(), values));
        URI uri = exchange.getRequestURI();
        String pathAndQuery = uri.getRawPath() + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        received.set(new Received(exchange.getRequestMethod(), pathAndQuery, headers, body));
        Reply current = reply;
        if (current.delayMillis() > 0) {
            try {
                Thread.sleep(current.delayMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
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

    @Override
    public void close() {
        server.stop(0);
    }
}
