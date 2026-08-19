package org.finos.calm.security;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.config.ConfigProvider;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditOutcome;
import org.finos.calm.resources.AdrResource;
import org.finos.calm.resources.ArchitectureResource;
import org.finos.calm.resources.ControlResource;
import org.finos.calm.resources.CoreSchemaResource;
import org.finos.calm.resources.DecoratorResource;
import org.finos.calm.resources.DocumentResource;
import org.finos.calm.resources.DomainResource;
import org.finos.calm.resources.DomainUserAccessResource;
import org.finos.calm.resources.FlowResource;
import org.finos.calm.resources.InterfaceResource;
import org.finos.calm.resources.LayoutResource;
import org.finos.calm.resources.MappingControllerResource;
import org.finos.calm.resources.NamespaceResource;
import org.finos.calm.resources.PatternLayoutResource;
import org.finos.calm.resources.PatternResource;
import org.finos.calm.resources.StandardResource;
import org.finos.calm.resources.TimelineResource;
import org.finos.calm.resources.UserAccessResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

import static org.finos.calm.resources.ResourceValidationConstants.STRICT_SANITIZATION_POLICY;

/**
 * Captures an {@link AuditLogEntry} for every mutating (POST/PUT/DELETE) request that
 * completes with a {@code SUCCESS} (2xx) or {@code DENIED} (401/403) outcome.
 *
 * <p>Deliberately a plain {@link ContainerResponseFilter} — <strong>not</strong>
 * {@code @PreMatching} like {@link ReadOnlyRequestFilter} — because it needs
 * {@link UriInfo#getPathParameters()} resolved, which only happens after JAX-RS
 * routing/resource-matching. Running post-matching also means this filter observes
 * the final response, including responses produced by a {@code @PermissionsAllowed}
 * denial (a thrown security exception mapped to 401/403), so denied mutation attempts
 * are captured with no less fidelity than successful ones for endpoints that already
 * carry an existing-entity path parameter.</p>
 *
 * <h2>How entity identity is resolved, without per-endpoint code</h2>
 * <ol>
 *   <li><b>Staged audit context</b> — a small number of endpoints where the entity's
 *       identity can only be determined from the request body, not the URL, stage an
 *       {@link AuditContext} via {@link #stage} before their permission check runs
 *       (see {@code NamespaceResource#createNamespace} and
 *       {@code MappingControllerResource}'s two generic {@code /calm} write methods).
 *       When present, it is used verbatim and no further resolution happens.</li>
 *   <li><b>Path parameters</b> — nearly every other mutating endpoint already encodes
 *       {@code namespace}/{@code domain} + the entity's own ID + {@code version} as
 *       JAX-RS path template parameters, so this filter reads them directly.</li>
 *   <li><b>{@code Location} response header</b> — for server-generated-ID create
 *       endpoints (the entity's own ID isn't in the request path at all), every one of
 *       them returns {@code Response.created(URI)} on success with a {@code Location}
 *       that encodes the new entity's identity. {@link LocationSegmentParser} extracts
 *       it. This only applies to {@code SUCCESS} outcomes — on {@code DENIED}, no store
 *       call (and thus no {@code Location}) ever happens, so {@code entityId} is
 *       {@code null} for the small number of endpoints that are both server-generated-ID
 *       and denied via a {@code @PermissionsAllowed} interceptor (which rejects before
 *       the method body runs, so no hook could stage a context either). This is an
 *       accepted, narrow gap — see the design discussion referenced from the audit
 *       logging feature proposal.</li>
 * </ol>
 *
 * <h2>{@code action} derivation — a documented simplification</h2>
 * A {@code POST} to a path that already names an existing entity's own ID (e.g.
 * {@code POST .../architectures/{architectureId}/versions/{version}}) is labeled
 * {@code UPDATE}, even when that call happens to create the very first version of a
 * brand-new resource. Distinguishing "first version" from "Nth version" from path shape
 * alone isn't reliable without a store round-trip this filter deliberately avoids doing.
 * {@code entityId}/{@code version} retain full fidelity regardless — only the coarse
 * {@code action} label is affected.
 *
 * <h2>Read-only mode</h2>
 * No special-casing is needed: {@code calm.readonly=true} installs
 * {@link ReadOnlyRequestFilter} at {@code @PreMatching @Priority(0)}, which rejects
 * every mutating verb with 405 before routing — before this (post-matching) filter
 * would ever see the request. 405 is also not in the SUCCESS/DENIED status set this
 * filter records, so no mutation can ever reach this filter's recording logic in
 * read-only mode.
 *
 * <h2>{@code no-auth} mode</h2>
 * {@link #resolveActor()} returns {@code identity.getPrincipal().getName()} for any
 * non-anonymous identity. In {@code no-auth} mode every caller is granted the same
 * trusted, non-anonymous principal literally named {@code "no-auth"}
 * ({@code NoAuthAuthenticationMechanism}), so every audit record's {@code actor} field
 * is that shared literal, not a real per-caller username — a known limitation of that
 * deployment mode this filter cannot fix. {@link AuditService#init()} logs a one-time
 * startup warning about this when audit recording is enabled alongside {@code no-auth}.
 */
@ApplicationScoped
@Provider
public class AuditRequestFilter implements ContainerResponseFilter {

    private static final Logger LOG = LoggerFactory.getLogger(AuditRequestFilter.class);

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "DELETE");
    private static final Set<Integer> DENIED_STATUSES = Set.of(401, 403);

    /**
     * A pre-resolved audit context, staged by a resource method (via {@link #stage})
     * before its manual permission check runs, for the handful of endpoints where the
     * entity's identity lives only in the request body. Not used by endpoints guarded
     * by {@code @PermissionsAllowed}, since that interceptor rejects the request before
     * any resource-method code — including a staging call — could run.
     */
    public record AuditContext(AuditEntityType entityType, AuditAction action,
                                String namespace, String domain, String entityId, String version) {
    }

    /**
     * Holds a staged {@link AuditContext} for the in-flight request. {@code jakarta.ws.rs.container.ContainerRequestContext}
     * is only injectable into JAX-RS providers (filters), not into arbitrary resource
     * method parameters via {@code @Context} — RESTEasy Classic rejects that with
     * {@code RESTEASY003880}. A {@link ThreadLocal} is used instead, which is safe here
     * because RESTEasy Classic's {@code SynchronousDispatcher} invokes the resource
     * method and this filter on the same worker thread within one request.
     */
    private static final ThreadLocal<AuditContext> STAGED_CONTEXT = new ThreadLocal<>();

    /**
     * Stages an {@link AuditContext} for the in-flight request. Call this from a
     * resource method, after parsing the request body enough to know the entity's
     * identity, but before performing a manual (non-{@code @PermissionsAllowed})
     * permission check — so the context is available regardless of whether that check
     * denies the request.
     */
    public static void stage(AuditContext context) {
        STAGED_CONTEXT.set(context);
    }

    private static final Map<Class<?>, AuditEntityType> RESOURCE_CLASS_TO_ENTITY_TYPE = Map.ofEntries(
            Map.entry(NamespaceResource.class, AuditEntityType.NAMESPACE),
            Map.entry(DomainResource.class, AuditEntityType.DOMAIN),
            Map.entry(ArchitectureResource.class, AuditEntityType.ARCHITECTURE),
            Map.entry(PatternResource.class, AuditEntityType.PATTERN),
            Map.entry(FlowResource.class, AuditEntityType.FLOW),
            Map.entry(InterfaceResource.class, AuditEntityType.INTERFACE),
            Map.entry(StandardResource.class, AuditEntityType.STANDARD),
            Map.entry(DocumentResource.class, AuditEntityType.DOCUMENT),
            Map.entry(TimelineResource.class, AuditEntityType.TIMELINE),
            Map.entry(AdrResource.class, AuditEntityType.ADR),
            Map.entry(DecoratorResource.class, AuditEntityType.DECORATOR),
            Map.entry(UserAccessResource.class, AuditEntityType.USER_ACCESS),
            Map.entry(DomainUserAccessResource.class, AuditEntityType.USER_ACCESS),
            Map.entry(CoreSchemaResource.class, AuditEntityType.SCHEMA),
            Map.entry(LayoutResource.class, AuditEntityType.LAYOUT),
            Map.entry(PatternLayoutResource.class, AuditEntityType.PATTERN_LAYOUT)
    );

    /** The path parameter that names an entity's own ID, for types resolved generically via path params. */
    private static final Map<AuditEntityType, String> ENTITY_TYPE_TO_ID_PARAM = Map.ofEntries(
            Map.entry(AuditEntityType.ARCHITECTURE, "architectureId"),
            Map.entry(AuditEntityType.PATTERN, "patternId"),
            Map.entry(AuditEntityType.FLOW, "flowId"),
            Map.entry(AuditEntityType.INTERFACE, "interfaceId"),
            Map.entry(AuditEntityType.STANDARD, "standardId"),
            Map.entry(AuditEntityType.DOCUMENT, "id"),
            Map.entry(AuditEntityType.TIMELINE, "timelineId"),
            Map.entry(AuditEntityType.ADR, "adrId"),
            Map.entry(AuditEntityType.DECORATOR, "id"),
            Map.entry(AuditEntityType.USER_ACCESS, "userAccessId"),
            Map.entry(AuditEntityType.LAYOUT, "architectureId"),
            Map.entry(AuditEntityType.PATTERN_LAYOUT, "patternId")
    );

    @Inject
    AuditService auditService;

    @Inject
    SecurityIdentity identity;

    @Context
    ResourceInfo resourceInfo;

    // Resolved once at runtime startup via @PostConstruct, not @ConfigProperty field
    // injection — see AuditService's javadoc for why (native-image runtime-config safety).
    // Package-private so unit tests can override the resolved value.
    boolean captureSourceIp;

    @PostConstruct
    void init() {
        captureSourceIp = ConfigProvider.getConfig()
                .getOptionalValue("calm.audit.capture-source-ip", Boolean.class)
                .orElse(false);
    }

    @Override
    public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
        try {
            recordIfMutating(requestContext, responseContext);
        } finally {
            // Always clear, even for non-mutating/non-staged requests, so a staged context
            // never leaks onto a later, unrelated request handled by the same worker thread.
            STAGED_CONTEXT.remove();
        }
    }

    private void recordIfMutating(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
        String method = requestContext.getMethod();
        if (!MUTATING_METHODS.contains(method)) {
            return;
        }
        AuditOutcome outcome = resolveOutcome(responseContext.getStatus());
        if (outcome == null) {
            return;
        }
        if (resourceInfo == null || resourceInfo.getResourceClass() == null) {
            return;
        }

        AuditContext staged = STAGED_CONTEXT.get();
        UriInfo uriInfo = requestContext.getUriInfo();

        AuditContext resolved = staged != null
                ? staged
                : resolve(resourceInfo, uriInfo, method, outcome, responseContext);
        if (resolved == null) {
            return;
        }

        AuditLogEntry entry = new AuditLogEntry.AuditLogEntryBuilder()
                .setTimestamp(LocalDateTime.now(ZoneOffset.UTC))
                .setActor(resolveActor())
                .setAction(resolved.action())
                .setEntityType(resolved.entityType())
                .setNamespace(resolved.namespace())
                .setDomain(resolved.domain())
                .setEntityId(resolved.entityId())
                .setVersion(resolved.version())
                .setOutcome(outcome)
                .setSourceIp(captureSourceIp ? requestContext.getHeaderString("X-Forwarded-For") : null)
                .build();

        auditService.record(entry);
    }

    private static AuditOutcome resolveOutcome(int status) {
        if (status >= 200 && status < 300) {
            return AuditOutcome.SUCCESS;
        }
        if (DENIED_STATUSES.contains(status)) {
            return AuditOutcome.DENIED;
        }
        return null;
    }

    private String resolveActor() {
        return identity == null || identity.isAnonymous() ? "anonymous" : identity.getPrincipal().getName();
    }

    private AuditContext resolve(ResourceInfo resourceInfo, UriInfo uriInfo, String method,
                                   AuditOutcome outcome, ContainerResponseContext responseContext) {
        Class<?> resourceClass = resourceInfo.getResourceClass();
        String methodName = resourceInfo.getResourceMethod() == null ? "" : resourceInfo.getResourceMethod().getName();

        if (resourceClass == ControlResource.class) {
            return resolveControlResource(methodName, uriInfo, outcome, responseContext);
        }
        if (resourceClass == MappingControllerResource.class) {
            return resolveMappingController(methodName, uriInfo, outcome, responseContext);
        }

        AuditEntityType entityType = RESOURCE_CLASS_TO_ENTITY_TYPE.get(resourceClass);
        if (entityType == null) {
            return null;
        }
        return resolveGeneric(entityType, uriInfo, method, outcome, responseContext);
    }

    /**
     * The generic resolution path used by every resource class with a simple 1:1
     * {@link AuditEntityType} mapping (i.e. everything except {@link ControlResource}
     * and {@code MappingControllerResource}, which have multiple entity shapes per class).
     */
    private AuditContext resolveGeneric(AuditEntityType entityType, UriInfo uriInfo, String method,
                                          AuditOutcome outcome, ContainerResponseContext responseContext) {
        String namespace = uriInfo.getPathParameters().getFirst("namespace");
        String domain = uriInfo.getPathParameters().getFirst("domain");
        String version = uriInfo.getPathParameters().getFirst("version");
        String idParam = ENTITY_TYPE_TO_ID_PARAM.get(entityType);
        String pathEntityId = idParam == null ? null : uriInfo.getPathParameters().getFirst(idParam);
        boolean isUserAccessPath = uriInfo.getPath().contains("/user-access");

        AuditAction action;
        if ("PUT".equals(method)) {
            action = AuditAction.UPDATE;
        } else if (isUserAccessPath) {
            action = "POST".equals(method) ? AuditAction.GRANT : AuditAction.REVOKE;
        } else if ("POST".equals(method)) {
            action = pathEntityId != null ? AuditAction.UPDATE : AuditAction.CREATE;
        } else if ("DELETE".equals(method)) {
            action = AuditAction.DELETE;
        } else {
            return null;
        }

        String entityId = pathEntityId;
        // Resolved independently: some types (e.g. ADR) have entityId in the path but no
        // "version" path param at all, so the revision number can only come from Location —
        // gating both on a single "entityId == null" check would silently skip that fallback.
        if ((entityId == null || version == null) && outcome == AuditOutcome.SUCCESS) {
            LocationSegmentParser.LocationIds ids = LocationSegmentParser.parse(entityType, locationPath(responseContext));
            if (entityId == null) {
                entityId = ids.entityId();
            }
            if (version == null) {
                version = ids.version();
            }
        }

        // A domain has no separate parent scope — it IS the scope, the same way namespace
        // creation reports its name via `namespace`, not `entityId` (see NamespaceResource
        // #createNamespace). Without this, DomainResource#createDomain would be the only
        // domain-scoped action reporting the domain's name via entityId instead of domain,
        // splitting a single domain's audit trail across two fields depending on action.
        if (entityType == AuditEntityType.DOMAIN && domain == null) {
            domain = entityId;
            entityId = null;
        }

        return new AuditContext(entityType, action, namespace, domain, entityId, version);
    }

    private AuditContext resolveControlResource(String methodName, UriInfo uriInfo, AuditOutcome outcome,
                                                  ContainerResponseContext responseContext) {
        String domain = uriInfo.getPathParameters().getFirst("domain");
        String version = uriInfo.getPathParameters().getFirst("version");

        return switch (methodName) {
            case "createControlForDomain" -> resolveWithLocationFallback(
                    AuditEntityType.CONTROL_REQUIREMENT, domain, outcome, responseContext);
            case "createRequirementForVersion" -> new AuditContext(AuditEntityType.CONTROL_REQUIREMENT,
                    AuditAction.UPDATE, null, domain, uriInfo.getPathParameters().getFirst("controlId"), version);
            case "createControlConfiguration" -> resolveWithLocationFallback(
                    AuditEntityType.CONTROL_CONFIGURATION, domain, outcome, responseContext);
            case "createConfigurationForVersion" -> new AuditContext(AuditEntityType.CONTROL_CONFIGURATION,
                    AuditAction.UPDATE, null, domain, uriInfo.getPathParameters().getFirst("configId"), version);
            default -> null;
        };
    }

    private AuditContext resolveMappingController(String methodName, UriInfo uriInfo, AuditOutcome outcome,
                                                     ContainerResponseContext responseContext) {
        String namespace = uriInfo.getPathParameters().getFirst("namespace");
        String domain = uriInfo.getPathParameters().getFirst("domain");
        String version = uriInfo.getPathParameters().getFirst("version");

        return switch (methodName) {
            // createResourceFromDocument / updateResourceFromDocument stage an AuditContext
            // themselves (see class javadoc) — if we get here, staging didn't happen (e.g.
            // a defensive fallback), so there's nothing reliable to report.
            case "createResourceFromDocument", "updateResourceFromDocument" -> null;
            case "createResourceVersion" -> {
                AuditEntityType entityType = resourceTypeToEntityType(
                        uriInfo.getPathParameters().getFirst("type"));
                yield entityType == null ? null : new AuditContext(entityType, AuditAction.UPDATE,
                        namespace, null, uriInfo.getPathParameters().getFirst("name"), version);
            }
            case "createDomain" -> resolveWithLocationFallback(
                    AuditEntityType.DOMAIN, null, outcome, responseContext);
            case "createRequirementVersion" -> new AuditContext(AuditEntityType.CONTROL_REQUIREMENT,
                    AuditAction.UPDATE, null, domain, uriInfo.getPathParameters().getFirst("controlName"), version);
            case "createConfigurationVersion" -> new AuditContext(AuditEntityType.CONTROL_CONFIGURATION,
                    AuditAction.UPDATE, null, domain, uriInfo.getPathParameters().getFirst("configName"), version);
            default -> null;
        };
    }

    /**
     * Resolution for the small set of server-generated-ID CREATE endpoints whose entity
     * isn't namespace-scoped and has no known ID until the store call succeeds (domain
     * creation, initial control creation). Every real call site is a CREATE with no
     * namespace and no already-known entity ID — those aren't parameters because nothing
     * ever varies them; only {@code entityType} and {@code domain} do.
     */
    private AuditContext resolveWithLocationFallback(AuditEntityType entityType, String domain,
                                                        AuditOutcome outcome, ContainerResponseContext responseContext) {
        String entityId = null;
        String version = null;
        if (outcome == AuditOutcome.SUCCESS) {
            LocationSegmentParser.LocationIds ids = LocationSegmentParser.parse(entityType, locationPath(responseContext));
            entityId = ids.entityId();
            version = ids.version();
        }
        // See the matching comment in resolveGeneric: a domain IS the scope, so its name
        // belongs in `domain`, not `entityId` — MappingControllerResource#createDomain
        // is the only caller of this method with entityType DOMAIN, and always passes
        // domain == null, so this never overrides a real parent-domain scope.
        if (entityType == AuditEntityType.DOMAIN && domain == null) {
            domain = entityId;
            entityId = null;
        }
        return new AuditContext(entityType, AuditAction.CREATE, null, domain, entityId, version);
    }

    /**
     * Maps the {@code {type}} path segment used by MappingControllerResource's
     * name-based endpoints (e.g. {@code "patterns"}) to an {@link AuditEntityType},
     * reusing {@link org.finos.calm.resources.CalmDocumentParser#TYPE_MAP} rather than
     * duplicating its plural-segment-to-type parsing.
     */
    private static AuditEntityType resourceTypeToEntityType(String pathType) {
        if (pathType == null) {
            return null;
        }
        org.finos.calm.domain.ResourceType resourceType =
                org.finos.calm.resources.CalmDocumentParser.TYPE_MAP.get(pathType.toLowerCase());
        if (resourceType == null) {
            return null;
        }
        return AuditEntityType.valueOf(resourceType.name());
    }

    private static String locationPath(ContainerResponseContext responseContext) {
        Object location = responseContext.getHeaders().getFirst("Location");
        if (location == null) {
            return null;
        }
        if (location instanceof URI uri) {
            return uri.getPath();
        }
        try {
            return URI.create(location.toString()).getPath();
        } catch (IllegalArgumentException e) {
            LOG.debug("Could not parse Location header [{}] for audit logging",
                    STRICT_SANITIZATION_POLICY.sanitize(location.toString()), e);
            return null;
        }
    }
}
