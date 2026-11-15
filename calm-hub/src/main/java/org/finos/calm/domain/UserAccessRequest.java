package org.finos.calm.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
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

    private UserAccess.SubjectType subjectType = UserAccess.SubjectType.user;

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

    public UserAccess.SubjectType getSubjectType() {
        return subjectType;
    }

    public void setSubjectType(UserAccess.SubjectType subjectType) {
        this.subjectType = subjectType == null ? UserAccess.SubjectType.user : subjectType;
    }

    @JsonIgnore
    @AssertTrue(message = "The '*' wildcard is not a valid group name")
    public boolean isValidGroupName() {
        return subjectType != UserAccess.SubjectType.group || !"*".equals(username);
    }
}
