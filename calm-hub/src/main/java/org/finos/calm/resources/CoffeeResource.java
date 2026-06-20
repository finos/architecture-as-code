package org.finos.calm.resources;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

@Tag(name = "Teapot API", description = "Critical caffeination infrastructure")
@Path("/coffee")
public class CoffeeResource {

    static final String TEAPOT_MESSAGE =
            "{\"status\":418," +
            "\"title\":\"I'm a Teapot\"," +
            "\"type\":\"https://www.rfc-editor.org/rfc/rfc2324\"," +
            "\"detail\":\"This service is a TEApot — a Topology-Expressed Architecture — and is CALMly declining your request. " +
            "No 'CoffeeMachine' node exists in the architecture model, and brewing coffee falls outside the defined interface contract. " +
            "Please update your CALM pattern to include an appropriate caffeination service before retrying.\"}";

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Brew Coffee",
            description = "Attempts to brew coffee. This endpoint will always fail — CALM Hub is a TEApot (Topology-Expressed Architecture), not a coffee machine."
    )
    @APIResponse(responseCode = "418", description = "I'm a Teapot")
    public Response brewCoffee() {
        return Response.status(418).entity(TEAPOT_MESSAGE).build();
    }
}
