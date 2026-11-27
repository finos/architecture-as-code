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
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Predicate;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Calls an extension route for a caller (ADR 0011). The REST proxy and the MCP tools both use this
 * service, so that the same rules apply to each call. Hub builds a new request: no header from the
 * caller reaches the backend except the allow-listed ones, and the caller's token never does. A
 * {@code text/event-stream} reply streams to a caller that accepts it, and to each chat call; any other reply is
 * buffered.
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
    private final ExtensionHubData hubData;
    private final String authMode;
    private final ExtensionChat chat;
    private final ExtensionStreamWatchdog watchdog;
    private final Map<String, HttpClient> clients = new ConcurrentHashMap<>();
    private final Map<String, Semaphore> concurrentCalls = new ConcurrentHashMap<>();
    /** The streams of the generic proxy and MCP, per extension. */
    private final Map<String, Semaphore> concurrentStreams = new ConcurrentHashMap<>();
    /** The streams of the chat endpoint, per extension, so that other streams cannot fill this pool. */
    private final Map<String, Semaphore> concurrentChatStreams = new ConcurrentHashMap<>();
    /** The open streams of each user in each pool. A count of 0 removes its entry, so each entry has an open stream. */
    private final Map<StreamUser, Integer> userStreams = new ConcurrentHashMap<>();

    @Inject
    public ExtensionProxyService(ExtensionRegistry registry, ExtensionIdentitySigner signer,
                                 CalmHubPermissionChecker permissions, AuditService auditService, Config properties,
                                 Instance<ProxyAuthenticationMechanism> proxyAuthentication, ExtensionHubData hubData,
                                 ExtensionStreamWatchdog watchdog) {
        this(registry, signer, permissions, auditService, hubData, authMode(properties, proxyAuthentication.isResolvable()),
                watchdog);
    }

    /** With a watchdog of its own, for a test that streams nothing: the watchdog starts no thread until a stream opens. */
    ExtensionProxyService(ExtensionRegistry registry, ExtensionIdentitySigner signer,
                          CalmHubPermissionChecker permissions, AuditService auditService, String authMode) {
        this(registry, signer, permissions, auditService, null, authMode, ExtensionStreamWatchdog.started());
    }

    ExtensionProxyService(ExtensionRegistry registry, ExtensionIdentitySigner signer, CalmHubPermissionChecker permissions,
                          AuditService auditService, ExtensionHubData hubData, String authMode,
                          ExtensionStreamWatchdog watchdog) {
        this.registry = registry;
        this.signer = signer;
        this.permissions = permissions;
        this.auditService = auditService;
        this.hubData = hubData;
        this.authMode = authMode;
        this.watchdog = watchdog;
        this.chat = new ExtensionChat(permissions, hubData);
    }

    /** The {@code auth} claim: how Hub knows who the caller is. */
    static String authMode(Config properties, boolean proxyAuthentication) {
        if (!properties.getOptionalValue("calm.auth.enabled", Boolean.class).orElse(false)) {
            return "none";
        }
        return proxyAuthentication ? "proxy" : "oidc";
    }

    /**
     * Throws {@link ExtensionProxyException} when Hub refuses the call. A caller that does costly work on
     * the request before {@link #call} uses this first, so that a caller with no scope cannot cause the work.
     */
    public void checkAccess(SecurityIdentity identity, ExtensionProxyRequest request) {
        authorise(identity, request, null, false);
    }

    /** Throws {@link ExtensionProxyException} when Hub refuses the call or the backend fails. */
    public ExtensionProxyResponse call(SecurityIdentity identity, ExtensionProxyRequest request) {
        return call(identity, request, null, null, null, null);
    }

    /**
     * Calls the route owned by a dedicated endpoint. Builds its body after the scope and concurrency checks;
     * validation refusals are audited before anything is sent.
     */
    public ExtensionProxyResponse callDedicated(SecurityIdentity identity, ExtensionProxyRequest request, String routeId,
                                                Supplier<byte[]> body) {
        return call(identity, request, routeId, body, null, null);
    }

    /**
     * Sends a chat message to the route of a {@code chat} entry and streams the reply (hubApi 0 chat contract). Hub
     * checks the message and its context, builds the body, and passes back only the citations that the caller can open.
     * Each chat call is audited as a READ, with the resource that it shares, because the message and any shared document
     * leave Hub. The entry never holds the message text. {@code sourceIp} is for the audit entry only, as in
     * {@link ExtensionProxyRequest}.
     */
    public ExtensionProxyResponse chat(SecurityIdentity identity, String extensionId, String entryId, String contentType,
                                       String acceptLanguage, String sourceIp, InputStream body) {
        RegisteredExtension extension = registry.find(extensionId)
                .orElseThrow(() -> new ExtensionProxyException(404, "There is no such extension"));
        List<ExtensionManifest.RouteContribution> entries = extension.manifest().contributes().chat();
        ExtensionManifest.Route route = (entries == null ? List.<ExtensionManifest.RouteContribution>of() : entries).stream()
                .filter(entry -> entry.id().equals(entryId))
                .findFirst()
                .flatMap(entry -> extension.manifest().route(entry.route()))
                .orElseThrow(() -> new ExtensionProxyException(404, "The extension has no such chat"));
        ExtensionProxyRequest request = new ExtensionProxyRequest(extensionId, "POST", route.path(), null, contentType,
                "text/event-stream", acceptLanguage, null, null, sourceIp, null);
        int maxBytes = extension.limits().maxRequestBytes();
        AtomicReference<ExtensionChat.Context> shared = new AtomicReference<>();
        Supplier<byte[]> message = () -> {
            byte[] built = chat.body(identity, readBody(body, maxBytes), shared::set);
            if (built.length > maxBytes) {
                throw new ExtensionProxyException(413, "The conversation and its shared context are too large for "
                        + "this extension. Start a new conversation, or share no context");
            }
            return built;
        };
        return call(identity, request, route.id(), message,
                new ExtensionEventStream.Policy(chat.citations(identity), ExtensionChat.TERMINAL_EVENTS), shared);
    }

    /**
     * The one path for every call. {@code dedicatedRoute} is the route that a dedicated Hub endpoint calls, or null for
     * the generic proxy and MCP. {@code body} builds the JSON body of a dedicated call; Hub calls it after the scope
     * check and the concurrency limits, so a refusal in it is a FAILURE with no jti, and caps what it builds at
     * max-request-bytes. Without it, Hub sends the caller's body. {@code stream} is null when the caller chooses an event stream with Accept; otherwise the backend must
     * reply with one, and the policy filters and ends it. {@code chatContext} is set only for a chat call, which is
     * always audited: the body builder puts the context that the message shares in it.
     */
    private ExtensionProxyResponse call(SecurityIdentity identity, ExtensionProxyRequest request, String dedicatedRoute,
                                        Supplier<byte[]> build, ExtensionEventStream.Policy streamPolicy,
                                        AtomicReference<ExtensionChat.Context> chatContext) {
        Access access = authorise(identity, request, dedicatedRoute, chatContext != null);
        RegisteredExtension extension = access.extension();
        ExtensionManifest.Route route = access.route();
        String method = access.method();
        ExtensionLimits limits = extension.limits();
        Semaphore calls = concurrentCalls.computeIfAbsent(extension.id(), id -> new Semaphore(limits.maxConcurrentCalls()));
        boolean chatCall = chatContext != null;
        Semaphore streams = chatCall
                ? concurrentChatStreams.computeIfAbsent(extension.id(), id -> new Semaphore(limits.maxConcurrentChatStreams()))
                : concurrentStreams.computeIfAbsent(extension.id(), id -> new Semaphore(limits.maxConcurrentStreams()));
        StreamUser user = new StreamUser(extension.id(), chatCall, identity.getPrincipal().getName());
        boolean stream = streamPolicy != null || acceptsEventStream(request.accept());
        boolean acquired = false;
        boolean streamAcquired = false;
        AtomicBoolean userAcquired = new AtomicBoolean();
        AtomicReference<ExtensionEventStream> opened = new AtomicReference<>();
        // The call and its stream share one release of the pool slot and the user's count, so that they are freed
        // once, whichever of the two frees them first. A second release could free the count of a newer stream.
        AtomicBoolean slotFreed = new AtomicBoolean();
        Runnable freeSlot = () -> {
            if (slotFreed.compareAndSet(false, true)) {
                if (userAcquired.get()) {
                    releaseUserStream(user);
                }
                streams.release();
            }
        };
        // Set when the call returns or fails. A stream that the backend opens after that closes at once.
        AtomicBoolean finished = new AtomicBoolean();
        ExtensionProxyResponse reply = null;
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
            // Before the hubData reads, so that the limit also bounds the reads that Hub does for the extension.
            acquired = calls.tryAcquire();
            if (!acquired) {
                LOG.warn("Extension {} has {} calls in progress, so Hub refused one more", extension.id(),
                        limits.maxConcurrentCalls());
                throw new ExtensionProxyException(503, "The extension is busy. Try again later",
                        Map.of("Retry-After", "1"));
            }
            if (stream) {
                streamAcquired = streams.tryAcquire();
                if (!streamAcquired) {
                    LOG.warn("Extension {} has {} {} open, so Hub refused one more", extension.id(),
                            chatCall ? limits.maxConcurrentChatStreams() : limits.maxConcurrentStreams(),
                            chatCall ? "chat streams" : "streams");
                    throw new ExtensionProxyException(503, "The extension is busy. Try again later",
                            Map.of("Retry-After", "1"));
                }
                userAcquired.set(acquireUserStream(user, limits.maxConcurrentStreamsPerUser()));
                if (!userAcquired.get()) {
                    LOG.warn("A user has {} {} open from extension {}, so Hub refused one more",
                            limits.maxConcurrentStreamsPerUser(), chatCall ? "chat streams" : "streams", extension.id());
                    throw new ExtensionProxyException(503, "You have too many replies open from this extension. "
                            + "Close one and try again", Map.of("Retry-After", "1"));
                }
            }
            String contentType = request.contentType();
            if (route.sendsHubData()) {
                // Hub sends what it read for the caller, never the caller's body, so the extension can trust it.
                body = hubData.body(identity, route, access.parameters(), request.rawQuery());
                contentType = "application/json";
                if (body.length > limits.maxRequestBytes()) {
                    throw new ExtensionProxyException(413, "The document is too large for this extension. "
                            + "The operator can raise its max-request-bytes");
                }
            }
            if (build != null) {
                body = build.get();
                contentType = "application/json";
                if (body.length > limits.maxRequestBytes()) {
                    throw new ExtensionProxyException(413, "The request is too large for this extension. "
                            + "The operator can raise its max-request-bytes");
                }
            }
            String jti = extension.sendsIdentity() ? UUID.randomUUID().toString() : null;
            String assertion = jti == null ? null : signer.sign(new ExtensionAssertion(identity.getPrincipal().getName(),
                    extension.id(), jti, authMode, extension.manifest().hubApi(), route.id(), route.scope(),
                    access.namespace(), access.domain(), method, pathAndQuery), body);
            HttpRequest outbound = outboundRequest(request, contentType, method, target, body, limits, assertion);
            outcome = AuditOutcome.UNKNOWN;
            sentJti = jti;
            ExtensionEventStream.Policy policy = streamPolicy != null ? streamPolicy
                    : new ExtensionEventStream.Policy(event -> true, Set.of());
            HttpResponse.BodyHandler<Object> handler = info -> {
                if (stream && isEventStream(info)) {
                    ExtensionEventStream opening = new ExtensionEventStream(extension.id(), route.id(), limits,
                            policy.events(), policy.terminal(), freeSlot, watchdog);
                    opened.set(opening);
                    if (finished.get()) {
                        // The call timed out while the stream opened, so Hub never passes it on.
                        opening.close();
                    }
                    return HttpResponse.BodySubscribers.mapping(opening, s -> s);
                }
                return HttpResponse.BodySubscribers.mapping(new CappedBodySubscriber(limits.maxResponseBytes()), b -> b);
            };
            reply = send(extension, route, outbound, handler, streamPolicy != null);
            outcome = reply.status() < 400 ? AuditOutcome.SUCCESS
                    : reply.status() == 401 || reply.status() == 403 ? AuditOutcome.DENIED : AuditOutcome.FAILURE;
            return reply;
        } catch (ExtensionProxyException e) {
            // A chat message that shares a resource the caller cannot read.
            if (chatContext != null && e.status() == 403) {
                outcome = AuditOutcome.DENIED;
            }
            throw e;
        } finally {
            if (acquired) {
                calls.release();
            }
            // An open stream frees its own slot when it closes. A stream that Hub does not pass on closes here.
            finished.set(true);
            ExtensionEventStream started = opened.get();
            if (started != null && (reply == null || reply.stream() != started)) {
                started.close();
            } else if (started == null && streamAcquired) {
                freeSlot.run();
            }
            if (chatContext != null) {
                audit(identity, AuditAction.READ, extension, route, access.namespace(), access.domain(), chatContext.get(),
                        sentJti, outcome, request.sourceIp());
            } else if (!route.readOnly()) {
                audit(identity, action(method), extension, route, access.namespace(), access.domain(), null, sentJti,
                        outcome, request.sourceIp());
            }
        }
    }

    /** One user's streams from one extension, in the chat pool or the pool of the generic proxy. */
    private record StreamUser(String extensionId, boolean chat, String user) {
    }

    private boolean acquireUserStream(StreamUser user, int max) {
        boolean[] acquired = {false};
        userStreams.compute(user, (key, open) -> {
            int count = open == null ? 0 : open;
            if (count >= max) {
                return open;
            }
            acquired[0] = true;
            return count + 1;
        });
        return acquired[0];
    }

    private void releaseUserStream(StreamUser user) {
        userStreams.computeIfPresent(user, (key, open) -> open <= 1 ? null : open - 1);
    }

    /** The users with a stream open, counted once per extension and pool. For tests: it must go back to 0. */
    int streamUsers() {
        return userStreams.size();
    }

    private record Access(RegisteredExtension extension, URI backend, String method, String path,
                          ExtensionManifest.Route route, String namespace, String domain, Map<String, String> parameters) {
    }

    /**
     * {@code dedicatedRoute} is the route that a dedicated Hub endpoint calls, or null for the generic proxy and MCP. A
     * dedicated route answers only its endpoint, so the checks of that endpoint cannot be skipped. A {@code chat} call is
     * audited, also when its route is {@code readOnly}.
     */
    private Access authorise(SecurityIdentity identity, ExtensionProxyRequest request, String dedicatedRoute, boolean chat) {
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
        boolean dedicated = extension.manifest().dedicatedRoutes().contains(route.id());
        if (dedicatedRoute == null ? dedicated : !route.id().equals(dedicatedRoute)) {
            throw new ExtensionProxyException(404, "Call this extension route through its CALM Hub endpoint");
        }
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
        boolean audited = !route.readOnly() || chat;
        boolean authorised = isAuthorised(identity, route.scope(), namespace, domain);
        // The backend and the audit log get only the values that Hub checked for the scope.
        namespace = NAMESPACE_SCOPES.contains(route.scope()) ? namespace : null;
        domain = DOMAIN_SCOPES.contains(route.scope()) ? domain : null;
        if (!authorised) {
            if (audited) {
                audit(identity, chat ? AuditAction.READ : action(method), extension, route, namespace, domain, null, null,
                        AuditOutcome.DENIED, request.sourceIp());
            }
            boolean anonymous = identity == null || identity.isAnonymous();
            throw anonymous
                    ? new ExtensionProxyException(401, "Sign in to call this extension")
                    : new ExtensionProxyException(403, "You do not have the scope that this extension route needs");
        }
        return new Access(extension, backend, method, path, route, namespace, domain, match.parameters());
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

    private static AuditAction action(String method) {
        return switch (method) {
            case "GET" -> AuditAction.READ;
            case "POST" -> AuditAction.CREATE;
            case "DELETE" -> AuditAction.DELETE;
            default -> AuditAction.UPDATE;
        };
    }

    /** {@code shared} is the resource that a chat call shares, or null. Its namespace replaces the route's. */
    private void audit(SecurityIdentity identity, AuditAction action, RegisteredExtension extension,
                       ExtensionManifest.Route route, String namespace, String domain, ExtensionChat.Context shared,
                       String jti, AuditOutcome outcome, String sourceIp) {
        auditService.record(new AuditLogEntry.AuditLogEntryBuilder()
                .setTimestamp(LocalDateTime.now(ZoneOffset.UTC))
                .setActor(identity == null || identity.isAnonymous() ? "anonymous" : identity.getPrincipal().getName())
                .setAction(action)
                .setEntityType(AuditEntityType.EXTENSION)
                .setNamespace(shared == null ? namespace : shared.namespace())
                .setDomain(domain)
                .setVersion(shared == null ? null : shared.version())
                .setResourceType(shared == null ? null : shared.resourceType())
                .setResourceId(shared == null ? null : shared.resourceId())
                .setEntityId(extension.id())
                .setRoute(route.id())
                .setJti(jti)
                .setOutcome(outcome)
                .setSourceIp(sourceIp)
                .build());
    }

    private static HttpRequest outboundRequest(ExtensionProxyRequest request, String contentType, String method,
                                               URI target, byte[] body, ExtensionLimits limits, String assertion) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(target)
                    .timeout(limits.requestTimeout())
                    .method(method, body.length == 0
                            ? HttpRequest.BodyPublishers.noBody()
                            : HttpRequest.BodyPublishers.ofByteArray(body));
            if (assertion != null) {
                builder.header(ExtensionIdentitySigner.HEADER, assertion);
            }
            copyHeader(builder, "Content-Type", contentType);
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

    private ExtensionProxyResponse send(RegisteredExtension extension, ExtensionManifest.Route route, HttpRequest outbound,
                                        HttpResponse.BodyHandler<Object> handler, boolean streamRequired) {
        ExtensionLimits limits = extension.limits();
        CompletableFuture<HttpResponse<Object>> future = client(extension).sendAsync(outbound, handler);
        HttpResponse<Object> response;
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
        return reply(extension, route, response, streamRequired);
    }

    private static ExtensionProxyResponse reply(RegisteredExtension extension, ExtensionManifest.Route route,
                                                HttpResponse<Object> response, boolean streamRequired) {
        int status = response.statusCode();
        if (response.body() instanceof ExtensionEventStream stream) {
            // Each event goes out when it arrives, so a reverse proxy must not buffer the reply.
            return new ExtensionProxyResponse(status, Map.of("Content-Type", "text/event-stream; charset=utf-8",
                    "Cache-Control", "private, no-store", "X-Accel-Buffering", "no"), new byte[0], stream);
        }
        byte[] body = (byte[]) response.body();
        if (streamRequired && status >= 200 && status < 300) {
            LOG.warn("Extension {} route {} returned status {} without the event stream that its Hub endpoint needs",
                    extension.id(), route.id(), status);
            throw badGateway();
        }
        // A 401 or 407 would start a login in the caller. Hub never passes on Location, because it names the
        // private backend, so a redirect cannot be followed; a 304 needs none.
        boolean passOn = (status >= 200 && status < 300) || status == 304
                || (status >= 400 && status < 500 && status != 401 && status != 407);
        String contentType = response.headers().firstValue("Content-Type").orElse(null);
        boolean typeAllowed = contentType == null ? body.length == 0
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
        return new ExtensionProxyResponse(status, headers, body);
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

    /** A caller that names {@code text/event-stream} in {@code Accept} gets an event stream reply as it arrives. */
    static boolean acceptsEventStream(String accept) {
        if (accept == null) {
            return false;
        }
        for (String range : accept.split(",")) {
            if (mediaType(range).equals("text/event-stream")) {
                return true;
            }
        }
        return false;
    }

    /** Only a 200: JAX-RS can skip the body of another 2xx, such as a 204. */
    private static boolean isEventStream(HttpResponse.ResponseInfo info) {
        return info.statusCode() == 200 && info.headers().firstValue("Content-Type")
                .map(ExtensionProxyService::mediaType).filter("text/event-stream"::equals).isPresent();
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
