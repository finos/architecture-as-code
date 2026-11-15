package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.security.GroupMembershipResolver;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Set;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestCurrentUserAccessResourceShould {

    @InjectMock
    UserAccessStore mockUserAccessStore;

    @InjectMock
    GroupMembershipResolver mockGroupMembershipResolver;

    @Test
    @TestSecurity(user = "alice")
    void return_200_with_grants_for_authenticated_user() {
        UserAccess grant = new UserAccess();
        grant.setUsername("alice");
        grant.setNamespace("finos");
        grant.setPermission(UserAccess.Permission.admin);
        grant.setUserAccessId(1);

        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(grant));

        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(200)
                .body(containsString("alice"))
                .body(containsString("finos"));

        verify(mockUserAccessStore, times(1)).getGrantsForUser("alice");
    }

    @Test
    @TestSecurity(user = "bob")
    void return_200_with_empty_list_when_user_has_no_grants() {
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(Collections.emptyList());

        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(200)
                .body(containsString("[]"));

        verify(mockUserAccessStore, times(1)).getGrantsForUser("bob");
    }

    @Test
    @TestSecurity(user = "alice")
    void return_200_including_wildcard_grants_for_implicit_access() {
        UserAccess personalGrant = new UserAccess();
        personalGrant.setUsername("alice");
        personalGrant.setNamespace("finos");
        personalGrant.setPermission(UserAccess.Permission.admin);
        personalGrant.setUserAccessId(1);

        UserAccess wildcardGrant = new UserAccess();
        wildcardGrant.setUsername("*");
        wildcardGrant.setNamespace("finos.open");
        wildcardGrant.setPermission(UserAccess.Permission.read);
        wildcardGrant.setUserAccessId(2);

        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(personalGrant, wildcardGrant));

        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(200)
                .body(containsString("alice"))
                .body(containsString("\"*\""))
                .body(containsString("finos.open"));

        verify(mockUserAccessStore, times(1)).getGrantsForUser("alice");
    }

    @Test
    void return_401_when_not_authenticated() {
        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(401);

        verify(mockUserAccessStore, never()).getGrantsForUser(any());
    }

    private static UserAccess groupGrant(String group, UserAccess.Permission permission, String namespace) {
        return new UserAccess.UserAccessBuilder()
                .setUsername(group)
                .setSubjectType(UserAccess.SubjectType.group)
                .setPermission(permission)
                .setNamespace(namespace)
                .build();
    }

    @Test
    @TestSecurity(user = "alice")
    void include_the_grants_of_member_groups_only() {
        UserAccess own = new UserAccess("alice", UserAccess.Permission.read, "finos");
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(own));
        when(mockUserAccessStore.getAllGroupGrants()).thenReturn(List.of(
                groupGrant("architects", UserAccess.Permission.write, "org"),
                groupGrant("reviewers", UserAccess.Permission.read, "secret")));
        when(mockGroupMembershipResolver.memberGroups("alice", Set.of("architects", "reviewers")))
                .thenReturn(Set.of("architects"));

        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(200)
                .body("$", hasSize(2))
                .body("username", containsInAnyOrder("alice", "architects"))
                .body("subjectType", containsInAnyOrder("user", "group"));

        verify(mockGroupMembershipResolver, times(1)).memberGroups(anyString(), anyCollection());
    }

    @Test
    @TestSecurity(user = "alice")
    void return_only_user_grants_when_the_resolver_fails() {
        UserAccess own = new UserAccess("alice", UserAccess.Permission.read, "finos");
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(own));
        when(mockUserAccessStore.getAllGroupGrants()).thenReturn(List.of(
                groupGrant("architects", UserAccess.Permission.write, "org")));
        when(mockGroupMembershipResolver.memberGroups(anyString(), anyCollection()))
                .thenThrow(new IllegalStateException("directory unavailable"));

        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(200)
                .body("$", hasSize(1))
                .body("username", containsInAnyOrder("alice"));
    }

    @Test
    @TestSecurity(user = "alice")
    void not_call_the_resolver_when_there_are_no_group_grants() {
        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of());
        when(mockUserAccessStore.getAllGroupGrants()).thenReturn(List.of());

        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));

        verify(mockGroupMembershipResolver, never()).memberGroups(anyString(), anyCollection());
    }
}
