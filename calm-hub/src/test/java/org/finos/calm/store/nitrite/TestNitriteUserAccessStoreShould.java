package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
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
    public void setup() {
        when(mockDb.getCollection("userAccess")).thenReturn(mockCollection);
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

        Document wildcardDoc = mock(Document.class);
        when(wildcardDoc.get("username", String.class)).thenReturn("*");
        when(wildcardDoc.get("namespace", String.class)).thenReturn("org.ab");
        when(wildcardDoc.get("domain", String.class)).thenReturn(null);
        when(wildcardDoc.get("permission", String.class)).thenReturn("read");
        when(wildcardDoc.get("userAccessId", Integer.class)).thenReturn(2);

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
}
