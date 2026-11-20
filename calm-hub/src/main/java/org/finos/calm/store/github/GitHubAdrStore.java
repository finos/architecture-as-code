package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.adr.Adr;
import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.AdrSlugMapping;
import org.finos.calm.domain.adr.AdrSlugs;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrPersistenceException;
import org.finos.calm.domain.exception.AdrRevisionExistsException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.finos.calm.store.util.AdrDocumentMapper;
import org.finos.calm.store.util.AdrSlugAllocator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * GitHub-mode {@link AdrStore}: ADRs are the {@code .json} files under {@code adrs/} in the
 * namespace's clone, in either the kebab-case {@code adr.json} shape or the Hub's camelCase
 * shape (see {@link AdrDocumentMapper#fromAnyShape}). Markdown ADRs are indexed by the
 * registry but not served.
 *
 * <ul>
 *   <li><b>Slug</b>: the file's {@code slug} field if it is valid, else derived from the file
 *       name without {@code .json} (so {@code 0007-use-kafka.json} is {@code use-kafka}).
 *       Two files that come to the same slug are told apart with {@code -2}, {@code -3}, ...
 *       in path order, which the registry keeps stable across rebuilds.</li>
 *   <li><b>Numeric id</b>: {@code uniqueId.hashCode() & 0x7FFFFFFF}, as every other GitHub
 *       store, with the same accepted risk of a hash collision.</li>
 *   <li><b>Revisions</b>: the numeric Storage API sees one revision, {@code 1}, which is the
 *       file as the clone holds it. A file has no revision history of its own; its history
 *       is git's. The name-based API lists commit SHAs as versions, as it does for every
 *       other GitHub-backed type, and also accepts {@code 1} for the current content.</li>
 * </ul>
 *
 * Every mutating method throws {@link GitHubWriteNotSupportedException}.
 */
@ApplicationScoped
@Typed(GitHubAdrStore.class)
public class GitHubAdrStore extends AbstractReadOnlyGitHubStore implements AdrStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubAdrStore.class);
    private static final int CURRENT_REVISION = 1;
    private static final String CURRENT_REVISION_LABEL = String.valueOf(CURRENT_REVISION);
    private static final String JSON_EXTENSION = ".json";

    private final AdrDocumentMapper mapper = new AdrDocumentMapper();

    private record AdrFile(RegistryEntry entry, int id, String slug, String content) {
    }

    @Inject
    public GitHubAdrStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                          GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
        super(registryService, cloneManager, versionService, fileReader);
    }

    @Override
    public List<NamespaceAdrSummary> getAdrsForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        List<NamespaceAdrSummary> summaries = new ArrayList<>();
        for (AdrFile file : adrFiles(namespace)) {
            String title = "ADR " + file.id();
            String status = "unknown";
            Optional<Adr> adr = parse(file);
            if (adr.isPresent()) {
                title = adr.get().getTitle() != null ? adr.get().getTitle() : title;
                status = adr.get().getStatus() != null ? adr.get().getStatus().name() : status;
            }
            summaries.add(new NamespaceAdrSummary(title, status, file.id(), file.slug()));
        }
        return summaries;
    }

    @Override
    public int countAdrsForNamespace(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return jsonEntries(namespace).size();
    }

    @Override
    public AdrMeta createAdrForNamespace(AdrMeta adrMeta) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public AdrMeta getAdr(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrParseException {
        verifyNamespace(adrMeta.getNamespace());
        AdrFile file = requireFile(adrMeta.getNamespace(), adrMeta.getId());
        return toAdrMeta(adrMeta.getNamespace(), file, CURRENT_REVISION,
                parse(file).orElseThrow(AdrParseException::new));
    }

    @Override
    public List<Integer> getAdrRevisions(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException {
        verifyNamespace(adrMeta.getNamespace());
        requireFile(adrMeta.getNamespace(), adrMeta.getId());
        return List.of(CURRENT_REVISION);
    }

    @Override
    public AdrMeta getAdrRevision(AdrMeta adrMeta) throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        AdrMeta current = getAdr(adrMeta);
        if (adrMeta.getRevision() != CURRENT_REVISION) {
            throw new AdrRevisionNotFoundException();
        }
        return current;
    }

    @Override
    public AdrMeta updateAdrForNamespace(AdrMeta adrMeta) throws AdrPersistenceException, AdrRevisionExistsException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public AdrMeta createAdrRevision(AdrMeta adrMeta) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public AdrMeta updateAdrStatus(AdrMeta adrMeta, Status status) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void deleteAdr(String namespace, int adrId) {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public int getAdrIdBySlug(String namespace, String slug) throws NamespaceNotFoundException, AdrNotFoundException {
        verifyNamespace(namespace);
        return adrFiles(namespace).stream()
                .filter(file -> file.slug().equals(slug))
                .findFirst()
                .map(AdrFile::id)
                .orElseThrow(AdrNotFoundException::new);
    }

    @Override
    public List<AdrSlugMapping> getAdrSlugs(String namespace) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return adrFiles(namespace).stream()
                .map(file -> new AdrSlugMapping(file.slug(), file.id()))
                .toList();
    }

    /** Commit SHAs, oldest first, as the other GitHub stores list versions. */
    @Override
    public List<String> getAdrVersions(String namespace, int adrId) throws NamespaceNotFoundException, AdrNotFoundException {
        verifyNamespace(namespace);
        List<String> versions = getVersions(namespace, requireFile(namespace, adrId).entry());
        return versions.isEmpty() ? List.of(CURRENT_REVISION_LABEL) : versions;
    }

    @Override
    public AdrMeta getAdrForVersion(String namespace, int adrId, String version)
            throws NamespaceNotFoundException, AdrNotFoundException, AdrRevisionNotFoundException, AdrParseException {
        verifyNamespace(namespace);
        AdrFile file = findFile(adrFiles(namespace), adrId);
        if (CURRENT_REVISION_LABEL.equals(version)) {
            return toAdrMeta(namespace, file, CURRENT_REVISION, parse(file).orElseThrow(AdrParseException::new));
        }
        String content;
        try {
            content = readAtVersion(namespace, file.entry(), version).orElseThrow(AdrRevisionNotFoundException::new);
        } catch (IOException e) {
            LOG.error("Failed to read ADR file: {}", file.entry().filePath(), e);
            throw new AdrRevisionNotFoundException();
        }
        try {
            return toAdrMeta(namespace, file, CURRENT_REVISION, mapper.fromAnyShape(content));
        } catch (AdrDocumentMapper.InvalidAdrDocumentException e) {
            throw new AdrParseException();
        }
    }

    /** The newest commit SHA, so a latest read names a version the versions list contains. */
    @Override
    public String getVersionLabel(AdrMeta latest) {
        List<AdrFile> files = adrFiles(latest.getNamespace());
        Optional<AdrFile> file = files.stream()
                .filter(candidate -> candidate.id() == latest.getId())
                .findFirst();
        if (file.isEmpty()) {
            return CURRENT_REVISION_LABEL;
        }
        List<String> versions = getVersions(latest.getNamespace(), file.get().entry());
        return versions.isEmpty() ? CURRENT_REVISION_LABEL : versions.get(versions.size() - 1);
    }

    private AdrMeta toAdrMeta(String namespace, AdrFile file, int revision, Adr adr) {
        return new AdrMeta.AdrMetaBuilder()
                .setNamespace(namespace)
                .setId(file.id())
                .setSlug(file.slug())
                .setRevision(revision)
                .setAdr(adr)
                .build();
    }

    private AdrFile requireFile(String namespace, int adrId) throws AdrNotFoundException {
        return findFile(adrFiles(namespace), adrId);
    }

    private static AdrFile findFile(List<AdrFile> files, int adrId) throws AdrNotFoundException {
        return files.stream()
                .filter(file -> file.id() == adrId)
                .findFirst()
                .orElseThrow(AdrNotFoundException::new);
    }

    private Optional<Adr> parse(AdrFile file) {
        if (file.content() == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(mapper.fromAnyShape(file.content()));
        } catch (AdrDocumentMapper.InvalidAdrDocumentException e) {
            LOG.warn("ADR file is not valid ADR JSON: {}", file.entry().filePath());
            return Optional.empty();
        }
    }

    private List<RegistryEntry> jsonEntries(String namespace) {
        return registryService.listByType(namespace, RegistryResourceType.ADR).stream()
                .filter(entry -> entry.filePath().toString().endsWith(JSON_EXTENSION))
                .toList();
    }

    /**
     * Every served ADR in the namespace with its slug, in registry (path) order. Reads each
     * file, since the slug can come from the content.
     */
    private List<AdrFile> adrFiles(String namespace) {
        Set<String> taken = new HashSet<>();
        List<AdrFile> files = new ArrayList<>();
        for (RegistryEntry entry : jsonEntries(namespace)) {
            int id = entry.uniqueId().hashCode() & 0x7FFFFFFF;
            String content = read(namespace, entry);
            String declared = content == null ? null : mapper.declaredSlug(content);
            String slug = AdrSlugs.isValid(declared) && taken.add(declared)
                    ? declared
                    : AdrSlugAllocator.allocateDerived(fileStem(entry), id, taken::add);
            files.add(new AdrFile(entry, id, slug, content));
        }
        return files;
    }

    private String read(String namespace, RegistryEntry entry) {
        try {
            return fileReader.readContained(namespace, entry.filePath());
        } catch (IOException e) {
            LOG.warn("Failed to read ADR file: {}", entry.filePath(), e);
            return null;
        }
    }

    private static String fileStem(RegistryEntry entry) {
        String fileName = entry.filePath().getFileName().toString();
        return fileName.substring(0, fileName.length() - JSON_EXTENSION.length());
    }
}
