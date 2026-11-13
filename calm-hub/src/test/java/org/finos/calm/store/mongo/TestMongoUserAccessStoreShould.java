package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.ServerAddress;
import com.mongodb.WriteError;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.bson.BsonDocument;
import org.bson.Document;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.UserAccess.Permission;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.bson.conversions.Bson;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestMongoUserAccessStoreShould {

    @InjectMock
    MongoDatabase mongoDatabase;
    @InjectMock
    MongoNamespaceStore namespaceStore;
    @InjectMock
    MongoCounterStore counterStore;

    private MongoCollection<Document> userAccessCollection;
    private MongoUserAccessStore mongoUserAccessStore;

    @BeforeEach
    void setup() throws NamespaceNotFoundException {
        userAccessCollection = Mockito.mock(DocumentMongoCollection.class);

        when(mongoDatabase.getCollection("userAccess")).thenReturn(userAccessCollection);
        doCallRealMethod().when(namespaceStore).requireNamespace(anyString());
        mongoUserAccessStore = new MongoUserAccessStore(mongoDatabase, namespaceStore, counterStore);
    }

    @Test
    void throw_exception_if_user_access_not_found_for_username() {
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor mockMongoCursor = mock(DocumentMongoCursor.class);
        when(mockMongoCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(mockMongoCursor);
        when(userAccessCollection.find(Filters.and(Filters.eq("username", "test"), Filters.ne("subjectType", "group"))))
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
                .append("userAccessId", 101);

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(doc);
        when(findIterable.iterator()).thenReturn(cursor);

        when(userAccessCollection.find(Filters.and(Filters.eq("username", username), Filters.ne("subjectType", "group"))))
                .thenReturn(findIterable);

        List<UserAccess> actual = mongoUserAccessStore.getUserAccessForUsername(username);
        assertThat(actual, hasSize(1));
        assertThat(actual.getFirst().getNamespace(), is(namespace));
    }

    @Test
    void return_empty_list_from_get_grants_for_user_when_no_grants_exist() {
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(cursor);
        when(userAccessCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);

        List<UserAccess> result = mongoUserAccessStore.getGrantsForUser("alice");
        assertThat(result, hasSize(0));
    }

    @Test
    void return_user_and_wildcard_grants_from_get_grants_for_user() {
        Document userDoc = new Document("username", "alice")
                .append("namespace", "org")
                .append("permission", Permission.write.name())
                .append("userAccessId", 1);
        Document wildcardDoc = new Document("username", "*")
                .append("namespace", "org.ab")
                .append("permission", Permission.read.name())
                .append("userAccessId", 2);

        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, true, false);
        when(cursor.next()).thenReturn(userDoc, wildcardDoc);
        when(findIterable.iterator()).thenReturn(cursor);
        when(userAccessCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);

        List<UserAccess> result = mongoUserAccessStore.getGrantsForUser("alice");
        assertThat(result, hasSize(2));
        assertThat(result.stream().map(UserAccess::getUsername).toList(),
                containsInAnyOrder("alice", "*"));
    }

    @Test
    void return_empty_list_when_no_user_access_found_for_namespace() throws Exception {
        String namespace = "finos";
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor mockMongoCursor = mock(DocumentMongoCursor.class);
        when(mockMongoCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(mockMongoCursor);

        when(userAccessCollection.find(Filters.eq("namespace", namespace))).thenReturn(findIterable);
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        assertThat(mongoUserAccessStore.getUserAccessForNamespace(namespace), hasSize(0));
    }

    @Test
    void throw_exception_when_namespace_does_not_exist_on_create() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(false);
        UserAccess access = new UserAccess.UserAccessBuilder()
                .setNamespace("invalid")
                .setUsername("test")
                .setPermission(Permission.read)
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
                .build();

        UserAccess actual = mongoUserAccessStore.createUserAccessForNamespace(userAccess);
        assertThat(actual.getUserAccessId(), is(101));
        verify(userAccessCollection).insertOne(ArgumentMatchers.any(Document.class));
    }

    @Test
    void return_existing_grant_when_a_concurrent_request_already_created_the_same_namespace_grant() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(101);
        when(userAccessCollection.insertOne(ArgumentMatchers.any(Document.class)))
                .thenThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of()));

        Document existingDoc = new Document("username", "test")
                .append("namespace", "finos")
                .append("permission", Permission.write.name())
                .append("userAccessId", 55);
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(userAccessCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(existingDoc);

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setNamespace("finos")
                .setUsername("test")
                .setPermission(Permission.write)
                .build();

        UserAccess actual = mongoUserAccessStore.createUserAccessForNamespace(userAccess);

        assertThat(actual.getUserAccessId(), is(55));
    }

    @Test
    void rethrow_original_error_when_existing_namespace_grant_lookup_finds_nothing() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(101);
        when(userAccessCollection.insertOne(ArgumentMatchers.any(Document.class)))
                .thenThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of()));

        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(userAccessCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setNamespace("finos")
                .setUsername("test")
                .setPermission(Permission.write)
                .build();

        assertThrows(MongoWriteException.class,
                () -> mongoUserAccessStore.createUserAccessForNamespace(userAccess));
    }

    @Test
    void propagate_non_duplicate_key_errors_when_creating_namespace_user_access() {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(101);
        when(userAccessCollection.insertOne(ArgumentMatchers.any(Document.class)))
                .thenThrow(new MongoWriteException(new WriteError(12, "some other error", new BsonDocument()), new ServerAddress(), List.of()));

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setNamespace("finos")
                .setUsername("test")
                .setPermission(Permission.write)
                .build();

        assertThrows(MongoWriteException.class,
                () -> mongoUserAccessStore.createUserAccessForNamespace(userAccess));
    }

    @Test
    void return_user_access_list_for_namespace() throws Exception {
        String namespace = "finos";
        Document doc = new Document("username", "test")
                .append("namespace", namespace)
                .append("permission", Permission.read.name())
                .append("userAccessId", 111);

        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(doc);

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(userAccessCollection.find(Filters.eq("namespace", namespace)))
                .thenReturn(findIterable);
        when(findIterable.iterator()).thenReturn(cursor);

        List<UserAccess> actual = mongoUserAccessStore.getUserAccessForNamespace(namespace);

        assertThat(actual, hasSize(1));
        assertThat(actual.getFirst().getUsername(), is("test"));
        assertThat(actual.getFirst().getPermission(), is(Permission.read));
    }

    @Test
    void throw_exception_if_no_user_access_found_for_namespace_and_user_access_id() {
        String namespace = "finos";
        Integer userAccessId = 101;
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor mockMongoCursor = mock(DocumentMongoCursor.class);
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
                .append("userAccessId", userAccessId);

        DocumentFindIterable mockFindIterable = mock(DocumentFindIterable.class);
        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);
        when(userAccessCollection.find(Filters.and(
                Filters.eq("namespace", namespace),
                Filters.eq("userAccessId", userAccessId)
        ))).thenReturn(mockFindIterable);
        when(mockFindIterable.first()).thenReturn(document);

        UserAccess actual = mongoUserAccessStore.getUserAccessForNamespaceAndId(namespace, userAccessId);

        assertThat(actual.getUsername(), is("test"));
        assertThat(actual.getPermission(), is(Permission.read));
        assertThat(actual.getNamespace(), is(namespace));
        assertThat(actual.getUserAccessId(), is(userAccessId));
    }

    @Test
    void create_user_access_for_domain() {
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(201);

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setDomain("payments")
                .setUsername("test")
                .setPermission(Permission.write)
                .build();

        UserAccess actual = mongoUserAccessStore.createUserAccessForDomain(userAccess);
        assertThat(actual.getUserAccessId(), is(201));
        assertThat(actual.getDomain(), is("payments"));
        verify(userAccessCollection).insertOne(ArgumentMatchers.any(Document.class));
    }

    @Test
    void return_existing_grant_when_a_concurrent_request_already_created_the_same_domain_grant() {
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(201);
        when(userAccessCollection.insertOne(ArgumentMatchers.any(Document.class)))
                .thenThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of()));

        Document existingDoc = new Document("username", "test")
                .append("domain", "payments")
                .append("permission", Permission.write.name())
                .append("userAccessId", 77);
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(userAccessCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(existingDoc);

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setDomain("payments")
                .setUsername("test")
                .setPermission(Permission.write)
                .build();

        UserAccess actual = mongoUserAccessStore.createUserAccessForDomain(userAccess);

        assertThat(actual.getUserAccessId(), is(77));
    }

    @Test
    void rethrow_original_error_when_existing_domain_grant_lookup_finds_nothing() {
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(201);
        when(userAccessCollection.insertOne(ArgumentMatchers.any(Document.class)))
                .thenThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of()));

        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(userAccessCollection.find(ArgumentMatchers.any(Bson.class))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setDomain("payments")
                .setUsername("test")
                .setPermission(Permission.write)
                .build();

        assertThrows(MongoWriteException.class,
                () -> mongoUserAccessStore.createUserAccessForDomain(userAccess));
    }

    @Test
    void propagate_non_duplicate_key_errors_when_creating_domain_user_access() {
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(201);
        when(userAccessCollection.insertOne(ArgumentMatchers.any(Document.class)))
                .thenThrow(new MongoWriteException(new WriteError(12, "some other error", new BsonDocument()), new ServerAddress(), List.of()));

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setDomain("payments")
                .setUsername("test")
                .setPermission(Permission.write)
                .build();

        assertThrows(MongoWriteException.class,
                () -> mongoUserAccessStore.createUserAccessForDomain(userAccess));
    }

    @Test
    void return_empty_list_when_no_user_access_found_for_domain() {
        String domain = "payments";
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor mockMongoCursor = mock(DocumentMongoCursor.class);
        when(mockMongoCursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(mockMongoCursor);
        when(userAccessCollection.find(Filters.eq("domain", domain))).thenReturn(findIterable);

        assertThat(mongoUserAccessStore.getUserAccessForDomain(domain), hasSize(0));
    }

    @Test
    void return_user_access_list_for_domain() throws Exception {
        String domain = "payments";
        Document doc = new Document("username", "test")
                .append("domain", domain)
                .append("permission", Permission.read.name())
                .append("userAccessId", 201);

        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(doc);
        when(findIterable.iterator()).thenReturn(cursor);
        when(userAccessCollection.find(Filters.eq("domain", domain))).thenReturn(findIterable);

        List<UserAccess> actual = mongoUserAccessStore.getUserAccessForDomain(domain);

        assertThat(actual, hasSize(1));
        assertThat(actual.getFirst().getDomain(), is(domain));
    }

    @Test
    void throw_exception_if_no_user_access_found_for_domain_and_id() {
        String domain = "payments";
        Integer userAccessId = 201;
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(userAccessCollection.find(Filters.and(
                Filters.eq("domain", domain),
                Filters.eq("userAccessId", userAccessId)))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(null);

        assertThrows(UserAccessNotFoundException.class,
                () -> mongoUserAccessStore.getUserAccessForDomainAndId(domain, userAccessId));
    }

    @Test
    void return_user_access_for_domain_and_id() throws Exception {
        String domain = "payments";
        Integer userAccessId = 201;

        Document document = new Document("username", "test")
                .append("domain", domain)
                .append("permission", Permission.read.name())
                .append("userAccessId", userAccessId);

        DocumentFindIterable mockFindIterable = mock(DocumentFindIterable.class);
        when(userAccessCollection.find(Filters.and(
                Filters.eq("domain", domain),
                Filters.eq("userAccessId", userAccessId)))).thenReturn(mockFindIterable);
        when(mockFindIterable.first()).thenReturn(document);

        UserAccess actual = mongoUserAccessStore.getUserAccessForDomainAndId(domain, userAccessId);

        assertThat(actual.getDomain(), is(domain));
        assertThat(actual.getUserAccessId(), is(userAccessId));
    }

    @Test
    void delete_user_access_for_domain_succeeds() throws Exception {
        String domain = "payments";
        Integer userAccessId = 201;

        com.mongodb.client.result.DeleteResult deleteResult = mock(com.mongodb.client.result.DeleteResult.class);
        when(deleteResult.getDeletedCount()).thenReturn(1L);
        when(userAccessCollection.deleteOne(ArgumentMatchers.any(Bson.class))).thenReturn(deleteResult);

        mongoUserAccessStore.deleteUserAccessForDomain(domain, userAccessId);

        verify(userAccessCollection).deleteOne(ArgumentMatchers.any(Bson.class));
    }

    @Test
    void throw_user_access_not_found_when_deleting_non_existent_domain_grant() {
        String domain = "payments";
        Integer userAccessId = 999;

        com.mongodb.client.result.DeleteResult deleteResult = mock(com.mongodb.client.result.DeleteResult.class);
        when(deleteResult.getDeletedCount()).thenReturn(0L);
        when(userAccessCollection.deleteOne(ArgumentMatchers.any(Bson.class))).thenReturn(deleteResult);

        assertThrows(UserAccessNotFoundException.class,
                () -> mongoUserAccessStore.deleteUserAccessForDomain(domain, userAccessId));
    }

    @Test
    void delete_user_access_for_namespace_succeeds() throws Exception {
        String namespace = "finos";
        Integer userAccessId = 101;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        com.mongodb.client.result.DeleteResult deleteResult = mock(com.mongodb.client.result.DeleteResult.class);
        when(deleteResult.getDeletedCount()).thenReturn(1L);
        when(userAccessCollection.deleteOne(ArgumentMatchers.any(Bson.class))).thenReturn(deleteResult);

        mongoUserAccessStore.deleteUserAccessForNamespace(namespace, userAccessId);

        verify(userAccessCollection).deleteOne(ArgumentMatchers.any(Bson.class));
    }

    @Test
    void throw_namespace_not_found_exception_when_deleting_with_invalid_namespace() {
        when(namespaceStore.namespaceExists("invalid")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> mongoUserAccessStore.deleteUserAccessForNamespace("invalid", 1));
        verify(userAccessCollection, never()).deleteOne(ArgumentMatchers.any(Bson.class));
    }

    @Test
    void create_user_access_for_global_namespace_without_namespace_existence_check() throws NamespaceNotFoundException {
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(202);

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setNamespace("GLOBAL")
                .setUsername("alice")
                .setPermission(Permission.admin)
                .build();

        UserAccess actual = mongoUserAccessStore.createUserAccessForNamespace(userAccess);

        assertThat(actual.getUserAccessId(), is(202));
        assertThat(actual.getNamespace(), is("GLOBAL"));
        verify(namespaceStore, never()).namespaceExists("GLOBAL");
        verify(userAccessCollection).insertOne(ArgumentMatchers.any(Document.class));
    }

    @Test
    void get_user_access_for_global_namespace_without_namespace_existence_check() throws NamespaceNotFoundException {
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(cursor);
        when(userAccessCollection.find(Filters.eq("namespace", "GLOBAL"))).thenReturn(findIterable);

        List<UserAccess> actual = mongoUserAccessStore.getUserAccessForNamespace("GLOBAL");

        assertThat(actual, hasSize(0));
        verify(namespaceStore, never()).namespaceExists("GLOBAL");
    }

    @Test
    void get_user_access_for_global_namespace_and_id_without_namespace_existence_check() throws Exception {
        Integer userAccessId = 202;

        Document document = new Document("username", "alice")
                .append("namespace", "GLOBAL")
                .append("permission", Permission.admin.name())
                .append("userAccessId", userAccessId);

        DocumentFindIterable mockFindIterable = mock(DocumentFindIterable.class);
        when(userAccessCollection.find(Filters.and(
                Filters.eq("namespace", "GLOBAL"),
                Filters.eq("userAccessId", userAccessId)
        ))).thenReturn(mockFindIterable);
        when(mockFindIterable.first()).thenReturn(document);

        UserAccess actual = mongoUserAccessStore.getUserAccessForNamespaceAndId("GLOBAL", userAccessId);

        assertThat(actual.getNamespace(), is("GLOBAL"));
        verify(namespaceStore, never()).namespaceExists("GLOBAL");
    }

    @Test
    void delete_user_access_for_global_namespace_without_namespace_existence_check() throws NamespaceNotFoundException, UserAccessNotFoundException {
        com.mongodb.client.result.DeleteResult deleteResult = mock(com.mongodb.client.result.DeleteResult.class);
        when(deleteResult.getDeletedCount()).thenReturn(1L);
        when(userAccessCollection.deleteOne(ArgumentMatchers.any(Bson.class))).thenReturn(deleteResult);

        mongoUserAccessStore.deleteUserAccessForNamespace("GLOBAL", 202);

        verify(namespaceStore, never()).namespaceExists("GLOBAL");
        verify(userAccessCollection).deleteOne(ArgumentMatchers.any(Bson.class));
    }

    @Test
    void throw_user_access_not_found_exception_when_deleting_non_existent_grant() {
        String namespace = "finos";
        Integer userAccessId = 999;

        when(namespaceStore.namespaceExists(namespace)).thenReturn(true);

        com.mongodb.client.result.DeleteResult deleteResult = mock(com.mongodb.client.result.DeleteResult.class);
        when(deleteResult.getDeletedCount()).thenReturn(0L);
        when(userAccessCollection.deleteOne(ArgumentMatchers.any(Bson.class))).thenReturn(deleteResult);

        assertThrows(UserAccessNotFoundException.class,
                () -> mongoUserAccessStore.deleteUserAccessForNamespace(namespace, userAccessId));
    }

    @Test
    void delete_all_user_access_for_namespace() {
        mongoUserAccessStore.deleteAllUserAccessForNamespace("finos");

        verify(userAccessCollection).deleteMany(Filters.eq("namespace", "finos"));
    }

    @Test
    void delete_all_user_access_for_domain() {
        mongoUserAccessStore.deleteAllUserAccessForDomain("payments");

        verify(userAccessCollection).deleteMany(Filters.eq("domain", "payments"));
    }

    private interface DocumentFindIterable extends FindIterable<Document> {
    }

    private interface DocumentMongoCollection extends MongoCollection<Document> {
    }

    private interface DocumentMongoCursor extends MongoCursor<Document> {
    }

    @Test
    void exclude_group_grants_from_get_grants_for_user() {
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(false);
        when(findIterable.iterator()).thenReturn(cursor);
        when(userAccessCollection.find(Filters.and(
                Filters.in("username", "alice", "*"),
                Filters.ne("subjectType", "group")))).thenReturn(findIterable);

        assertThat(mongoUserAccessStore.getGrantsForUser("alice"), hasSize(0));
    }

    @Test
    void write_the_subject_type_when_creating_a_grant() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(101, 102);

        UserAccess group = new UserAccess.UserAccessBuilder()
                .setNamespace("finos")
                .setUsername("architects")
                .setSubjectType(UserAccess.SubjectType.group)
                .setPermission(Permission.write)
                .build();
        UserAccess domainUser = new UserAccess.UserAccessBuilder()
                .setDomain("security")
                .setUsername("alice")
                .setPermission(Permission.read)
                .build();

        UserAccess createdGroup = mongoUserAccessStore.createUserAccessForNamespace(group);
        UserAccess createdUser = mongoUserAccessStore.createUserAccessForDomain(domainUser);

        ArgumentCaptor<Document> inserted = ArgumentCaptor.forClass(Document.class);
        verify(userAccessCollection, times(2)).insertOne(inserted.capture());
        assertThat(inserted.getAllValues().get(0).getString("subjectType"), is("group"));
        assertThat(inserted.getAllValues().get(1).getString("subjectType"), is("user"));
        assertThat(createdGroup.getSubjectType(), is(UserAccess.SubjectType.group));
        assertThat(createdUser.getSubjectType(), is(UserAccess.SubjectType.user));
    }

    @Test
    void read_a_missing_subject_type_as_user_and_a_stored_one_as_given() throws Exception {
        Document legacyDoc = new Document("username", "alice")
                .append("namespace", "finos")
                .append("permission", Permission.read.name())
                .append("userAccessId", 1);
        Document groupDoc = new Document("username", "architects")
                .append("subjectType", "group")
                .append("namespace", "finos")
                .append("permission", Permission.write.name())
                .append("userAccessId", 2);

        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, true, false);
        when(cursor.next()).thenReturn(legacyDoc, groupDoc);
        when(findIterable.iterator()).thenReturn(cursor);
        when(userAccessCollection.find(Filters.eq("namespace", "finos"))).thenReturn(findIterable);
        when(namespaceStore.namespaceExists("finos")).thenReturn(true);

        List<UserAccess> result = mongoUserAccessStore.getUserAccessForNamespace("finos");

        assertThat(result.stream().map(UserAccess::getSubjectType).toList(),
                contains(UserAccess.SubjectType.user, UserAccess.SubjectType.group));
    }

    @Test
    void return_group_grants_for_namespaces() {
        Document groupDoc = new Document("username", "architects")
                .append("subjectType", "group")
                .append("namespace", "org")
                .append("permission", Permission.read.name())
                .append("userAccessId", 7);

        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(groupDoc);
        when(findIterable.iterator()).thenReturn(cursor);
        when(userAccessCollection.find(Filters.and(
                Filters.eq("subjectType", "group"),
                Filters.in("namespace", List.of("org", "org.ab"))))).thenReturn(findIterable);

        List<UserAccess> result = mongoUserAccessStore.getGroupGrantsForNamespaces(List.of("org", "org.ab"));

        assertThat(result, hasSize(1));
        assertThat(result.getFirst().getUsername(), is("architects"));
        assertThat(result.getFirst().getSubjectType(), is(UserAccess.SubjectType.group));
    }

    @Test
    void return_group_grants_for_domain() {
        Document groupDoc = new Document("username", "security-team")
                .append("subjectType", "group")
                .append("domain", "security")
                .append("permission", Permission.admin.name())
                .append("userAccessId", 8);

        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(groupDoc);
        when(findIterable.iterator()).thenReturn(cursor);
        when(userAccessCollection.find(Filters.and(
                Filters.eq("subjectType", "group"),
                Filters.eq("domain", "security")))).thenReturn(findIterable);

        List<UserAccess> result = mongoUserAccessStore.getGroupGrantsForDomain("security");

        assertThat(result, hasSize(1));
        assertThat(result.getFirst().getDomain(), is("security"));
        assertThat(result.getFirst().getSubjectType(), is(UserAccess.SubjectType.group));
    }

    @Test
    void return_all_group_grants() {
        Document namespaceGroup = new Document("username", "architects")
                .append("subjectType", "group")
                .append("namespace", "org")
                .append("permission", Permission.read.name())
                .append("userAccessId", 7);
        Document domainGroup = new Document("username", "security-team")
                .append("subjectType", "group")
                .append("domain", "security")
                .append("permission", Permission.read.name())
                .append("userAccessId", 8);

        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        DocumentMongoCursor cursor = mock(DocumentMongoCursor.class);
        when(cursor.hasNext()).thenReturn(true, true, false);
        when(cursor.next()).thenReturn(namespaceGroup, domainGroup);
        when(findIterable.iterator()).thenReturn(cursor);
        when(userAccessCollection.find(Filters.eq("subjectType", "group"))).thenReturn(findIterable);

        List<UserAccess> result = mongoUserAccessStore.getAllGroupGrants();

        assertThat(result.stream().map(UserAccess::getUsername).toList(),
                contains("architects", "security-team"));
    }

    @Test
    void match_the_subject_type_when_looking_up_a_concurrently_created_group_grant() throws NamespaceNotFoundException {
        when(namespaceStore.namespaceExists(anyString())).thenReturn(true);
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(101);
        when(userAccessCollection.insertOne(ArgumentMatchers.any(Document.class)))
                .thenThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of()));

        Document existingDoc = new Document("username", "architects")
                .append("subjectType", "group")
                .append("namespace", "finos")
                .append("permission", Permission.write.name())
                .append("userAccessId", 55);
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(userAccessCollection.find(Filters.and(
                Filters.eq("username", "architects"),
                Filters.eq("subjectType", "group"),
                Filters.eq("namespace", "finos"),
                Filters.eq("permission", "write")))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(existingDoc);

        UserAccess group = new UserAccess.UserAccessBuilder()
                .setNamespace("finos")
                .setUsername("architects")
                .setSubjectType(UserAccess.SubjectType.group)
                .setPermission(Permission.write)
                .build();

        UserAccess actual = mongoUserAccessStore.createUserAccessForNamespace(group);

        assertThat(actual.getUserAccessId(), is(55));
        assertThat(actual.getSubjectType(), is(UserAccess.SubjectType.group));
    }

    @Test
    void exclude_group_rows_when_looking_up_a_concurrently_created_user_grant() {
        when(counterStore.getNextUserAccessSequenceValue()).thenReturn(101);
        when(userAccessCollection.insertOne(ArgumentMatchers.any(Document.class)))
                .thenThrow(new MongoWriteException(new WriteError(11000, "duplicate key", new BsonDocument()), new ServerAddress(), List.of()));

        Document existingDoc = new Document("username", "alice")
                .append("domain", "security")
                .append("permission", Permission.read.name())
                .append("userAccessId", 56);
        DocumentFindIterable findIterable = mock(DocumentFindIterable.class);
        when(userAccessCollection.find(Filters.and(
                Filters.eq("username", "alice"),
                Filters.ne("subjectType", "group"),
                Filters.eq("domain", "security"),
                Filters.eq("permission", "read")))).thenReturn(findIterable);
        when(findIterable.first()).thenReturn(existingDoc);

        UserAccess user = new UserAccess.UserAccessBuilder()
                .setDomain("security")
                .setUsername("alice")
                .setPermission(Permission.read)
                .build();

        UserAccess actual = mongoUserAccessStore.createUserAccessForDomain(user);

        assertThat(actual.getUserAccessId(), is(56));
        assertThat(actual.getSubjectType(), is(UserAccess.SubjectType.user));
    }
}
