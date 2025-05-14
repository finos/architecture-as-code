package org.finos.calm.store.mongo;

import com.mongodb.client.*;
import com.mongodb.client.model.Filters;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.Document;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.UserAccess.Permission;
import org.finos.calm.domain.UserAccess.ResourceType;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;

import java.util.*;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestMongoUserAccessStoreShould {

    @InjectMock
    MongoClient mongoClient;
    @InjectMock
    MongoNamespaceStore namespaceStore;
    @InjectMock
    MongoCounterStore counterStore;

    private MongoDatabase mongoDatabase;
    private MongoCollection<Document> userAccessCollection;
    private MongoUserAccessStore mongoUserAccessStore;

    @BeforeEach
    void setup() {
        mongoDatabase = Mockito.mock(MongoDatabase.class);
        userAccessCollection = Mockito.mock(MongoCollection.class);

        when(mongoClient.getDatabase("calmSchemas")).thenReturn(mongoDatabase);
        when(mongoDatabase.getCollection("userAccess")).thenReturn(userAccessCollection);
        mongoUserAccessStore = new MongoUserAccessStore(mongoClient, namespaceStore, counterStore);
    }

    @Test
    void throw_exception_when_namespace_does_not_exist_on_create() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        UserAccess access = new UserAccess.UserAccessBuilder()
                .setNamespace("invalid")
                .setUsername("test")
                .setPermission(Permission.read)
                .setResourceType(ResourceType.architectures)
                .build();

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoUserAccessStore.createUserAccessForNamespace(access));
    }

    @Test
    void create_user_access_when_namespace_is_exists() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(101);

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setNamespace("finos")
                .setUsername("test")
                .setPermission(Permission.write)
                .setResourceType(ResourceType.patterns)
                .build();

        UserAccess actual = mongoUserAccessStore.createUserAccessForNamespace(userAccess);
        assertThat(actual.getUserAccessId(), is(101));
        verify(userAccessCollection).insertOne(ArgumentMatchers.any(Document.class));
    }

    @Test
    void throw_exception_if_user_access_not_found_for_username() {
        FindIterable<Document> findIterable = mock(FindIterable.class);
        MongoCursor<Document> mockMongoCursor = mock(MongoCursor.class);
        when(mockMongoCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(mockMongoCursor);
        when(userAccessCollection.find(Filters.eq("username", "test")))
                .thenReturn(findIterable);

        assertThrows(UserAccessNotFoundException.class,
                () -> mongoUserAccessStore.getUserAccessForUsername("test"));
    }

    @Test
    void return_user_access_for_valid_username() throws Exception {
        String username = "test";
        String namespace = "finos";

        Document doc = new Document("username", username)
                .append("namespace", namespace)
                .append("permission", Permission.read.name())
                .append("resourceType", ResourceType.patterns.name())
                .append("userAccessId", 101);

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        FindIterable<Document> findIterable = mock(FindIterable.class);
        MongoCursor<Document> cursor = mock(MongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(doc);
        when(findIterable.iterator()).thenReturn(cursor);

        when(userAccessCollection.find(Filters.eq("username", username))).thenReturn(findIterable);

        List<UserAccess> actual = mongoUserAccessStore.getUserAccessForUsername(username);
        assertThat(actual, hasSize(1));
        assertThat(actual.get(0).getNamespace(), is(namespace));
    }

    @Test
    void throw_exception_if_no_user_access_found_for_namespace() {
        String namespace = "finos";
        FindIterable<Document> findIterable = mock(FindIterable.class);
        MongoCursor<Document> mockMongoCursor = mock(MongoCursor.class);
        when(mockMongoCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(mockMongoCursor);

        when(userAccessCollection.find(Filters.eq("namespace", namespace)))
                .thenReturn(findIterable);
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        assertThrows(UserAccessNotFoundException.class,
                () -> mongoUserAccessStore.getUserAccessForNamespace(namespace));
    }

    @Test
    void return_user_access_list_for_namespace() throws Exception {
        String namespace = "finos";
        Document doc = new Document("username", "test")
                .append("namespace", namespace)
                .append("permission", Permission.read.name())
                .append("resourceType", ResourceType.flows.name())
                .append("userAccessId", 111);

        FindIterable<Document> findIterable = mock(FindIterable.class);
        MongoCursor<Document> cursor = mock(MongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(doc);

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(userAccessCollection.find(Filters.eq("namespace", namespace)))
                .thenReturn(findIterable);
        when(findIterable.iterator()).thenReturn(cursor);

        List<UserAccess> actual = mongoUserAccessStore.getUserAccessForNamespace(namespace);

        assertThat(actual, hasSize(1));
        assertThat(actual.get(0).getUsername(), is("test"));
        assertThat(actual.get(0).getPermission(), is(Permission.read));
        assertThat(actual.get(0).getResourceType(), is(ResourceType.flows));
    }

    @Test
    void throw_exception_if_no_user_access_found_for_namespace_and_user_access_id() {
        String namespace = "finos";
        Integer userAccessId = 101;
        FindIterable<Document> findIterable = mock(FindIterable.class);
        MongoCursor<Document> mockMongoCursor = mock(MongoCursor.class);
        when(mockMongoCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(mockMongoCursor);

        when(mockMongoCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(mockMongoCursor);
        when(userAccessCollection.find(Filters.and(Filters.eq("namespace", namespace),
                        Filters.eq("userAccessId", userAccessId))))
                .thenReturn(findIterable);

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        assertThrows(UserAccessNotFoundException.class,
                () -> mongoUserAccessStore.getUserAccessForNamespaceAndId(namespace, userAccessId));
    }

    @Test
    void return_user_access_for_namespace_and_user_access_id() throws Exception {
        String namespace = "finos";
        Integer userAccessId = 101;

        Document document = new Document("username", "test")
                .append("namespace", namespace)
                .append("permission", Permission.read.name())
                .append("resourceType", ResourceType.flows.name())
                .append("userAccessId", userAccessId);

        FindIterable<Document> mockFindIterable = mock(FindIterable.class);
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(userAccessCollection.find(Filters.and(
                Filters.eq("namespace", namespace),
                Filters.eq("userAccessId", userAccessId)
        ))).thenReturn(mockFindIterable);
        when(mockFindIterable.first()).thenReturn(document);

        UserAccess actual = mongoUserAccessStore.getUserAccessForNamespaceAndId(namespace, userAccessId);

        assertThat(actual.getUsername(), is("test"));
        assertThat(actual.getPermission(), is(Permission.read));
        assertThat(actual.getResourceType(), is(ResourceType.flows));
        assertThat(actual.getNamespace(), is(namespace));
        assertThat(actual.getUserAccessId(), is(userAccessId));
    }
}