package org.finos.calm.store.nitrite;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.DocumentCursor;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.DocumentVersionExistsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestNitriteDocumentStoreShould {
    @Mock Nitrite database; @Mock NitriteCollection collection; @Mock NitriteNamespaceStore namespaceStore; @Mock NitriteCounterStore counterStore; @Mock DocumentCursor cursor;
    private NitriteDocumentStore store; private final CreateDocumentRequest request=new CreateDocumentRequest("name","description","---\ntitle: A\n---\nbody");
    @BeforeEach void setUp(){when(database.getCollection("documents")).thenReturn(collection);when(namespaceStore.namespaceExists("finos")).thenReturn(true);when(collection.find(org.mockito.ArgumentMatchers.<Filter>any())).thenReturn(cursor);store=new NitriteDocumentStore(database,namespaceStore,counterStore);}
    private Document root(){return Document.createDocument().put("namespace","finos").put("documentType","pattern").put("documents",new ArrayList<>(List.of(Document.createDocument().put("documentId",7).put("name","name").put("description","description").put("versions",Document.createDocument().put("1-0-0",request.getDocumentMarkdown())))));}
    @Test void list_get_create_and_reject_compact_version_alias() throws Exception { Document root=root();when(cursor.firstOrNull()).thenReturn(root);assertThat(store.getDocumentsForNamespace("finos","pattern"),contains(7));assertThat(store.getDocumentForVersion("finos","pattern",7,"100"),is(request.getDocumentMarkdown()));when(counterStore.getNextDocumentSequenceValue()).thenReturn(8);store.createDocumentForNamespace(request,"finos","pattern");assertThat(store.createDocumentForVersion(request,"finos","pattern",7,"1.0.1").getVersion(),is("1.0.1"));assertThrows(DocumentVersionExistsException.class,()->store.createDocumentForVersion(request,"finos","pattern",7,"100"));}
    @Test void sort_document_ids_numerically() throws Exception { Document root=root();root.put("documents",new ArrayList<>(List.of(Document.createDocument().put("documentId",2),Document.createDocument().put("documentId",1))));when(cursor.firstOrNull()).thenReturn(root);assertThat(store.getDocumentsForNamespace("finos","pattern"),contains(1,2));}
    @Test void sort_versions_by_numeric_semantic_version_components() throws Exception { Document root=root(); @SuppressWarnings("unchecked") List<Document> documents=(List<Document>)root.get("documents"); documents.getFirst().put("versions",Document.createDocument().put("2147483648-0-0","large").put("1-0-10","ten").put("1-0-2","two")); when(cursor.firstOrNull()).thenReturn(root); assertThat(store.getDocumentVersions("finos","pattern",7),contains("1.0.2","1.0.10","2147483648.0.0")); }
    @Test void update_the_same_owning_root_loaded_for_a_new_version() throws Exception { Document owningRoot=root(); Document laterQueryCopy=root(); when(cursor.firstOrNull()).thenReturn(owningRoot,laterQueryCopy); store.createDocumentForVersion(request,"finos","pattern",7,"1.0.1"); verify(collection).update(same(owningRoot)); verify(cursor,times(1)).firstOrNull(); @SuppressWarnings("unchecked") List<Document> documents = (List<Document>) owningRoot.get("documents"); assertThat(documents.getFirst().get("versions",Document.class).containsKey("1-0-1"),is(true)); }
    @Test void block_version_reads_until_a_version_write_completes() throws Exception { Document owningRoot=root(); CountDownLatch updateStarted=new CountDownLatch(1); CountDownLatch releaseUpdate=new CountDownLatch(1); CountDownLatch readerStarted=new CountDownLatch(2); when(cursor.firstOrNull()).thenReturn(owningRoot); doAnswer(invocation->{updateStarted.countDown();assertTrue(releaseUpdate.await(5,TimeUnit.SECONDS));return null;}).when(collection).update(same(owningRoot)); ExecutorService executor=Executors.newFixedThreadPool(3); try { Future<?> writer=executor.submit(()->{try{store.createDocumentForVersion(request,"finos","pattern",7,"1.0.1");}catch(Exception exception){throw new RuntimeException(exception);}}); assertTrue(updateStarted.await(5,TimeUnit.SECONDS)); Future<List<String>> versionsReader=executor.submit(()->{readerStarted.countDown();return store.getDocumentVersions("finos","pattern",7);}); Future<String> documentReader=executor.submit(()->{readerStarted.countDown();return store.getDocumentForVersion("finos","pattern",7,"1.0.0");}); assertTrue(readerStarted.await(5,TimeUnit.SECONDS)); Thread.sleep(100); assertFalse(versionsReader.isDone()); assertFalse(documentReader.isDone()); releaseUpdate.countDown(); assertThat(versionsReader.get(5,TimeUnit.SECONDS),contains("1.0.0","1.0.1")); assertThat(documentReader.get(5,TimeUnit.SECONDS),is(request.getDocumentMarkdown())); writer.get(5,TimeUnit.SECONDS); } finally { executor.shutdownNow(); } }
}
