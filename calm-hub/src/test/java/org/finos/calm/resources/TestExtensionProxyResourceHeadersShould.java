package org.finos.calm.resources;

import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.config.PropertiesConfigSource;
import io.smallrye.config.SmallRyeConfigBuilder;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.eclipse.microprofile.config.Config;
import org.finos.calm.extensions.ExtensionProxyException;
import org.finos.calm.extensions.ExtensionProxyRequest;
import org.finos.calm.extensions.ExtensionProxyResponse;
import org.finos.calm.extensions.ExtensionProxyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.net.URI;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TestExtensionProxyResourceHeadersShould {

    private final ExtensionProxyService service = mock(ExtensionProxyService.class);
    private final SecurityIdentity identity = mock(SecurityIdentity.class);
    private final UriInfo uriInfo = mock(UriInfo.class);
    private final HttpHeaders headers = mock(HttpHeaders.class);

    @BeforeEach
    void setup() {
        MultivaluedHashMap<String, String> parameters = new MultivaluedHashMap<>();
        parameters.putSingle("path", "screen");
        when(uriInfo.getPathParameters(false)).thenReturn(parameters);
        when(uriInfo.getRequestUri()).thenReturn(URI.create("http://hub/api/calm/extensions/x/api/screen"));
        when(headers.getHeaderString(HttpHeaders.IF_MATCH)).thenReturn("\"v1\"");
        when(headers.getHeaderString(HttpHeaders.IF_NONE_MATCH)).thenReturn("\"v2\"");
        when(headers.getHeaderString("X-Forwarded-For")).thenReturn("10.0.0.1");
        when(service.call(any(), any())).thenReturn(new ExtensionProxyResponse(200, Map.of(), new byte[0]));
    }

    @Test
    void pass_the_conditional_headers_and_the_source_ip_when_capture_is_on() {
        new ExtensionProxyResource(service, identity, config("true")).get("x", uriInfo, headers);

        ExtensionProxyRequest request = captured();
        assertThat(request.ifMatch(), is("\"v1\""));
        assertThat(request.ifNoneMatch(), is("\"v2\""));
        assertThat(request.sourceIp(), is("10.0.0.1"));
    }

    @Test
    void leave_out_the_source_ip_when_capture_is_off() {
        new ExtensionProxyResource(service, identity, config(null)).get("x", uriInfo, headers);

        assertThat(captured().sourceIp(), nullValue());
    }

    @Test
    void add_the_headers_of_a_refusal_to_the_error_reply() {
        when(service.call(any(), any())).thenThrow(new ExtensionProxyException(503, "The extension is busy. Try again later",
                Map.of("Retry-After", "1")));

        Response response = new ExtensionProxyResource(service, identity, config(null)).get("x", uriInfo, headers);

        assertThat(response.getStatus(), is(503));
        assertThat(response.getHeaderString("Retry-After"), is("1"));
        assertThat(response.getHeaderString("Cache-Control"), is("private"));
    }

    private ExtensionProxyRequest captured() {
        ArgumentCaptor<ExtensionProxyRequest> captor = ArgumentCaptor.forClass(ExtensionProxyRequest.class);
        verify(service).call(eq(identity), captor.capture());
        return captor.getValue();
    }

    private static Config config(String captureSourceIp) {
        SmallRyeConfigBuilder builder = new SmallRyeConfigBuilder();
        if (captureSourceIp != null) {
            builder.withSources(new PropertiesConfigSource(Map.of("calm.audit.capture-source-ip", captureSourceIp),
                    "test", 100));
        }
        return builder.build();
    }
}
