package org.finos.calm.domain;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Represents a CalmHub user access on resources associated to a namespace.
 */
public class UserAccess {

    public enum Permission {
        read,
        write
    }

    public enum ResourceType {
        patterns,
        flows,
        adrs,
        architectures,
        all
    }

    private String username;
    private Permission permission;
    private String namespace;
    private ResourceType resourceType;
    private int userAccessId;

    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    private LocalDateTime creationDateTime;

    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    private LocalDateTime updateDateTime;

    public UserAccess(String username, Permission permission, String namespace, ResourceType resourceType, int userAccessId) {
        this.username = username;
        this.permission = permission;
        this.namespace = namespace;
        this.resourceType = resourceType;
        this.userAccessId = userAccessId;
    }

    public UserAccess(String username, Permission permission, String namespace, ResourceType resourceType) {
        this.username = username;
        this.permission = permission;
        this.namespace = namespace;
        this.resourceType = resourceType;
    }

    public UserAccess(){

    }

    public static class UserAccessBuilder {

        private String username;
        private Permission permission;
        private String namespace;
        private ResourceType resourceType;
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

        public UserAccessBuilder setResourceType(ResourceType resourceType) {
            this.resourceType = resourceType;
            return this;
        }

        public UserAccessBuilder setUserAccessId(int userAccessId) {
            this.userAccessId = userAccessId;
            return this;
        }

        public UserAccess build(){
            return new UserAccess(username, permission, namespace, resourceType, userAccessId);
        }
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

    public ResourceType getResourceType() {
        return resourceType;
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

    public void setCreationDateTime(LocalDateTime creationDateTime) {
        this.creationDateTime = creationDateTime;
    }

    public void setUpdateDateTime(LocalDateTime updateDateTime) {
        this.updateDateTime = updateDateTime;
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
        return Objects.equals(resourceType, that.resourceType);
    }

    @Override
    public int hashCode() {
        return Objects.hash(username, permission, namespace, resourceType, userAccessId);
    }

    @Override
    public String toString() {
        return "UserAccess{" +
                "username='" + username + '\'' +
                ", permission='" + permission + '\'' +
                ", namespace='" + namespace + '\'' +
                ", resourceType='" + resourceType + '\'' +
                ", userAccessId=" + userAccessId +
                '}';
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

    public void setResourceType(ResourceType resourceType) {
        this.resourceType = resourceType;
    }

    public void setUserAccessId(int userAccessId) {
        this.userAccessId = userAccessId;
    }
}
