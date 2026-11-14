package org.finos.calm.extensions;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.Config;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditOutcome;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.resources.ResourceValidationConstants;
import org.finos.calm.security.AuditService;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.security.ProxyAuthenticationMechanism;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.ByteBuffer;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * Calls an extension route for a caller (ADR 0011). The REST proxy and the MCP tools both use this
 * service, so that the same rules apply to each call. Hub builds a new request: no header from the
 * caller reaches the backend except the allow-listed ones, and the caller's token never does. The
 * reply is buffered; streaming is not supported yet.
 */
@ApplicationScoped
public class ExtensionProxyService {

    private static final Logger LOG = LoggerFactory.getLogger(ExtensionProxyService.class);
    private static final Set<String> REPLY_TYPES = Set.of("application/json", "text/event-stream", "text/plain");
    private static final List<String> REPLY_HEADERS = List.of("Content-Type", "ETag", "Retry-After", "Vary");
    /** The scopes for which Hub checks the namespace, so the only ones that get the {@code ns} claim. */
    private static final Set<String> NAMESPACE_SCOPES = Set.of("read", "write", "admin");
    private static final Set<String> DOMAIN_SCOPES = Set.of("domain_read", "domain_write", "domain_admin");
    private static final Pattern NAMESPACE = Pattern.compile(ResourceValidationConstants.NAMESPACE_REGEX);
    private static final Pattern DOMAIN = Pattern.compile(ResourceValidationConstants.DOMAIN_REGEX);

    private final ExtensionRegistry registry;
    private final ExtensionIdentitySigner signer;
    private final CalmHubPermissionChecker permissions;
    private final AuditService auditService;
    private final String authMode;
    private final Map<String, HttpClient> clients = new ConcurrentHashMap<>();
    private final Map<String, Semaphore> concurrentCalls = new ConcurrentHashMap<>();

    @Inject
    public ExtensionProxyService(ExtensionRegistry registry, ExtensionIdentitySigner signer,
                                 CalmHubPermissionChecker permissions, AuditService auditService, Config properties,
                                 Instance<ProxyAuthenticationMechanism> proxyAuthentication) {
        this(registry, signer, permissions, auditService, authMode(properties, proxyAuthentication.isResolvable()));
    }

    ExtensionProxyService(ExtensionRegistry registry, ExtensionIdentitySigner signer,
                          CalmHubPermissionChecker permissions, AuditService auditService, String authMode) {
        this.registry = registry;
        this.signer = signer;
        this.permissions = permissions;
        this.auditService = auditService;
        this.authMode = authMode;
    }

    /** The {@code auth} claim: how Hub knows who the caller is. */
    static String authMode(Config properties, boolean proxyAuthentication) {
        if (!properties.getOptionalValue("calm.auth.enabled", Boolean.class).orElse(false)) {
            return "none";
        }
        return proxyAuthentication ? "proxy" : "oidc";
    }

    /** Throws {@link ExtensionProxyException} when Hub refuses the call or the backend fails. */
    public ExtensionProxyResponse call(SecurityIdentity identity, ExtensionProxyRequest request) {
        Access access = authorise(identity, request);
        RegisteredExtension extension = access.extension();
        ExtensionManifest.Route route = access.route();
        String method = access.method();
        ExtensionLimits limits = extension.limits();
        Semaphore calls = concurrentCalls.computeIfAbsent(extension.id(), id -> new Semaphore(limits.maxConcurrentCalls()));
        boolean acquired = false;
        // A refusal after the scope check is a FAILURE with no jti: Hub sent nothing to the backend.
        AuditOutcome outcome = AuditOutcome.FAILURE;
        String sentJti = null;
        try {
            String query = ExtensionPaths.canonicalQuery(request.rawQuery());
            String pathAndQuery = query.isEmpty() ? access.path() : access.path() + "?" + query;
            URI target = ExtensionPaths.resolve(access.backend(), pathAndQuery);
            byte[] body = readBody(request.body(), limits.maxRequestBytes());
            if (!acceptsContentType(method, body, request.contentType())) {
                throw new ExtensionProxyException(415, "The request must be JSON");
            }
            acquired = calls.tryAcquire();
            if (!acquired) {
                LOG.warn("Extension {} has {} calls in progress, so Hub refused one more", extension.id(),
                        limits.maxConcurrentCalls());
                throw new ExtensionProxyException(503, "The extension is busy. Try again later",
                        Map.of("Retry-After", "1"));
            }
            String jti = UUID.randomUUID().toString();
            String assertion = signer.sign(new ExtensionAssertion(identity.getPrincipal().getName(), extension.id(), jti,
                    authMode, extension.manifest().hubApi(), route.id(), route.scope(), access.namespace(),
                    access.domain(), method, pathAndQuery), body);
            HttpRequest outbound = outboundRequest(request, method, target, body, limits, assertion);
            outcome = AuditOutcome.UNKNOWN;
            sentJti = jti;
            ExtensionProxyResponse reply = send(extension, route, outbound);
            outcome = reply.status() < 400 ? AuditOutcome.SUCCESS
                    : reply.status() == 401 || reply.status() == 403 ? AuditOutcome.DENIED : AuditOutcome.FAILURE;
            return reply;
        } finally {
            if (acquired) {
                calls.release();
            }
            if (!route.readOnly()) {
                audit(identity, method, extension, route, access.namespace(), access.domain(), sentJti, outcome,
                        request.sourceIp());
            }
        }
    }

    private record Access(RegisteredExtension extension, URI backend, String method, String path,
                          ExtensionManifest.Route route, String namespace, String domain) {
    }

    private Access authorise(SecurityIdentity identity, ExtensionProxyRequest request) {
        RegisteredExtension extension = registry.find(request.extensionId())
                .orElseThrow(() -> new ExtensionProxyException(404, "There is no such extension"));
        URI backend = extension.backendUrl()
                .orElseThrow(() -> new ExtensionProxyException(404, "The extension has no such route"));
        String method = request.method().toUpperCase(Locale.ROOT);
        String path = ExtensionPaths.checkPath(request.path());
        boolean readOnlyHub = registry.isReadOnly();
        Predicate<ExtensionManifest.Route> accepted = r -> !readOnlyHub || "GET".equals(r.method()) || r.readOnly();
        ExtensionRouteMatcher.RouteMatch match =
                ExtensionRouteMatcher.match(extension.manifest(), method, path, accepted);
        ExtensionRouteMatcher.rejectEncodedLiterals(match, request.path());
        ExtensionManifest.Route route = match.route();
        if (!accepted.test(route)) {
            String allow = ExtensionRouteMatcher.allowedMethods(extension.manifest(), path, accepted);
            throw new ExtensionProxyException(405, "This CALM Hub instance is read-only", Map.of("Allow", allow));
        }
        // Hub takes the namespace and the domain only from the matched path, never from the query or body.
        String namespace = match.parameters().get("namespace");
        String domain = match.parameters().get("domain");
        if ((namespace != null && !NAMESPACE.matcher(namespace).matches())
                || (domain != null && !DOMAIN.matcher(domain).matches())) {
            throw new ExtensionProxyException(400, "The namespace or domain in the path is not valid");
        }
        boolean audited = !route.readOnly();
        boolean authorised = isAuthorised(identity, route.scope(), namespace, domain);
        // The backend and the audit log get only the values that Hub checked for the scope.
        namespace = NAMESPACE_SCOPES.contains(route.scope()) ? namespace : null;
        domain = DOMAIN_SCOPES.contains(route.scope()) ? domain : null;
        if (!authorised) {
            if (audited) {
                audit(identity, method, extension, route, namespace, domain, null, AuditOutcome.DENIED,
                        request.sourceIp());
            }
            boolean anonymous = identity == null || identity.isAnonymous();
            throw anonymous
                    ? new ExtensionProxyException(401, "Sign in to call this extension")
                    : new ExtensionProxyException(403, "You do not have the scope that this extension route needs");
        }
        return new Access(extension, backend, method, path, route, namespace, domain);
    }

    /**
     * The same rules as {@code @PermissionsAllowed}, through {@link CalmHubPermissionChecker}: READ
     * needs every ancestor namespace, WRITE any one. Every scope needs a signed-in caller, also when
     * {@code calm.auth.allow-public-read} is on.
     */
    private boolean isAuthorised(SecurityIdentity identity, String scope, String namespace, String domain) {
        if (identity == null || identity.isAnonymous()) {
            return false;
        }
        return switch (scope) {
            case "authenticated" -> true;
            case "global_admin" -> permissions.hasGlobalAdmin(identity);
            case "read" -> permissions.canRead(identity, namespace);
            case "write" -> permissions.canWrite(identity, namespace);
            case "admin" -> permissions.allowNamespaceAdmin(identity, namespace);
            case "domain_read" -> permissions.canReadByDomain(identity, domain);
            case "domain_write" -> permissions.canWriteByDomain(identity, domain);
            case "domain_admin" -> permissions.allowDomainAdmin(identity, domain);
            // The loader refuses any other scope at start up; fail closed all the same.
            default -> false;
        };
    }

    private void audit(SecurityIdentity identity, String method, RegisteredExtension extension,
                       ExtensionManifest.Route route, String namespace, String domain, String jti, AuditOutcome outcome,
                       String sourceIp) {
        auditService.record(new AuditLogEntry.AuditLogEntryBuilder()
                .setTimestamp(LocalDateTime.now(ZoneOffset.UTC))
                .setActor(identity == null || identity.isAnonymous() ? "anonymous" : identity.getPrincipal().getName())
                .setAction(switch (method) {
                    case "GET" -> AuditAction.READ;
                    case "POST" -> AuditAction.CREATE;
                    case "DELETE" -> AuditAction.DELETE;
                    default -> AuditAction.UPDATE;
                })
                .setEntityType(AuditEntityType.EXTENSION)
                .setNamespace(namespace)
                .setDomain(domain)
                .setEntityId(extension.id())
                .setRoute(route.id())
                .setJti(jti)
                .setOutcome(outcome)
                .setSourceIp(sourceIp)
                .build());
    }

    private static HttpRequest outboundRequest(ExtensionProxyRequest request, String method, URI target, byte[] body,
                                               ExtensionLimits limits, String assertion) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(target)
                    .timeout(limits.requestTimeout())
                    .header(ExtensionIdentitySigner.HEADER, assertion)
                    .method(method, body.length == 0
                            ? HttpRequest.BodyPublishers.noBody()
                            : HttpRequest.BodyPublishers.ofByteArray(body));
            copyHeader(builder, "Content-Type", request.contentType());
            copyHeader(builder, "Accept", request.accept());
            copyHeader(builder, "Accept-Language", request.acceptLanguage());
            copyHeader(builder, "If-Match", request.ifMatch());
            copyHeader(builder, "If-None-Match", request.ifNoneMatch());
            return builder.build();
        } catch (IllegalArgumentException e) {
            throw new ExtensionProxyException(400, "The request has a header value that is not allowed");
        }
    }

    private static void copyHeader(HttpRequest.Builder builder, String name, String value) {
        if (value != null && !value.isBlank()) {
            builder.header(name, value);
        }
    }

    private ExtensionProxyResponse send(RegisteredExtension extension, ExtensionManifest.Route route, HttpRequest outbound) {
        ExtensionLimits limits = extension.limits();
        HttpResponse.BodyHandler<byte[]> capped = info -> new CappedBodySubscriber(limits.maxResponseBytes());
        CompletableFuture<HttpResponse<byte[]>> future = client(extension).sendAsync(outbound, capped);
        HttpResponse<byte[]> response;
        try {
            // The request timeout covers the reply headers only, so the whole call has its own limit.
            response = future.get(limits.requestTimeout().toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw timeout(extension, route);
        } catch (ExecutionException e) {
            if (isTimeout(e.getCause())) {
                throw timeout(extension, route);
            }
            LOG.warn("Extension {} route {} failed: {}", extension.id(), route.id(), e.getCause().toString());
            throw badGateway();
        } catch (InterruptedException e) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw badGateway();
        }
        return reply(extension, route, response);
    }

    private static ExtensionProxyResponse reply(RegisteredExtension extension, ExtensionManifest.Route route,
                                                HttpResponse<byte[]> response) {
        int status = response.statusCode();
        // A 401 or 407 would start a login in the caller. Hub never passes on Location, because it names the
        // private backend, so a redirect cannot be followed; a 304 needs none.
        boolean passOn = (status >= 200 && status < 300) || status == 304
                || (status >= 400 && status < 500 && status != 401 && status != 407);
        String contentType = response.headers().firstValue("Content-Type").orElse(null);
        boolean typeAllowed = contentType == null ? response.body().length == 0
                : REPLY_TYPES.contains(mediaType(contentType)) || (status >= 400 && isJson(contentType));
        if (!passOn || !typeAllowed) {
            LOG.warn("Extension {} route {} returned status {} and content type {}, which Hub does not pass on",
                    extension.id(), route.id(), status,
                    contentType == null ? "none" : ResourceValidationConstants.STRICT_SANITIZATION_POLICY.sanitize(mediaType(contentType)));
            throw badGateway();
        }
        Map<String, String> headers = new LinkedHashMap<>();
        for (String name : REPLY_HEADERS) {
            response.headers().firstValue(name).ifPresent(value -> headers.put(name, value));
        }
        headers.put("Cache-Control", privateCacheControl(response.headers().firstValue("Cache-Control").orElse(null)));
        return new ExtensionProxyResponse(status, headers, response.body());
    }

    /**
     * Each reply is for one caller, so a shared cache must never keep it. Hub drops {@code public}
     * and {@code private}, keeps the other directives, and puts {@code private} first.
     */
    static String privateCacheControl(String value) {
        List<String> directives = new ArrayList<>();
        directives.add("private");
        if (value != null) {
            for (String directive : splitDirectives(value)) {
                int equals = directive.indexOf('=');
                String name = (equals < 0 ? directive : directive.substring(0, equals)).trim().toLowerCase(Locale.ROOT);
                if (!directive.isEmpty() && !name.equals("public") && !name.equals("private")) {
                    directives.add(directive);
                }
            }
        }
        return String.join(", ", directives);
    }

    /** Splits on the commas that are not in a quoted string, such as {@code no-cache="a, b"}. */
    private static List<String> splitDirectives(String value) {
        List<String> parts = new ArrayList<>();
        StringBuilder part = new StringBuilder();
        boolean quoted = false;
        for (char c : value.toCharArray()) {
            if (c == '"') {
                quoted = !quoted;
            }
            if (c == ',' && !quoted) {
                parts.add(part.toString().trim());
                part.setLength(0);
            } else {
                part.append(c);
            }
        }
        parts.add(part.toString().trim());
        return parts;
    }

    private HttpClient client(RegisteredExtension extension) {
        return clients.computeIfAbsent(extension.id(), id -> HttpClient.newBuilder()
                .proxy(ProxySelector.getDefault())
                .connectTimeout(extension.limits().connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                // HTTP/1.1 only, also for https, so that a plain http backend gets no h2c upgrade.
                .version(HttpClient.Version.HTTP_1_1)
                .build());
    }

    private static byte[] readBody(InputStream body, int maxBytes) {
        if (body == null) {
            return new byte[0];
        }
        try {
            // One byte over the cap shows that the body is too large, without reading the rest.
            byte[] bytes = body.readNBytes((int) Math.min(Integer.MAX_VALUE - 8L, maxBytes + 1L));
            if (bytes.length > maxBytes) {
                throw new ExtensionProxyException(413, "The request body is too large for this extension");
            }
            return bytes;
        } catch (IOException e) {
            throw new ExtensionProxyException(400, "The request body cannot be read");
        }
    }

    /**
     * JSON only, so that a cross-site request cannot reach a route with the user's identity. A POST
     * needs a JSON type also with no body: a cross-site form or a bodyless fetch needs no preflight.
     * The other methods need a preflight, which Hub does not allow cross-site.
     */
    static boolean acceptsContentType(String method, byte[] body, String contentType) {
        return "POST".equals(method) ? isJson(contentType) : body.length == 0 || isJson(contentType);
    }

    /** {@code application/json}, or an {@code application/*+json} type such as {@code application/problem+json}. */
    static boolean isJson(String contentType) {
        if (contentType == null) {
            return false;
        }
        String type = mediaType(contentType);
        return type.equals("application/json") || (type.startsWith("application/") && type.endsWith("+json"));
    }

    private static String mediaType(String contentType) {
        int semicolon = contentType.indexOf(';');
        return (semicolon < 0 ? contentType : contentType.substring(0, semicolon)).trim().toLowerCase(Locale.ROOT);
    }

    private static boolean isTimeout(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof HttpTimeoutException) {
                return true;
            }
        }
        return false;
    }

    private static ExtensionProxyException timeout(RegisteredExtension extension, ExtensionManifest.Route route) {
        LOG.warn("Extension {} route {} did not reply in time", extension.id(), route.id());
        return new ExtensionProxyException(504, "The extension did not reply in time");
    }

    private static ExtensionProxyException badGateway() {
        return new ExtensionProxyException(502, "The extension failed");
    }

    /** Fails the reply as soon as it is larger than the cap, so that Hub never buffers more. */
    static final class CappedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {

        private final int maxBytes;
        private final CompletableFuture<byte[]> result = new CompletableFuture<>();
        private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        private Flow.Subscription subscription;

        CappedBodySubscriber(int maxBytes) {
            this.maxBytes = maxBytes;
        }

        @Override
        public CompletionStage<byte[]> getBody() {
            return result;
        }

        @Override
        public void onSubscribe(Flow.Subscription subscription) {
            this.subscription = subscription;
            subscription.request(Long.MAX_VALUE);
        }

        @Override
        public void onNext(List<ByteBuffer> items) {
            if (result.isDone()) {
                return;
            }
            for (ByteBuffer item : items) {
                if (buffer.size() + item.remaining() > maxBytes) {
                    subscription.cancel();
                    result.completeExceptionally(new IOException("The reply is larger than " + maxBytes + " bytes"));
                    return;
                }
                byte[] bytes = new byte[item.remaining()];
                item.get(bytes);
                buffer.write(bytes, 0, bytes.length);
            }
        }

        @Override
        public void onError(Throwable error) {
            result.completeExceptionally(error);
        }

        @Override
        public void onComplete() {
            result.complete(buffer.toByteArray());
        }
    }
}
