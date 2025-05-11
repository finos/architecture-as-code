package org.finos.calm.domain;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Represents a CalmHub user role on resources associated to a namespace.
 */
public class UserAccess {

    private String username;
    private String role;
    private String namespace;
    private String resource;
    private int id;

    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    private LocalDateTime creationDateTime;

    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    private LocalDateTime updateDateTime;

    public UserAccess(String username, String role, String namespace, String resource, int id) {
        this.username = username;
        this.role = role;
        this.namespace = namespace;
        this.resource = resource;
        this.id = id;
    }

    public UserAccess(String username, String role, String namespace, String resource) {
        this.username = username;
        this.role = role;
        this.namespace = namespace;
        this.resource = resource;
    }

    public UserAccess(){

    }

    public static class UserAccessBuilder {

        private String username;
        private String role;
        private String namespace;
        private String resource;
        private int id;

        public UserAccessBuilder setUsername(String username) {
            this.username = username;
            return this;
        }

        public UserAccessBuilder setRole(String role) {
            this.role = role;
            return this;
        }

        public UserAccessBuilder setNamespace(String namespace) {
            this.namespace = namespace;
            return this;
        }

        public UserAccessBuilder setResource(String resource) {
            this.resource = resource;
            return this;
        }

        public UserAccessBuilder setId(int id) {
            this.id = id;
            return this;
        }

        public UserAccess build(){
            return new UserAccess(username, role, namespace, resource, id);
        }
    }

    public String getUsername() {
        return username;
    }

    public String getRole() {
        return role;
    }

    public String getNamespace() {
        return namespace;
    }

    public String getResource() {
        return resource;
    }

    public int getId() {
        return id;
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

        if (id != that.id) return false;
        if (!Objects.equals(username, that.username)) return false;
        if (!Objects.equals(role, that.role)) return false;
        if (!Objects.equals(namespace, that.namespace)) return false;
        return Objects.equals(resource, that.resource);
    }

    @Override
    public int hashCode() {
        return Objects.hash(username, role, namespace, resource, id);
    }

    @Override
    public String toString() {
        return "UserAccess{" +
                "username='" + username + '\'' +
                ", role='" + role + '\'' +
                ", namespace='" + namespace + '\'' +
                ", resource='" + resource + '\'' +
                ", id=" + id +
                '}';
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public void setResource(String resource) {
        this.resource = resource;
    }

    public void setId(int id) {
        this.id = id;
    }
}
