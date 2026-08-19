package org.finos.calm.security;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.UriInfo;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditOutcome;
import org.finos.calm.resources.AdrResource;
import org.finos.calm.resources.ArchitectureResource;
import org.finos.calm.resources.ControlResource;
import org.finos.calm.resources.DecoratorResource;
import org.finos.calm.resources.DocumentResource;
import org.finos.calm.resources.DomainResource;
import org.finos.calm.resources.DomainUserAccessResource;
import org.finos.calm.resources.MappingControllerResource;
import org.finos.calm.resources.NamespaceResource;
import org.finos.calm.resources.UserAccessResource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.MockitoAnnotations;

import java.lang.reflect.Method;
import java.net.URI;
import java.security.Principal;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class TestAuditRequestFilterShould {

    private AuditRequestFilter filter;
    private AuditService auditService;
    private SecurityIdentity identity;
    private ResourceInfo resourceInfo;

    @BeforeEach
    void setup() {
        MockitoAnnotations.openMocks(this);
        filter = new AuditRequestFilter();
        auditService = mock(AuditService.class);
        identity = mock(SecurityIdentity.class);
        resourceInfo = mock(ResourceInfo.class);
        filter.auditService = auditService;
        filter.identity = identity;
        filter.resourceInfo = resourceInfo;
        filter.captureSourceIp = false;

        Principal principal = mock(Principal.class);
        when(principal.getName()).thenReturn("alice");
        when(identity.isAnonymous()).thenReturn(false);
        when(identity.getPrincipal()).thenReturn(principal);
    }

    @AfterEach
    void cleanup() {
        // Defensive: ensure no staged context leaks between tests sharing this JVM's threads.
        AuditRequestFilter.stage(null);
    }

    private ContainerRequestContext mockRequest(String method, MultivaluedMap<String, String> pathParams) {
        ContainerRequestContext requestContext = mock(ContainerRequestContext.class);
        UriInfo uriInfo = mock(UriInfo.class);
        when(requestContext.getMethod()).thenReturn(method);
        when(requestContext.getUriInfo()).thenReturn(uriInfo);
        when(uriInfo.getPathParameters()).thenReturn(pathParams);
        when(uriInfo.getPath()).thenReturn("");
        return requestContext;
    }

    private ContainerResponseContext mockResponse(int status, String location) {
        ContainerResponseContext responseContext = mock(ContainerResponseContext.class);
        when(responseContext.getStatus()).thenReturn(status);
        MultivaluedMap<String, Object> headers = new MultivaluedHashMap<>();
        if (location != null) {
            headers.putSingle("Location", URI.create(location));
        }
        when(responseContext.getHeaders()).thenReturn(headers);
        return responseContext;
    }

    // java.lang.reflect.Method isn't reliably mockable across JDK versions, so a real
    // Method object is used instead of mocking Method directly. Reflecting against the
    // ACTUAL resource class (not a same-named stub) means renaming the real method in
    // ControlResource/MappingControllerResource fails this lookup immediately, rather
    // than leaving the string-matching dispatch in AuditRequestFilter unprotected.
    private Method mockMethod(Class<?> resourceClass, String name) {
        for (Method method : resourceClass.getDeclaredMethods()) {
            if (method.getName().equals(name)) {
                return method;
            }
        }
        throw new IllegalStateException("No method named '" + name + "' found on " + resourceClass);
    }

    private AuditLogEntry captureRecordedEntry() {
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditService).record(captor.capture());
        return captor.getValue();
    }

    // --- Fast-exit behaviour -------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {"GET", "HEAD", "OPTIONS"})
    void never_record_for_non_mutating_methods(String method) {
        ContainerRequestContext requestContext = mockRequest(method, new MultivaluedHashMap<>());
        ContainerResponseContext responseContext = mockResponse(200, null);

        filter.filter(requestContext, responseContext);

        verify(auditService, never()).record(any());
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 404, 409, 500})
    void never_record_for_unwatched_status_codes(int status) {
        when(resourceInfo.getResourceClass()).thenReturn((Class) ArchitectureResource.class);
        ContainerRequestContext requestContext = mockRequest("POST", new MultivaluedHashMap<>());
        ContainerResponseContext responseContext = mockResponse(status, null);

        filter.filter(requestContext, responseContext);

        verify(auditService, never()).record(any());
    }

    @Test
    void never_record_when_no_route_matched() {
        when(resourceInfo.getResourceClass()).thenReturn(null);
        ContainerRequestContext requestContext = mockRequest("POST", new MultivaluedHashMap<>());
        ContainerResponseContext responseContext = mockResponse(201, null);

        filter.filter(requestContext, responseContext);

        verify(auditService, never()).record(any());
    }

    // --- Path-param based resolution -----------------------------------------

    @Test
    void record_update_via_path_params_on_success() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) ArchitectureResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        pathParams.putSingle("architectureId", "2");
        pathParams.putSingle("version", "1.0.1");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext = mockResponse(201, null);

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.ARCHITECTURE));
        assertThat(entry.getAction(), is(AuditAction.UPDATE));
        assertThat(entry.getNamespace(), is("finos"));
        assertThat(entry.getEntityId(), is("2"));
        assertThat(entry.getVersion(), is("1.0.1"));
        assertThat(entry.getOutcome(), is(AuditOutcome.SUCCESS));
        assertThat(entry.getActor(), is("alice"));
    }

    @Test
    void record_denied_via_path_params_when_permission_denied() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) ArchitectureResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        pathParams.putSingle("architectureId", "2");
        pathParams.putSingle("version", "1.0.1");
        ContainerRequestContext requestContext = mockRequest("PUT", pathParams);
        ContainerResponseContext responseContext = mockResponse(403, null);

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getOutcome(), is(AuditOutcome.DENIED));
        assertThat(entry.getNamespace(), is("finos"));
        assertThat(entry.getEntityId(), is("2"));
        assertThat(entry.getAction(), is(AuditAction.UPDATE));
    }

    @Test
    void treat_put_as_update() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) ArchitectureResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        pathParams.putSingle("architectureId", "2");
        pathParams.putSingle("version", "1.0.1");
        ContainerRequestContext requestContext = mockRequest("PUT", pathParams);
        ContainerResponseContext responseContext = mockResponse(201, null);

        filter.filter(requestContext, responseContext);

        assertThat(captureRecordedEntry().getAction(), is(AuditAction.UPDATE));
    }

    @Test
    void treat_delete_as_delete_for_generic_resources() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) NamespaceResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        ContainerRequestContext requestContext = mockRequest("DELETE", pathParams);
        ContainerResponseContext responseContext = mockResponse(204, null);

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.NAMESPACE));
        assertThat(entry.getAction(), is(AuditAction.DELETE));
        assertThat(entry.getNamespace(), is("finos"));
        assertThat(entry.getOutcome(), is(AuditOutcome.SUCCESS));
    }

    // --- Location-header fallback for server-generated IDs --------------------

    @Test
    void resolve_entity_id_and_version_from_location_on_create() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) ArchitectureResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext =
                mockResponse(201, "/api/calm/namespaces/finos/architectures/7/versions/1.0.0");

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getAction(), is(AuditAction.CREATE));
        assertThat(entry.getEntityId(), is("7"));
        assertThat(entry.getVersion(), is("1.0.0"));
    }

    @Test
    void resolve_document_create_from_location() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) DocumentResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext = mockResponse(201,
                "/api/calm/namespaces/finos/documents/pattern/5/versions/1.0.0");

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.DOCUMENT));
        assertThat(entry.getEntityId(), is("5"));
        assertThat(entry.getVersion(), is("1.0.0"));
    }

    @Test
    void resolve_document_version_write_from_path_parameters() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) DocumentResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        pathParams.putSingle("id", "5");
        pathParams.putSingle("version", "1.0.1");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext = mockResponse(201, null);

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.DOCUMENT));
        assertThat(entry.getEntityId(), is("5"));
        assertThat(entry.getVersion(), is("1.0.1"));
        assertThat(entry.getAction(), is(AuditAction.UPDATE));
    }

    @Test
    void leave_entity_id_null_when_denied_and_no_path_param_or_staged_context() {
        // DomainResource.createDomain: @PermissionsAllowed-denied, no domain-name path param.
        when(resourceInfo.getResourceClass()).thenReturn((Class) DomainResource.class);
        ContainerRequestContext requestContext = mockRequest("POST", new MultivaluedHashMap<>());
        ContainerResponseContext responseContext = mockResponse(403, null);

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getOutcome(), is(AuditOutcome.DENIED));
        assertThat(entry.getEntityType(), is(AuditEntityType.DOMAIN));
        assertNull(entry.getEntityId());
    }

    @Test
    void resolve_domain_creation_via_location_into_domain_field_not_entity_id() {
        // DomainResource.createDomain: no domain-name path param, resolved generically —
        // a domain is its own scope, so its name belongs in `domain`, matching how
        // DomainResource.deleteDomain reports it via the {domain} path param.
        when(resourceInfo.getResourceClass()).thenReturn((Class) DomainResource.class);
        ContainerRequestContext requestContext = mockRequest("POST", new MultivaluedHashMap<>());
        ContainerResponseContext responseContext = mockResponse(201, "/api/calm/domains/payments");

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.DOMAIN));
        assertThat(entry.getAction(), is(AuditAction.CREATE));
        assertThat(entry.getDomain(), is("payments"));
        assertNull(entry.getEntityId());
    }

    @Test
    void resolve_adr_create_via_revisions_location() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) AdrResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext =
                mockResponse(201, "/api/calm/namespaces/finos/adrs/9/revisions/1");

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityId(), is("9"));
        assertThat(entry.getVersion(), is("1"));
        assertThat(entry.getAction(), is(AuditAction.CREATE));
    }

    @Test
    void resolve_adr_update_directly_from_path_param() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) AdrResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        pathParams.putSingle("adrId", "9");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext =
                mockResponse(201, "/api/calm/namespaces/finos/adrs/9/revisions/2");

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityId(), is("9"));
        assertThat(entry.getAction(), is(AuditAction.UPDATE));
        // Regression check: entityId came from the path param, but the revision number has
        // no path param at all — it must still be resolved from the Location header.
        assertThat(entry.getVersion(), is("2"));
    }

    // --- Decorator (own-id param is "id") --------------------------------------

    @Test
    void resolve_decorator_create_via_location() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) DecoratorResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext =
                mockResponse(201, "/api/calm/namespaces/finos/decorators/4");

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityId(), is("4"));
        assertThat(entry.getAction(), is(AuditAction.CREATE));
    }

    // --- user-access GRANT/REVOKE ----------------------------------------------

    @Test
    void treat_post_to_user_access_path_as_grant() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) UserAccessResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        when(requestContext.getUriInfo().getPath()).thenReturn("finos/user-access");
        ContainerResponseContext responseContext =
                mockResponse(201, "/api/calm/namespaces/finos/user-access/3");

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getAction(), is(AuditAction.GRANT));
        assertThat(entry.getEntityId(), is("3"));
    }

    @Test
    void treat_delete_to_user_access_path_as_revoke() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) DomainUserAccessResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("domain", "payments");
        pathParams.putSingle("userAccessId", "5");
        ContainerRequestContext requestContext = mockRequest("DELETE", pathParams);
        when(requestContext.getUriInfo().getPath()).thenReturn("payments/user-access/5");
        ContainerResponseContext responseContext = mockResponse(204, null);

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getAction(), is(AuditAction.REVOKE));
        assertThat(entry.getDomain(), is("payments"));
        assertThat(entry.getEntityId(), is("5"));
    }

    // --- ControlResource dispatch ------------------------------------------------

    @Test
    void resolve_control_requirement_creation_via_location() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) ControlResource.class);
        when(resourceInfo.getResourceMethod()).thenReturn(mockMethod(ControlResource.class, "createControlForDomain"));
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("domain", "payments");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext =
                mockResponse(201, "/api/calm/domains/payments/controls/11");

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.CONTROL_REQUIREMENT));
        assertThat(entry.getDomain(), is("payments"));
        assertThat(entry.getEntityId(), is("11"));
        assertThat(entry.getAction(), is(AuditAction.CREATE));
    }

    @Test
    void resolve_control_configuration_creation_via_location() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) ControlResource.class);
        when(resourceInfo.getResourceMethod()).thenReturn(mockMethod(ControlResource.class, "createControlConfiguration"));
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("domain", "payments");
        pathParams.putSingle("controlId", "11");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext =
                mockResponse(201, "/api/calm/domains/payments/controls/11/configurations/3");

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.CONTROL_CONFIGURATION));
        assertThat(entry.getEntityId(), is("3"));
        assertThat(entry.getAction(), is(AuditAction.CREATE));
    }

    @Test
    void resolve_control_requirement_version_directly_from_path_params() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) ControlResource.class);
        when(resourceInfo.getResourceMethod()).thenReturn(mockMethod(ControlResource.class, "createRequirementForVersion"));
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("domain", "payments");
        pathParams.putSingle("controlId", "11");
        pathParams.putSingle("version", "2.0.0");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext = mockResponse(201, null);

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.CONTROL_REQUIREMENT));
        assertThat(entry.getEntityId(), is("11"));
        assertThat(entry.getVersion(), is("2.0.0"));
        assertThat(entry.getAction(), is(AuditAction.UPDATE));
    }

    // --- MappingControllerResource dispatch --------------------------------------

    @Test
    void resolve_mapping_controller_versioned_named_resource_via_path_params() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) MappingControllerResource.class);
        when(resourceInfo.getResourceMethod()).thenReturn(mockMethod(MappingControllerResource.class, "createResourceVersion"));
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        pathParams.putSingle("type", "patterns");
        pathParams.putSingle("name", "payment-flow");
        pathParams.putSingle("version", "1.1.0");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext = mockResponse(201, null);

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.PATTERN));
        assertThat(entry.getNamespace(), is("finos"));
        assertThat(entry.getEntityId(), is("payment-flow"));
        assertThat(entry.getVersion(), is("1.1.0"));
        assertThat(entry.getAction(), is(AuditAction.UPDATE));
    }

    @Test
    void resolve_mapping_controller_domain_creation_via_location() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) MappingControllerResource.class);
        when(resourceInfo.getResourceMethod()).thenReturn(mockMethod(MappingControllerResource.class, "createDomain"));
        ContainerRequestContext requestContext = mockRequest("POST", new MultivaluedHashMap<>());
        ContainerResponseContext responseContext = mockResponse(201, "/calm/domains/payments");

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.DOMAIN));
        assertThat(entry.getDomain(), is("payments"));
        assertNull(entry.getEntityId());
    }

    @Test
    void not_record_for_generic_endpoints_without_a_staged_context() {
        // createResourceFromDocument/updateResourceFromDocument normally stage a context
        // themselves; if that didn't happen (defensive path), nothing reliable to report.
        when(resourceInfo.getResourceClass()).thenReturn((Class) MappingControllerResource.class);
        when(resourceInfo.getResourceMethod()).thenReturn(mockMethod(MappingControllerResource.class, "createResourceFromDocument"));
        ContainerRequestContext requestContext = mockRequest("POST", new MultivaluedHashMap<>());
        ContainerResponseContext responseContext = mockResponse(201, null);

        filter.filter(requestContext, responseContext);

        verify(auditService, never()).record(any());
    }

    // --- Staged context short-circuit -------------------------------------------

    @Test
    void use_staged_context_verbatim_when_present() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) NamespaceResource.class);
        AuditRequestFilter.stage(new AuditRequestFilter.AuditContext(
                AuditEntityType.NAMESPACE, AuditAction.CREATE, null, null, "finos.child", null));
        ContainerRequestContext requestContext = mockRequest("POST", new MultivaluedHashMap<>());
        ContainerResponseContext responseContext = mockResponse(403, null);

        filter.filter(requestContext, responseContext);

        AuditLogEntry entry = captureRecordedEntry();
        assertThat(entry.getEntityType(), is(AuditEntityType.NAMESPACE));
        assertThat(entry.getEntityId(), is("finos.child"));
        assertThat(entry.getOutcome(), is(AuditOutcome.DENIED));
    }

    @Test
    void clear_staged_context_after_each_request_to_avoid_leaking_across_requests() {
        when(resourceInfo.getResourceClass()).thenReturn((Class) NamespaceResource.class);
        AuditRequestFilter.stage(new AuditRequestFilter.AuditContext(
                AuditEntityType.NAMESPACE, AuditAction.CREATE, null, null, "first", null));
        ContainerRequestContext firstRequest = mockRequest("POST", new MultivaluedHashMap<>());
        filter.filter(firstRequest, mockResponse(201, null));

        // Second, unrelated request on the same thread — no context staged this time.
        ContainerRequestContext secondRequest = mockRequest("GET", new MultivaluedHashMap<>());
        filter.filter(secondRequest, mockResponse(200, null));

        verify(auditService).record(any()); // only once, from the first request
    }

    // --- actor / anonymous identity ----------------------------------------------

    @Test
    void record_anonymous_actor_when_identity_is_anonymous() {
        when(identity.isAnonymous()).thenReturn(true);
        when(resourceInfo.getResourceClass()).thenReturn((Class) ArchitectureResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        ContainerResponseContext responseContext = mockResponse(401, null);

        filter.filter(requestContext, responseContext);

        assertThat(captureRecordedEntry().getActor(), is("anonymous"));
    }

    // --- sourceIp capture toggle --------------------------------------------------

    @Test
    void not_capture_source_ip_by_default() {
        filter.captureSourceIp = false;
        when(resourceInfo.getResourceClass()).thenReturn((Class) ArchitectureResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        when(requestContext.getHeaderString("X-Forwarded-For")).thenReturn("203.0.113.5");
        ContainerResponseContext responseContext =
                mockResponse(201, "/api/calm/namespaces/finos/architectures/1/versions/1.0.0");

        filter.filter(requestContext, responseContext);

        assertThat(captureRecordedEntry().getSourceIp(), is(nullValue()));
    }

    @Test
    void capture_source_ip_when_toggle_enabled() {
        filter.captureSourceIp = true;
        when(resourceInfo.getResourceClass()).thenReturn((Class) ArchitectureResource.class);
        MultivaluedMap<String, String> pathParams = new MultivaluedHashMap<>();
        pathParams.putSingle("namespace", "finos");
        ContainerRequestContext requestContext = mockRequest("POST", pathParams);
        when(requestContext.getHeaderString("X-Forwarded-For")).thenReturn("203.0.113.5");
        ContainerResponseContext responseContext =
                mockResponse(201, "/api/calm/namespaces/finos/architectures/1/versions/1.0.0");

        filter.filter(requestContext, responseContext);

        assertThat(captureRecordedEntry().getSourceIp(), is("203.0.113.5"));
    }
}
