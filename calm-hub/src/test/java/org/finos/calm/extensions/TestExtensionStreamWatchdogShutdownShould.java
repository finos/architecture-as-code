package org.finos.calm.extensions;

import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.restassured.RestAssured;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.ConfigProvider;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import java.util.stream.Stream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

/** Hub's own shutdown, through the CDI event, closes each open stream. It has its own Hub, because it stops the watchdog. */
@QuarkusTest
@TestProfile(TestExtensionStreamWatchdogShutdownShould.Profile.class)
class TestExtensionStreamWatchdogShutdownShould {

    private static final String SCREEN = "/api/calm/extensions/proxy-test/api/screen";
    private static final String CHAT = "/api/calm/extensions/proxy-test/chat/assistant";
    private static final String QUESTION = """
            {"conversationId":"c1","messageId":"m1","messages":[{"role":"user","content":"Which services?"}]}""";
    private static FixtureBackend backend;

    @Inject
    Event<ShutdownEvent> shutdown;

    @Inject
    ExtensionStreamWatchdog watchdog;

    @Inject
    ExtensionProxyService service;

    /** One slot in each pool and one stream for each user, so that a stream that kept a count blocks the next one. */
    public static class Profile implements QuarkusTestProfile {
        private static final ExtensionTestKeys.KeyFiles KEYS = ExtensionTestKeys.rsaInTempDir();

        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                    "calm.extensions.dir", "src/test/resources/extensions-test/proxy",
                    "calm.extensions.chat-provider", "proxy-test",
                    "calm.extensions.\"proxy-test\".backend-url", "http://localhost:" + FixtureBackend.freePort() + "/base",
                    "calm.extensions.\"proxy-test\".max-concurrent-streams", "1",
                    "calm.extensions.\"proxy-test\".max-concurrent-chat-streams", "1",
                    "calm.extensions.\"proxy-test\".max-concurrent-streams-per-user", "1",
                    "calm.extensions.identity.private-key-location", KEYS.privateKey().toString(),
                    "calm.extensions.identity.public-key-locations", KEYS.publicKey().toString());
        }
    }

    @BeforeAll
    static void startBackend() {
        String url = ConfigProvider.getConfig().getValue("calm.extensions.\"proxy-test\".backend-url", String.class);
        backend = new FixtureBackend(URI.create(url).getPort());
    }

    @AfterAll
    static void stopBackend() {
        backend.close();
    }

    @Test
    @TestSecurity(user = "alice")
    void close_each_open_stream_and_end_the_watchdog_thread_when_hub_shuts_down() throws Exception {
        CountDownLatch gate = new CountDownLatch(1);
        backend.stream(FixtureBackend.Stream.untilClosed("event: delta\ndata: {\"text\":\"Hel\"}\n\n",
                "data: " + "x".repeat(1000) + "\n\n", gate));
        HttpClient client = HttpClient.newHttpClient();
        try {
            Stream<String> proxied = open(client, HttpRequest.newBuilder(uri(SCREEN)).header("Accept", "text/event-stream"));
            Stream<String> chat = open(client, HttpRequest.newBuilder(uri(CHAT)).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(QUESTION)));
            assertThat(service.streamUsers(), is(2));
            ScheduledThreadPoolExecutor executor = executor();
            assertThat(executor.getPoolSize(), is(1));

            shutdown.fire(new ShutdownEvent());

            assertThat(executor.isTerminated(), is(true));
            assertThat(service.streamUsers(), is(0));
            gate.countDown();
            waitFor(() -> backend.brokenStreams() == 2);
            proxied.close();
            chat.close();
        } finally {
            gate.countDown();
            client.shutdownNow();
        }

        // Each pool slot and each count of alice is free again.
        watchdog.start();
        backend.stream(FixtureBackend.Stream.events("event: done\ndata: {}\n\n"));
        RestAssured.given().accept("text/event-stream").when().get(SCREEN).then().statusCode(200);
        RestAssured.given().contentType("application/json").body(QUESTION).when().post(CHAT).then().statusCode(200);
        waitFor(() -> service.streamUsers() == 0);
    }

    private static Stream<String> open(HttpClient client, HttpRequest.Builder request) throws Exception {
        HttpResponse<Stream<String>> response = client.send(request.build(), HttpResponse.BodyHandlers.ofLines());
        assertThat(response.statusCode(), is(200));
        Stream<String> body = response.body();
        assertThat(body.iterator().next(), is("event: delta"));
        return body;
    }

    private static URI uri(String path) {
        return URI.create("http://localhost:" + RestAssured.port + path);
    }

    /** The thread pool of the watchdog bean, read before the shutdown that clears it. */
    private ScheduledThreadPoolExecutor executor() throws Exception {
        var field = ExtensionStreamWatchdog.class.getDeclaredField("executor");
        field.setAccessible(true);
        return (ScheduledThreadPoolExecutor) field.get(io.quarkus.arc.ClientProxy.unwrap(watchdog));
    }

    private static void waitFor(BooleanSupplier condition) throws InterruptedException {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!condition.getAsBoolean() && System.nanoTime() < end) {
            Thread.sleep(10);
        }
        assertThat(condition.getAsBoolean(), is(true));
    }
}
