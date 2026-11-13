package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.collection.NitriteId;
import org.dizitart.no2.common.tuples.Pair;
import org.mockito.ArgumentCaptor;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TestNitriteUserAccessStoreShould {

    @Mock
    private Nitrite mockDb;

    @Mock
    private NitriteCollection mockCollection;

    @Mock
    private DocumentCursor mockCursor;

    @Mock
    private NitriteCounterStore mockCounterStore;

    @Mock
    private NitriteNamespaceStore mockNamespaceStore;

    private NitriteUserAccessStore userAccessStore;

    @BeforeEach
    public void setup() throws NamespaceNotFoundException {
        when(mockDb.getCollection("userAccess")).thenReturn(mockCollection);
        lenient().doCallRealMethod().when(mockNamespaceStore).requireNamespace(any());
        userAccessStore = new NitriteUserAccessStore(mockDb, mockNamespaceStore, mockCounterStore);
    }

    @Test
    public void testCreateUserAccessForNamespace() throws NamespaceNotFoundException {
        // Arrange
        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setNamespace("finos")
                .setUsername("testuser")
                .setPermission(UserAccess.Permission.read)
                .build();
        userAccess.setCreationDateTime(LocalDateTime.now());
        userAccess.setUpdateDateTime(LocalDateTime.now());

        when(mockNamespaceStore.namespaceExists("finos")).thenReturn(true);
        when(mockCounterStore.getNextUserAccessSequenceValue()).thenReturn(1);

        // Act
        UserAccess result = userAccessStore.createUserAccessForNamespace(userAccess);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.getUserAccessId(), is(1));
        assertThat(result.getNamespace(), is("finos"));
        assertThat(result.getUsername(), is("testuser"));
        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    public void testCreateUserAccessForNamespace_ThrowsExceptionWhenNamespaceNotFound() {
        // Arrange
        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setNamespace("nonexistent")
                .setUsername("testuser")
                .setPermission(UserAccess.Permission.read)
                .build();

        when(mockNamespaceStore.namespaceExists("nonexistent")).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> userAccessStore.createUserAccessForNamespace(userAccess));
    }

    @Test
    public void getGrantsForUser_returns_empty_list_when_no_grants_exist() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.emptyIterator());

        List<UserAccess> result = userAccessStore.getGrantsForUser("alice");
        assertThat(result, hasSize(0));
    }

    @Test
    public void getGrantsForUser_returns_user_and_wildcard_grants() {
        Document userDoc = mock(Document.class);
        when(userDoc.get("username", String.class)).thenReturn("alice");
        when(userDoc.get("namespace", String.class)).thenReturn("org");
        when(userDoc.get("domain", String.class)).thenReturn(null);
        when(userDoc.get("permission", String.class)).thenReturn("write");
        when(userDoc.get("userAccessId", Integer.class)).thenReturn(1);
        when(userDoc.get("subjectType", String.class)).thenReturn(null);

        Document wildcardDoc = mock(Document.class);
        when(wildcardDoc.get("username", String.class)).thenReturn("*");
        when(wildcardDoc.get("namespace", String.class)).thenReturn("org.ab");
        when(wildcardDoc.get("domain", String.class)).thenReturn(null);
        when(wildcardDoc.get("permission", String.class)).thenReturn("read");
        when(wildcardDoc.get("userAccessId", Integer.class)).thenReturn(2);
        when(wildcardDoc.get("subjectType", String.class)).thenReturn(null);

        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(List.of(userDoc, wildcardDoc).iterator());

        List<UserAccess> result = userAccessStore.getGrantsForUser("alice");
        assertThat(result, hasSize(2));
        assertThat(result.stream().map(UserAccess::getUsername).toList(),
                containsInAnyOrder("alice", "*"));
    }

    @Test
    public void testGetUserAccessForUsername() throws UserAccessNotFoundException {
        // Arrange
        Document mockDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.singletonList(mockDoc).iterator());
        
        when(mockDoc.get("username", String.class)).thenReturn("testuser");
        when(mockDoc.get("namespace", String.class)).thenReturn("finos");
        when(mockDoc.get("domain", String.class)).thenReturn(null);
        when(mockDoc.get("permission", String.class)).thenReturn("read");
        when(mockDoc.get("userAccessId", Integer.class)).thenReturn(1);
        when(mockDoc.get("subjectType", String.class)).thenReturn(null);

        // Act
        List<UserAccess> result = userAccessStore.getUserAccessForUsername("testuser");

        // Assert
        assertThat(result, hasSize(1));
        assertThat(result.getFirst().getUsername(), is("testuser"));
        assertThat(result.getFirst().getNamespace(), is("finos"));
    }

    @Test
    public void testGetUserAccessForUsername_ThrowsExceptionWhenNotFound() {
        // Arrange
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.emptyIterator());

        // Act & Assert
        assertThrows(UserAccessNotFoundException.class, () -> userAccessStore.getUserAccessForUsername("nonexistent"));
    }

    @Test
    public void testGetUserAccessForNamespace() throws NamespaceNotFoundException, UserAccessNotFoundException {
        // Arrange
        Document mockDoc = mock(Document.class);
        when(mockNamespaceStore.namespaceExists("finos")).thenReturn(true);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.singletonList(mockDoc).iterator());
        
        when(mockDoc.get("username", String.class)).thenReturn("testuser");
        when(mockDoc.get("namespace", String.class)).thenReturn("finos");
        when(mockDoc.get("domain", String.class)).thenReturn(null);
        when(mockDoc.get("permission", String.class)).thenReturn("read");
        when(mockDoc.get("userAccessId", Integer.class)).thenReturn(1);
        when(mockDoc.get("subjectType", String.class)).thenReturn(null);

        // Act
        List<UserAccess> result = userAccessStore.getUserAccessForNamespace("finos");

        // Assert
        assertThat(result, hasSize(1));
        assertThat(result.getFirst().getNamespace(), is("finos"));
    }

    @Test
    public void testGetUserAccessForNamespace_ThrowsExceptionWhenNamespaceNotFound() {
        // Arrange
        when(mockNamespaceStore.namespaceExists("nonexistent")).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> userAccessStore.getUserAccessForNamespace("nonexistent"));
    }

    @Test
    public void testGetUserAccessForNamespaceAndId() throws NamespaceNotFoundException, UserAccessNotFoundException {
        // Arrange
        Document mockDoc = mock(Document.class);
        when(mockNamespaceStore.namespaceExists("finos")).thenReturn(true);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(mockDoc);
        
        when(mockDoc.get("username", String.class)).thenReturn("testuser");
        when(mockDoc.get("namespace", String.class)).thenReturn("finos");
        when(mockDoc.get("domain", String.class)).thenReturn(null);
        when(mockDoc.get("permission", String.class)).thenReturn("read");
        when(mockDoc.get("userAccessId", Integer.class)).thenReturn(1);
        when(mockDoc.get("subjectType", String.class)).thenReturn(null);

        // Act
        UserAccess result = userAccessStore.getUserAccessForNamespaceAndId("finos", 1);

        // Assert
        assertThat(result, is(notNullValue()));
        assertThat(result.getUserAccessId(), is(1));
        assertThat(result.getNamespace(), is("finos"));
    }

    @Test
    public void testGetUserAccessForNamespaceAndId_ThrowsExceptionWhenNotFound() {
        // Arrange
        when(mockNamespaceStore.namespaceExists("finos")).thenReturn(true);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(null);

        // Act & Assert
        assertThrows(UserAccessNotFoundException.class, () -> userAccessStore.getUserAccessForNamespaceAndId("finos", 1));
    }

    @Test
    public void testCreateUserAccessForDomain() {
        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setDomain("payments")
                .setUsername("testuser")
                .setPermission(UserAccess.Permission.write)
                .build();
        userAccess.setCreationDateTime(java.time.LocalDateTime.now());
        userAccess.setUpdateDateTime(java.time.LocalDateTime.now());

        when(mockCounterStore.getNextUserAccessSequenceValue()).thenReturn(2);

        UserAccess result = userAccessStore.createUserAccessForDomain(userAccess);

        assertThat(result, is(notNullValue()));
        assertThat(result.getUserAccessId(), is(2));
        assertThat(result.getDomain(), is("payments"));
        assertThat(result.getUsername(), is("testuser"));
        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    public void testGetUserAccessForDomain() throws UserAccessNotFoundException {
        Document mockDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.singletonList(mockDoc).iterator());

        when(mockDoc.get("username", String.class)).thenReturn("testuser");
        when(mockDoc.get("namespace", String.class)).thenReturn(null);
        when(mockDoc.get("domain", String.class)).thenReturn("payments");
        when(mockDoc.get("permission", String.class)).thenReturn("write");
        when(mockDoc.get("userAccessId", Integer.class)).thenReturn(2);
        when(mockDoc.get("subjectType", String.class)).thenReturn(null);

        List<UserAccess> result = userAccessStore.getUserAccessForDomain("payments");

        assertThat(result, hasSize(1));
        assertThat(result.getFirst().getDomain(), is("payments"));
    }

    @Test
    public void testGetUserAccessForDomain_ReturnsEmptyListWhenNotFound() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.emptyIterator());

        assertThat(userAccessStore.getUserAccessForDomain("payments"), hasSize(0));
    }

    @Test
    public void testGetUserAccessForDomainAndId() throws UserAccessNotFoundException {
        Document mockDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(mockDoc);

        when(mockDoc.get("username", String.class)).thenReturn("testuser");
        when(mockDoc.get("namespace", String.class)).thenReturn(null);
        when(mockDoc.get("domain", String.class)).thenReturn("payments");
        when(mockDoc.get("permission", String.class)).thenReturn("write");
        when(mockDoc.get("userAccessId", Integer.class)).thenReturn(2);
        when(mockDoc.get("subjectType", String.class)).thenReturn(null);

        UserAccess result = userAccessStore.getUserAccessForDomainAndId("payments", 2);

        assertThat(result, is(notNullValue()));
        assertThat(result.getDomain(), is("payments"));
        assertThat(result.getUserAccessId(), is(2));
    }

    @Test
    public void testGetUserAccessForDomainAndId_ThrowsExceptionWhenNotFound() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(null);

        assertThrows(UserAccessNotFoundException.class, () -> userAccessStore.getUserAccessForDomainAndId("payments", 2));
    }

    @Test
    public void deleteUserAccessForNamespace_removesDocumentAndSucceeds() throws Exception {
        Document mockDoc = mock(Document.class);
        when(mockNamespaceStore.namespaceExists("finos")).thenReturn(true);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(mockDoc);

        userAccessStore.deleteUserAccessForNamespace("finos", 1);

        verify(mockCollection).remove(mockDoc);
    }

    @Test
    public void deleteUserAccessForNamespace_throwsNamespaceNotFoundException_whenNamespaceDoesNotExist() {
        when(mockNamespaceStore.namespaceExists("nonexistent")).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class,
                () -> userAccessStore.deleteUserAccessForNamespace("nonexistent", 1));
        verify(mockCollection, never()).remove(any(Document.class));
    }

    @Test
    public void deleteUserAccessForNamespace_throwsUserAccessNotFoundException_whenGrantDoesNotExist() {
        when(mockNamespaceStore.namespaceExists("finos")).thenReturn(true);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(null);

        assertThrows(UserAccessNotFoundException.class,
                () -> userAccessStore.deleteUserAccessForNamespace("finos", 999));
        verify(mockCollection, never()).remove(any(Document.class));
    }

    @Test
    public void testGetUserAccessForNamespace_ReturnsEmptyListWhenNoGrantsExist() throws Exception {
        when(mockNamespaceStore.namespaceExists("finos")).thenReturn(true);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.emptyIterator());

        assertThat(userAccessStore.getUserAccessForNamespace("finos"), hasSize(0));
    }

    @Test
    public void deleteUserAccessForDomain_removesDocumentAndSucceeds() throws Exception {
        Document mockDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(mockDoc);

        userAccessStore.deleteUserAccessForDomain("payments", 201);

        verify(mockCollection).remove(mockDoc);
    }

    @Test
    public void deleteUserAccessForDomain_throwsUserAccessNotFoundException_whenGrantDoesNotExist() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(null);

        assertThrows(UserAccessNotFoundException.class,
                () -> userAccessStore.deleteUserAccessForDomain("payments", 999));
        verify(mockCollection, never()).remove(any(Document.class));
    }

    @Test
    public void createUserAccessForNamespace_succeedsForGlobalWithoutNamespaceExistenceCheck() throws NamespaceNotFoundException {
        when(mockCounterStore.getNextUserAccessSequenceValue()).thenReturn(303);

        UserAccess userAccess = new UserAccess.UserAccessBuilder()
                .setNamespace("GLOBAL")
                .setUsername("alice")
                .setPermission(UserAccess.Permission.admin)
                .build();

        UserAccess result = userAccessStore.createUserAccessForNamespace(userAccess);

        assertThat(result.getUserAccessId(), is(303));
        assertThat(result.getNamespace(), is("GLOBAL"));
        verify(mockNamespaceStore, never()).namespaceExists("GLOBAL");
        verify(mockCollection).insert(any(Document.class));
    }

    @Test
    public void getUserAccessForNamespace_succeedsForGlobalWithoutNamespaceExistenceCheck() throws NamespaceNotFoundException {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.emptyIterator());

        List<UserAccess> result = userAccessStore.getUserAccessForNamespace("GLOBAL");

        assertThat(result, hasSize(0));
        verify(mockNamespaceStore, never()).namespaceExists("GLOBAL");
    }

    @Test
    public void getUserAccessForNamespaceAndId_succeedsForGlobalWithoutNamespaceExistenceCheck() throws Exception {
        Document mockDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(mockDoc);

        when(mockDoc.get("username", String.class)).thenReturn("alice");
        when(mockDoc.get("namespace", String.class)).thenReturn("GLOBAL");
        when(mockDoc.get("domain", String.class)).thenReturn(null);
        when(mockDoc.get("permission", String.class)).thenReturn("admin");
        when(mockDoc.get("userAccessId", Integer.class)).thenReturn(303);
        when(mockDoc.get("subjectType", String.class)).thenReturn(null);

        UserAccess result = userAccessStore.getUserAccessForNamespaceAndId("GLOBAL", 303);

        assertThat(result.getNamespace(), is("GLOBAL"));
        verify(mockNamespaceStore, never()).namespaceExists("GLOBAL");
    }

    @Test
    public void deleteUserAccessForNamespace_succeedsForGlobalWithoutNamespaceExistenceCheck() throws Exception {
        Document mockDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.firstOrNull()).thenReturn(mockDoc);

        userAccessStore.deleteUserAccessForNamespace("GLOBAL", 303);

        verify(mockNamespaceStore, never()).namespaceExists("GLOBAL");
        verify(mockCollection).remove(mockDoc);
    }

    @Test
    public void deleteAllUserAccessForNamespace_removesEveryMatchingGrant() {
        Document doc1 = mock(Document.class);
        Document doc2 = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(List.of(doc1, doc2).iterator());

        userAccessStore.deleteAllUserAccessForNamespace("finos");

        verify(mockCollection).remove(doc1);
        verify(mockCollection).remove(doc2);
    }

    @Test
    public void deleteAllUserAccessForNamespace_removesNothingWhenNoGrantsExist() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.emptyIterator());

        userAccessStore.deleteAllUserAccessForNamespace("finos");

        verify(mockCollection, never()).remove(any(Document.class));
    }

    @Test
    public void deleteAllUserAccessForDomain_removesEveryMatchingGrant() {
        Document doc1 = mock(Document.class);
        Document doc2 = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(List.of(doc1, doc2).iterator());

        userAccessStore.deleteAllUserAccessForDomain("payments");

        verify(mockCollection).remove(doc1);
        verify(mockCollection).remove(doc2);
    }

    @Test
    public void deleteAllUserAccessForDomain_removesNothingWhenNoGrantsExist() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.emptyIterator());

        userAccessStore.deleteAllUserAccessForDomain("payments");

        verify(mockCollection, never()).remove(any(Document.class));
    }

    @Test
    public void write_the_subject_type_when_creating_grants() throws NamespaceNotFoundException {
        when(mockNamespaceStore.namespaceExists("finos")).thenReturn(true);
        when(mockCounterStore.getNextUserAccessSequenceValue()).thenReturn(1, 2);

        UserAccess group = new UserAccess.UserAccessBuilder()
                .setNamespace("finos")
                .setUsername("architects")
                .setSubjectType(UserAccess.SubjectType.group)
                .setPermission(UserAccess.Permission.write)
                .build();
        UserAccess domainGroup = new UserAccess.UserAccessBuilder()
                .setDomain("security")
                .setUsername("security-team")
                .setSubjectType(UserAccess.SubjectType.group)
                .setPermission(UserAccess.Permission.admin)
                .build();

        UserAccess createdGroup = userAccessStore.createUserAccessForNamespace(group);
        UserAccess createdDomainGroup = userAccessStore.createUserAccessForDomain(domainGroup);

        ArgumentCaptor<Document> inserted = ArgumentCaptor.forClass(Document.class);
        verify(mockCollection, times(2)).insert(inserted.capture());
        assertThat(inserted.getAllValues().get(0).get("subjectType", String.class), is("group"));
        assertThat(inserted.getAllValues().get(1).get("subjectType", String.class), is("group"));
        assertThat(createdGroup.getSubjectType(), is(UserAccess.SubjectType.group));
        assertThat(createdDomainGroup.getSubjectType(), is(UserAccess.SubjectType.group));
    }

    @Test
    public void exclude_group_rows_but_keep_legacy_rows_in_user_lookups() throws UserAccessNotFoundException {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Collections.emptyIterator());

        userAccessStore.getGrantsForUser("alice");
        assertThrows(UserAccessNotFoundException.class, () -> userAccessStore.getUserAccessForUsername("alice"));

        ArgumentCaptor<Filter> filters = ArgumentCaptor.forClass(Filter.class);
        verify(mockCollection, times(2)).find(filters.capture());
        for (Filter filter : filters.getAllValues()) {
            assertThat(matches(filter, grantDocument("alice", null)), is(true));
            assertThat(matches(filter, grantDocument("alice", "user")), is(true));
            assertThat(matches(filter, grantDocument("alice", "group")), is(false));
        }
        assertThat(matches(filters.getAllValues().getFirst(), grantDocument("*", null)), is(true));
    }

    @Test
    public void return_group_grants_for_namespaces() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(List.of(grantDocument("architects", "group")).iterator());

        List<UserAccess> result = userAccessStore.getGroupGrantsForNamespaces(List.of("org", "org.ab"));

        assertThat(result, hasSize(1));
        assertThat(result.getFirst().getSubjectType(), is(UserAccess.SubjectType.group));

        ArgumentCaptor<Filter> filter = ArgumentCaptor.forClass(Filter.class);
        verify(mockCollection).find(filter.capture());
        assertThat(matches(filter.getValue(), grantDocument("architects", "group")), is(true));
        assertThat(matches(filter.getValue(), grantDocument("architects", "group").put("namespace", "org.ab")), is(true));
        assertThat(matches(filter.getValue(), grantDocument("architects", "group").put("namespace", "other")), is(false));
        assertThat(matches(filter.getValue(), grantDocument("architects", null)), is(false));
    }

    @Test
    public void return_no_group_grants_for_no_namespaces() {
        assertThat(userAccessStore.getGroupGrantsForNamespaces(List.of()), is(empty()));
        verify(mockCollection, never()).find(any(Filter.class));
    }

    @Test
    public void return_group_grants_for_domain() {
        Document domainGroup = Document.createDocument()
                .put("username", "security-team")
                .put("subjectType", "group")
                .put("domain", "security")
                .put("permission", "admin")
                .put("userAccessId", 3);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(List.of(domainGroup).iterator());

        List<UserAccess> result = userAccessStore.getGroupGrantsForDomain("security");

        assertThat(result, hasSize(1));
        assertThat(result.getFirst().getDomain(), is("security"));

        ArgumentCaptor<Filter> filter = ArgumentCaptor.forClass(Filter.class);
        verify(mockCollection).find(filter.capture());
        assertThat(matches(filter.getValue(), domainGroup), is(true));
        assertThat(matches(filter.getValue(), Document.createDocument().put("username", "security-team")
                .put("domain", "security")), is(false));
    }

    private static Document grantDocument(String username, String subjectType) {
        Document doc = Document.createDocument()
                .put("username", username)
                .put("namespace", "org")
                .put("permission", "read")
                .put("userAccessId", 1);
        if (subjectType != null) {
            doc.put("subjectType", subjectType);
        }
        return doc;
    }

    private static boolean matches(Filter filter, Document doc) {
        return filter.apply(new Pair<>(NitriteId.newId(), doc));
    }

    @Test
    public void return_all_group_grants() {
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(List.of(grantDocument("architects", "group")).iterator());

        List<UserAccess> result = userAccessStore.getAllGroupGrants();

        assertThat(result, hasSize(1));
        assertThat(result.getFirst().getSubjectType(), is(UserAccess.SubjectType.group));

        ArgumentCaptor<Filter> filter = ArgumentCaptor.forClass(Filter.class);
        verify(mockCollection).find(filter.capture());
        assertThat(matches(filter.getValue(), grantDocument("architects", "group")), is(true));
        assertThat(matches(filter.getValue(), grantDocument("architects", "group").put("namespace", "other")), is(true));
        assertThat(matches(filter.getValue(), grantDocument("alice", "user")), is(false));
        assertThat(matches(filter.getValue(), grantDocument("alice", null)), is(false));
    }
}
