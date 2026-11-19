package org.finos.calm.resources;

import io.quarkus.vertx.http.runtime.CurrentVertxRequest;
import io.vertx.ext.web.RoutingContext;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** Fails only a request with its test header, so a test can stop JAX-RS from writing a reply. */
@Provider
public class FaultyResponseFilter implements ContainerRequestFilter, ContainerResponseFilter {

    static final String FAIL = "X-Test-Fail-Response";
    /** The requests that this filter failed, so a test can wait until Hub has handled a request it no longer reads. */
    static final AtomicInteger FAILED = new AtomicInteger();
    /** The exchange of the last request with the test header, so a test can see when Hub sees the caller leave. */
    static final AtomicReference<RoutingContext> EXCHANGE = new AtomicReference<>();

    @Inject
    CurrentVertxRequest current;

    @Override
    public void filter(ContainerRequestContext request) {
        if (request.getHeaderString(FAIL) != null) {
            EXCHANGE.set(current.getCurrent());
        }
    }

    @Override
    public void filter(ContainerRequestContext request, ContainerResponseContext response) {
        if (request.getHeaderString(FAIL) != null) {
            FAILED.incrementAndGet();
            throw new IllegalStateException("The test asked this filter to fail");
        }
    }
}
