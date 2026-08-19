package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import io.quarkus.arc.lookup.LookupIfProperty;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.documents.CreateDocumentRequest;
import org.finos.calm.domain.exception.*;
import org.finos.calm.store.DocumentStore;
import java.math.BigInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.*;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import static org.dizitart.no2.filters.FluentFilter.where;

@LookupIfProperty(name="calm.database.mode", stringValue="standalone")
@ApplicationScoped @Typed(NitriteDocumentStore.class)
public class NitriteDocumentStore implements DocumentStore {
 private final NitriteCollection collection; private final NitriteNamespaceStore namespaceStore; private final NitriteCounterStore counterStore;
 private final ReadWriteLock lock = new ReentrantReadWriteLock();
 @Inject public NitriteDocumentStore(@StandaloneQualifier Nitrite db,NitriteNamespaceStore namespaceStore,NitriteCounterStore counterStore){collection=db.getCollection("documents");this.namespaceStore=namespaceStore;this.counterStore=counterStore;}
 private void namespace(String n)throws NamespaceNotFoundException{if(!namespaceStore.namespaceExists(n))throw new NamespaceNotFoundException();}
 private Document root(String n,String t){return collection.find(where("namespace").eq(n).and(where("documentType").eq(t))).firstOrNull();}
 @SuppressWarnings("unchecked") private List<Document> items(Document r){return r==null?List.of():(List<Document>)r.get("documents");}
 @Override public List<Integer> getDocumentsForNamespace(String n,String t)throws NamespaceNotFoundException{namespace(n);lock.readLock().lock();try{List<Integer> out=new ArrayList<>();for(Document d:items(root(n,t))){out.add(d.get("documentId",Integer.class));}out.sort(Integer::compareTo);return out;}finally{lock.readLock().unlock();}}
 @Override public org.finos.calm.domain.Document createDocumentForNamespace(CreateDocumentRequest r,String n,String t)throws NamespaceNotFoundException{namespace(n);lock.writeLock().lock();try{int id=counterStore.getNextDocumentSequenceValue();Document item=Document.createDocument().put("documentId",id).put("name",r.getName()).put("description",r.getDescription()).put("versions",Document.createDocument().put("1-0-0",r.getDocumentMarkdown()));Document root=root(n,t);if(root==null)collection.insert(Document.createDocument().put("namespace",n).put("documentType",t).put("documents",new ArrayList<>(List.of(item))));else{List<Document> ds=new ArrayList<>(items(root));ds.add(item);root.put("documents",ds);collection.update(root);}return result(r,id,"1.0.0");}finally{lock.writeLock().unlock();}}
 private Document find(String n,String t,int id){for(Document d:items(root(n,t)))if(Integer.valueOf(id).equals(d.get("documentId",Integer.class)))return d;return null;}
 @Override public List<String> getDocumentVersions(String n,String t,Integer id)throws NamespaceNotFoundException,DocumentNotFoundException{namespace(n);lock.readLock().lock();try{Document d=find(n,t,id);if(d==null)throw new DocumentNotFoundException();return d.get("versions",Document.class).getFields().stream().map(NitriteDocumentStore::normalizeVersion).sorted(SEMANTIC_VERSION_COMPARATOR).toList();}finally{lock.readLock().unlock();}}
 @Override public String getDocumentForVersion(String n,String t,Integer id,String v)throws NamespaceNotFoundException,DocumentNotFoundException,DocumentVersionNotFoundException{namespace(n);lock.readLock().lock();try{Document d=find(n,t,id);if(d==null)throw new DocumentNotFoundException();String val=d.get("versions",Document.class).get(normalizeVersion(v).replace('.','-'),String.class);if(val==null)throw new DocumentVersionNotFoundException();return val;}finally{lock.readLock().unlock();}}
 @Override public org.finos.calm.domain.Document createDocumentForVersion(CreateDocumentRequest r,String n,String t,Integer id,String v)throws NamespaceNotFoundException,DocumentNotFoundException,DocumentVersionExistsException{namespace(n);lock.writeLock().lock();try{Document owningRoot=root(n,t);Document d=find(owningRoot,id);if(d==null)throw new DocumentNotFoundException();Document vs=d.get("versions",Document.class);String normalizedVersion=normalizeVersion(v);String k=normalizedVersion.replace('.','-');if(vs.containsKey(k))throw new DocumentVersionExistsException();vs.put(k,r.getDocumentMarkdown());d.put("name",r.getName()).put("description",r.getDescription());collection.update(owningRoot);return result(r,id,normalizedVersion);}finally{lock.writeLock().unlock();}}
 private Document find(Document owningRoot,int id){for(Document d:items(owningRoot))if(Integer.valueOf(id).equals(d.get("documentId",Integer.class)))return d;return null;}
 private org.finos.calm.domain.Document result(CreateDocumentRequest r,int id,String v){org.finos.calm.domain.Document d=new org.finos.calm.domain.Document(r);d.setId(id);d.setVersion(v);return d;}
 private static final Pattern VERSION_PATTERN=Pattern.compile("^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$");
 private static String normalizeVersion(String version){Matcher matcher=VERSION_PATTERN.matcher(version);if(!matcher.matches())throw new IllegalArgumentException("Invalid document version");return matcher.group(1)+"."+matcher.group(2)+"."+matcher.group(3);}
 private static final Comparator<String> SEMANTIC_VERSION_COMPARATOR=Comparator.comparing((String version)->new BigInteger(version.split("\\.")[0])).thenComparing(version->new BigInteger(version.split("\\.")[1])).thenComparing(version->new BigInteger(version.split("\\.")[2]));
}
