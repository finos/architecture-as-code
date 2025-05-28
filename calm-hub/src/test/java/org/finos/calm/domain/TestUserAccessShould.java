package org.finos.calm.domain;

import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

public class TestUserAccessShould {

    @Test
    void return_built_instance_values() {
        Integer expectedUserAccessId = 100;
        String expectedNamespace = "finos";
        String expectedUsername = "test_user";
        UserAccess.ResourceType expectedResourceType = UserAccess.ResourceType.patterns;
        UserAccess.Permission expectedPermissionType = UserAccess.Permission.read;

        UserAccess actual = new UserAccess.UserAccessBuilder()
                .setUserAccessId(100)
                .setResourceType(UserAccess.ResourceType.patterns)
                .setNamespace("finos")
                .setUsername("test_user")
                .setPermission(UserAccess.Permission.read)
                .build();

        assertThat(actual.getUserAccessId(), equalTo(expectedUserAccessId));
        assertThat(actual.getUsername(), equalTo(expectedUsername));
        assertThat(actual.getNamespace(), equalTo(expectedNamespace));
        assertThat(actual.getResourceType(), equalTo(expectedResourceType));
        assertThat(actual.getPermission(), equalTo(expectedPermissionType));
    }
    
    @Test
    void return_true_for_same_user_access_instances() {

        UserAccess userAccess1 = new UserAccess.UserAccessBuilder()
                .setUserAccessId(100)
                .setResourceType(UserAccess.ResourceType.patterns)
                .setNamespace("finos")
                .setUsername("test_user")
                .setPermission(UserAccess.Permission.read)
                .build();

        UserAccess userAccess2 = new UserAccess.UserAccessBuilder()
                .setUserAccessId(100)
                .setResourceType(UserAccess.ResourceType.patterns)
                .setNamespace("finos")
                .setUsername("test_user")
                .setPermission(UserAccess.Permission.read)
                .build();

        assertThat(userAccess1.equals(userAccess2), is(true));
    }

    @Test
    void return_false_for_different_user_access_instances() {

        UserAccess userAccess1 = new UserAccess.UserAccessBuilder()
                .setUserAccessId(100)
                .setResourceType(UserAccess.ResourceType.patterns)
                .setNamespace("finos")
                .setUsername("test_user1")
                .setPermission(UserAccess.Permission.read)
                .build();

        UserAccess userAccess2 = new UserAccess.UserAccessBuilder()
                .setUserAccessId(101)
                .setResourceType(UserAccess.ResourceType.patterns)
                .setNamespace("finos")
                .setUsername("test_user2")
                .setPermission(UserAccess.Permission.read)
                .build();

        assertThat(userAccess1.equals(userAccess2), is(false));
    }
}
