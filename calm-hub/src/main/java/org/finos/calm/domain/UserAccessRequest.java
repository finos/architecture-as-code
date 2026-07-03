package org.finos.calm.domain;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import static org.finos.calm.resources.ResourceValidationConstants.USERNAME_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.USERNAME_REGEX;

public class UserAccessRequest {

    @Pattern(regexp = USERNAME_REGEX, message = USERNAME_MESSAGE)
    @NotNull
    private String username;

    @NotNull
    private UserAccess.Permission permission;

    public UserAccessRequest() {
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public UserAccess.Permission getPermission() {
        return permission;
    }

    public void setPermission(UserAccess.Permission permission) {
        this.permission = permission;
    }
}
