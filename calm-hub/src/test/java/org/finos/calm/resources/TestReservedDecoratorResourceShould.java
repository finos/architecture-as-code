package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import java.util.List;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditOutcome;
import org.finos.calm.security.AuditService;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.store.UserAccessStore;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
@TestProfile(TestReservedDecoratorResourceShould.ReservedTypeProfile.class)
class TestReservedDecoratorResourceShould {

    public static class ReservedTypeProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("calm.decorators.reserved.\"control-evaluation\".writers", "policy-engine");
        }
    }

    private static final String RESERVED_DECORATOR_JSON = """
            {
                "unique-id": "eval-1",
                "type": "control-evaluation",
                "target": ["/api/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "applies-to": ["web-service"],
                "data": {}
            }
            """;

    private static final String UNRESERVED_DECORATOR_JSON = RESERVED_DECORATOR_JSON
            .replace("control-evaluation", "threat-model");

    @InjectMock
    DecoratorStore mockDecoratorStore;

    @InjectMock
    UserAccessStore mockUserAccessStore;

    @InjectMock
    AuditService mockAuditService;

    @Test
    @TestSecurity(user = "policy-engine", authorizationEnabled = false)
    void create_a_reserved_decorator_for_a_configured_writer() throws Exception {
        when(mockDecoratorStore.createDecorator(anyString(), anyString())).thenReturn(1);

        given()
                .contentType(ContentType.JSON)
                .body(RESERVED_DECORATOR_JSON)
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201);
    }

    @Test
    @TestSecurity(user = "alice", authorizationEnabled = false)
    void return_403_when_another_principal_creates_a_reserved_decorator() throws Exception {
        given()
                .contentType(ContentType.JSON)
                .body(RESERVED_DECORATOR_JSON)
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(403)
                .body(containsString("control-evaluation"));

        verify(mockDecoratorStore, never()).createDecorator(anyString(), anyString());
    }

    @Test
    @TestSecurity(user = "alice", authorizationEnabled = false)
    void create_an_unreserved_decorator_for_any_writer() throws Exception {
        when(mockDecoratorStore.createDecorator(anyString(), anyString())).thenReturn(1);

        given()
                .contentType(ContentType.JSON)
                .body(UNRESERVED_DECORATOR_JSON)
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201);
    }

    @Test
    @TestSecurity(user = "alice", authorizationEnabled = false)
    void return_403_when_another_principal_changes_an_unreserved_decorator_to_a_reserved_type() throws Exception {
        when(mockDecoratorStore.getDecoratorById("finos", 1)).thenReturn(Optional.of(decorator("threat-model")));

        given()
                .contentType(ContentType.JSON)
                .body(RESERVED_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(403);

        verify(mockDecoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    @TestSecurity(user = "alice", authorizationEnabled = false)
    void return_403_when_another_principal_changes_a_reserved_decorator_to_an_unreserved_type() throws Exception {
        when(mockDecoratorStore.getDecoratorById("finos", 1)).thenReturn(Optional.of(decorator("control-evaluation")));

        given()
                .contentType(ContentType.JSON)
                .body(UNRESERVED_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(403);

        verify(mockDecoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    @TestSecurity(user = "admin")
    void delete_a_reserved_history_for_a_global_admin_who_is_not_a_writer() throws Exception {
        when(mockUserAccessStore.getGrantsForUser("admin")).thenReturn(List.of(
                new UserAccess("admin", UserAccess.Permission.admin, CalmHubPermissionChecker.GLOBAL_ACCESS)));
        when(mockDecoratorStore.getDecoratorHistory("finos", 1)).thenReturn(List.of(
                new DecoratorHistoryEntry(2, 1, null, decorator("control-evaluation")),
                new DecoratorHistoryEntry(1, null, 2, decorator("threat-model"))));

        given()
                .when()
                .delete("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(204);

        verify(mockDecoratorStore).deleteCurrentDecoratorHistory("finos", 2);
        ArgumentCaptor<AuditLogEntry> audit = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(mockAuditService).record(audit.capture());
        assertThat(audit.getValue().getAction(), is(AuditAction.DELETE));
        assertThat(audit.getValue().getEntityType(), is(AuditEntityType.DECORATOR));
        assertThat(audit.getValue().getEntityId(), is("1"));
        assertThat(audit.getValue().getActor(), is("admin"));
        assertThat(audit.getValue().getOutcome(), is(AuditOutcome.SUCCESS));
    }

    @Test
    @TestSecurity(user = "policy-engine")
    void return_403_when_a_writer_who_is_not_a_global_admin_deletes_a_reserved_decorator() throws Exception {
        given()
                .when()
                .delete("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(403);

        verify(mockDecoratorStore, never()).deleteCurrentDecoratorHistory(anyString(), anyInt());
    }

    @Test
    @TestSecurity(user = "alice", authorizationEnabled = false)
    void return_409_when_a_delete_loses_to_a_supersede() throws Exception {
        when(mockDecoratorStore.getDecoratorHistory("finos", 1)).thenReturn(List.of(
                new DecoratorHistoryEntry(1, null, null, decorator("control-evaluation"))));
        doThrow(new DecoratorSupersededException()).when(mockDecoratorStore).deleteCurrentDecoratorHistory("finos", 1);

        given()
                .when()
                .delete("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(409)
                .body(containsString("Retry the delete"));
    }

    @Test
    @TestSecurity(user = "policy-engine", authorizationEnabled = false)
    void delete_a_reserved_decorator_through_its_current_decorator() throws Exception {
        when(mockDecoratorStore.getDecoratorHistory("finos", 1)).thenReturn(List.of(
                new DecoratorHistoryEntry(1, null, null, decorator("control-evaluation"))));

        given()
                .when()
                .delete("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(204);

        verify(mockDecoratorStore).deleteCurrentDecoratorHistory("finos", 1);
    }

    @Test
    @TestSecurity(user = "policy-engine", authorizationEnabled = false)
    void return_201_with_the_new_id_when_a_writer_updates_a_reserved_decorator() throws Exception {
        when(mockDecoratorStore.getDecoratorById("finos", 1)).thenReturn(Optional.of(decorator("control-evaluation")));
        when(mockDecoratorStore.supersedeDecorator(eq("finos"), eq(1), anyString())).thenReturn(5);

        given()
                .contentType(ContentType.JSON)
                .body(RESERVED_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/finos/decorators/5"))
                .body("id", equalTo(5));

        verify(mockDecoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
        ArgumentCaptor<AuditLogEntry> audit = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(mockAuditService, times(2)).record(audit.capture());
        assertThat(audit.getAllValues().stream().map(entry -> entry.getAction() + " " + entry.getEntityId()).toList(),
                contains("UPDATE 1", "CREATE 5"));
    }

    @Test
    @TestSecurity(user = "policy-engine", authorizationEnabled = false)
    void return_409_when_a_writer_updates_a_superseded_decorator() throws Exception {
        when(mockDecoratorStore.getDecoratorById("finos", 1)).thenReturn(Optional.of(decorator("control-evaluation")));
        when(mockDecoratorStore.supersedeDecorator(eq("finos"), eq(1), anyString())).thenThrow(new DecoratorSupersededException());

        given()
                .contentType(ContentType.JSON)
                .body(RESERVED_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(409)
                .body(containsString("Update the current decorator"));
    }

    @Test
    @TestSecurity(user = "alice", authorizationEnabled = false)
    void return_409_when_another_write_supersedes_a_decorator_during_an_in_place_update() throws Exception {
        when(mockDecoratorStore.getDecoratorById("finos", 1)).thenReturn(Optional.of(decorator("threat-model")));
        doThrow(new DecoratorSupersededException()).when(mockDecoratorStore).updateDecorator(eq("finos"), eq(1), anyString());

        given()
                .contentType(ContentType.JSON)
                .body(UNRESERVED_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(409)
                .body(containsString("Update the current decorator"));
    }

    private static Decorator decorator(String type) {
        return new Decorator.DecoratorBuilder().setType(type).build();
    }
}
