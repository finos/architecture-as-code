package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.config.ExtensionsConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Calls an extension's backend. Hub builds a new request, so no header from the browser
 * (cookies, Authorization, Remote-User) reaches the extension.
 */
@ApplicationScoped
public class ExtensionScreenClient {

    private static final Logger LOG = LoggerFactory.getLogger(ExtensionScreenClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ExtensionsConfig config;
    private HttpClient httpClient;

    @Inject
    public ExtensionScreenClient(ExtensionsConfig config) {
        this.config = config;
    }

    @PostConstruct
    void init() {
        httpClient = HttpClient.newBuilder()
                .proxy(ProxySelector.getDefault())
                .connectTimeout(Duration.ofSeconds(config.http().connectTimeout()))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    /** Returns the screen JSON, checked to be an object with a blocks array. */
    public String get(ExtensionManifest manifest, String path, String identity) throws ExtensionCallException {
        URI uri = URI.create(stripTrailingSlash(manifest.backend().url()) + path);
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(config.http().requestTimeout()))
                .header("Accept", "application/json")
                .header(ExtensionIdentitySigner.HEADER, identity)
                .GET()
                .build();
        try {
            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream body = response.body()) {
                if (response.statusCode() != 200) {
                    LOG.warn("Extension {} returned status {} for {}", manifest.id(), response.statusCode(), path);
                    throw new ExtensionCallException();
                }
                byte[] bytes = body.readNBytes(config.http().maxResponseBytes() + 1);
                if (bytes.length > config.http().maxResponseBytes()) {
                    LOG.warn("Extension {} response for {} is larger than {} bytes", manifest.id(), path, config.http().maxResponseBytes());
                    throw new ExtensionCallException();
                }
                JsonNode json = MAPPER.readTree(bytes);
                if (json == null || !json.isObject() || !json.path("blocks").isArray()) {
                    LOG.warn("Extension {} response for {} has no blocks array", manifest.id(), path);
                    throw new ExtensionCallException();
                }
                return MAPPER.writeValueAsString(json);
            }
        } catch (IOException e) {
            LOG.warn("Cannot call extension {} at {}: {}", manifest.id(), path, e.getMessage());
            throw new ExtensionCallException();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ExtensionCallException();
        }
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    public static class ExtensionCallException extends Exception {
    }
}
