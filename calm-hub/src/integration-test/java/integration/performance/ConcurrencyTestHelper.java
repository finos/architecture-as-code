package integration.performance;

import io.restassured.response.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Shared concurrency test harness for CALM Hub integration tests.
 * Uses CountDownLatch to synchronize thread start for maximum contention.
 */
public class ConcurrencyTestHelper {

    private static final Logger LOG = LoggerFactory.getLogger(ConcurrencyTestHelper.class);

    public static final int DEFAULT_THREAD_COUNT = 20;

    /**
     * Run a callable concurrently from multiple threads, all starting at the same instant.
     *
     * @param threadCount number of concurrent threads
     * @param task the callable to execute (should return a RestAssured Response)
     * @return list of results from all threads (successful responses)
     */
    public static <T> ConcurrencyResult<T> runConcurrently(int threadCount, Callable<T> task) {
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            futures.add(executor.submit(() -> {
                startGate.await(); // All threads wait here until released
                return task.call();
            }));
        }

        // Release all threads simultaneously
        startGate.countDown();

        List<T> results = new ArrayList<>();
        List<Throwable> errors = new ArrayList<>();

        for (Future<T> future : futures) {
            try {
                results.add(future.get());
            } catch (Exception e) {
                errors.add(e.getCause() != null ? e.getCause() : e);
            }
        }

        executor.shutdown();

        if (!errors.isEmpty()) {
            LOG.warn("{} of {} tasks failed", errors.size(), threadCount);
            for (Throwable error : errors) {
                LOG.warn("Task error: {}", error.getMessage());
            }
        }

        return new ConcurrencyResult<>(results, errors);
    }

    /**
     * Run an indexed callable concurrently - each thread gets a unique index (0..threadCount-1).
     * Useful for tests where each thread creates a different version.
     */
    public static <T> ConcurrencyResult<T> runConcurrently(int threadCount, AtomicInteger ignored, Function<Integer, T> indexedTask) {
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        AtomicInteger indexCounter = new AtomicInteger(0);
        List<Future<T>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            futures.add(executor.submit(() -> {
                int myIndex = indexCounter.getAndIncrement();
                startGate.await();
                return indexedTask.apply(myIndex);
            }));
        }

        startGate.countDown();

        List<T> results = new ArrayList<>();
        List<Throwable> errors = new ArrayList<>();

        for (Future<T> future : futures) {
            try {
                results.add(future.get());
            } catch (Exception e) {
                errors.add(e.getCause() != null ? e.getCause() : e);
            }
        }

        executor.shutdown();

        if (!errors.isEmpty()) {
            LOG.warn("{} of {} indexed tasks failed", errors.size(), threadCount);
        }

        return new ConcurrencyResult<>(results, errors);
    }

    /**
     * Extract integer IDs from Location headers using a regex pattern.
     */
    public static List<Integer> extractIdsFromLocations(List<Response> responses, String locationPattern) {
        Pattern regex = Pattern.compile(locationPattern);
        List<Integer> ids = new ArrayList<>();
        for (Response response : responses) {
            String location = response.getHeader("Location");
            if (location != null) {
                Matcher matcher = regex.matcher(location);
                if (matcher.find()) {
                    ids.add(Integer.parseInt(matcher.group(1)));
                }
            }
        }
        return ids;
    }

    /**
     * Assert that all responses returned the expected status code.
     */
    public static void assertAllStatusCodes(List<Response> responses, int expectedStatus) {
        for (int i = 0; i < responses.size(); i++) {
            assertEquals(expectedStatus, responses.get(i).getStatusCode(),
                    "Response " + i + " had unexpected status code");
        }
    }

    /**
     * Assert all IDs in the list are unique (no duplicates from counter races).
     */
    public static void assertAllIdsUnique(List<Integer> ids) {
        Set<Integer> uniqueIds = new HashSet<>(ids);
        assertEquals(ids.size(), uniqueIds.size(),
                "Duplicate IDs detected! IDs: " + ids);
    }

    /**
     * Assert no data was lost: the retrieved count matches the expected count.
     */
    public static void assertNoDataLoss(int expectedCount, int actualCount, String entityType) {
        assertEquals(expectedCount, actualCount,
                entityType + " data loss detected: expected " + expectedCount + " but found " + actualCount);
    }

    public record ConcurrencyResult<T>(List<T> results, List<Throwable> errors) {
        public List<T> successfulResults() {
            return Collections.unmodifiableList(results);
        }

        public boolean allSucceeded() {
            return errors.isEmpty();
        }

        public int successCount() {
            return results.size();
        }

        public int errorCount() {
            return errors.size();
        }
    }
}
