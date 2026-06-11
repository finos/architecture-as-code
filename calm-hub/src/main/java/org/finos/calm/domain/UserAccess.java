package org.finos.calm.domain;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDateTime;
import java.util.Objects;

import static org.finos.calm.resources.ResourceValidationConstants.*;

/**
 * Represents a CalmHub user access grant, scoped to either a namespace or a domain.
 */
public class UserAccess {

    public enum Permission {
        read,
        write,
        admin
    }

    private @Pattern(regexp = USERNAME_REGEX, message = USERNAME_MESSAGE) @NotNull String username;
    private @NotNull Permission permission;
    private @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace;
    private @Pattern(regexp = DOMAIN_REGEX, message = DOMAIN_MESSAGE) String domain;
    private int userAccessId;

    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    private LocalDateTime creationDateTime;

    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    private LocalDateTime updateDateTime;

    public UserAccess(String username, Permission permission, String namespace, int userAccessId) {
        this.username = username;
        this.permission = permission;
        this.namespace = namespace;
        this.userAccessId = userAccessId;
    }

    public UserAccess(String username, Permission permission, String namespace) {
        this.username = username;
        this.permission = permission;
        this.namespace = namespace;
    }

    public UserAccess() {
    }

    public String getDomain() {
        return domain;
    }

    public String getUsername() {
        return username;
    }

    public Permission getPermission() {
        return permission;
    }

    public String getNamespace() {
        return namespace;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public int getUserAccessId() {
        return userAccessId;
    }

    public LocalDateTime getCreationDateTime() {
        return creationDateTime;
    }

    public LocalDateTime getUpdateDateTime() {
        return updateDateTime;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public void setPermission(Permission permission) {
        this.permission = permission;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public void setUserAccessId(int userAccessId) {
        this.userAccessId = userAccessId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        UserAccess that = (UserAccess) o;
        if (userAccessId != that.userAccessId) return false;
        if (!Objects.equals(username, that.username)) return false;
        if (!Objects.equals(permission, that.permission)) return false;
        if (!Objects.equals(namespace, that.namespace)) return false;
        return Objects.equals(domain, that.domain);
    }

    public void setCreationDateTime(LocalDateTime creationDateTime) {
        this.creationDateTime = creationDateTime;
    }

    public void setUpdateDateTime(LocalDateTime updateDateTime) {
        this.updateDateTime = updateDateTime;
    }

    @Override
    public int hashCode() {
        return Objects.hash(username, permission, namespace, domain, userAccessId);
    }

    @Override
    public String toString() {
        return "UserAccess{" +
                "username='" + username + '\'' +
                ", permission='" + permission + '\'' +
                ", namespace='" + namespace + '\'' +
                ", domain='" + domain + '\'' +
                ", userAccessId=" + userAccessId +
                '}';
    }

    public static class UserAccessBuilder {

        private String username;
        private Permission permission;
        private String namespace;
        private String domain;
        private int userAccessId;

        public UserAccessBuilder setUsername(String username) {
            this.username = username;
            return this;
        }

        public UserAccessBuilder setPermission(Permission permission) {
            this.permission = permission;
            return this;
        }

        public UserAccessBuilder setNamespace(String namespace) {
            this.namespace = namespace;
            return this;
        }

        public UserAccessBuilder setDomain(String domain) {
            this.domain = domain;
            return this;
        }

        public UserAccessBuilder setUserAccessId(int userAccessId) {
            this.userAccessId = userAccessId;
            return this;
        }

        public UserAccess build() {
            UserAccess ua = new UserAccess(username, permission, namespace, userAccessId);
            ua.domain = this.domain;
            return ua;
        }
    }
}
