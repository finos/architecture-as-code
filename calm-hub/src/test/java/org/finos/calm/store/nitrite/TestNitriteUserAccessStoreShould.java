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
import java.util.Arrays;
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
                .setResourceType(UserAccess.ResourceType.patterns)
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
                .setResourceType(UserAccess.ResourceType.patterns)
                .build();

        when(mockNamespaceStore.namespaceExists("nonexistent")).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> {
            userAccessStore.createUserAccessForNamespace(userAccess);
        });
    }

    @Test
    public void testGetUserAccessForUsername() throws UserAccessNotFoundException {
        // Arrange
        Document mockDoc = mock(Document.class);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Arrays.asList(mockDoc).iterator());
        
        when(mockDoc.get("username", String.class)).thenReturn("testuser");
        when(mockDoc.get("namespace", String.class)).thenReturn("finos");
        when(mockDoc.get("permission", String.class)).thenReturn("read");
        when(mockDoc.get("resourceType", String.class)).thenReturn("patterns");
        when(mockDoc.get("userAccessId", Integer.class)).thenReturn(1);

        // Act
        List<UserAccess> result = userAccessStore.getUserAccessForUsername("testuser");

        // Assert
        assertThat(result, hasSize(1));
        assertThat(result.get(0).getUsername(), is("testuser"));
        assertThat(result.get(0).getNamespace(), is("finos"));
    }

    @Test
    public void testGetUserAccessForUsername_ThrowsExceptionWhenNotFound() {
        // Arrange
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(java.util.Collections.<Document>emptyList().iterator());

        // Act & Assert
        assertThrows(UserAccessNotFoundException.class, () -> {
            userAccessStore.getUserAccessForUsername("nonexistent");
        });
    }

    @Test
    public void testGetUserAccessForNamespace() throws NamespaceNotFoundException, UserAccessNotFoundException {
        // Arrange
        Document mockDoc = mock(Document.class);
        when(mockNamespaceStore.namespaceExists("finos")).thenReturn(true);
        when(mockCollection.find(any(Filter.class))).thenReturn(mockCursor);
        when(mockCursor.iterator()).thenReturn(Arrays.asList(mockDoc).iterator());
        
        when(mockDoc.get("username", String.class)).thenReturn("testuser");
        when(mockDoc.get("namespace", String.class)).thenReturn("finos");
        when(mockDoc.get("permission", String.class)).thenReturn("read");
        when(mockDoc.get("resourceType", String.class)).thenReturn("patterns");
        when(mockDoc.get("userAccessId", Integer.class)).thenReturn(1);

        // Act
        List<UserAccess> result = userAccessStore.getUserAccessForNamespace("finos");

        // Assert
        assertThat(result, hasSize(1));
        assertThat(result.get(0).getNamespace(), is("finos"));
    }

    @Test
    public void testGetUserAccessForNamespace_ThrowsExceptionWhenNamespaceNotFound() {
        // Arrange
        when(mockNamespaceStore.namespaceExists("nonexistent")).thenReturn(false);

        // Act & Assert
        assertThrows(NamespaceNotFoundException.class, () -> {
            userAccessStore.getUserAccessForNamespace("nonexistent");
        });
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
        when(mockDoc.get("permission", String.class)).thenReturn("read");
        when(mockDoc.get("resourceType", String.class)).thenReturn("patterns");
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
        assertThrows(UserAccessNotFoundException.class, () -> {
            userAccessStore.getUserAccessForNamespaceAndId("finos", 1);
        });
    }
}
