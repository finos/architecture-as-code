package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.util.DecoratorJson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * GitHub-mode {@link DecoratorStore}: decorators are read from the {@code .json} files in the
 * namespace's clone that {@link org.finos.calm.store.github.registry.CalmContentDetector}
 * classifies as {@link RegistryResourceType#DECORATOR} - a file whose {@code $schema} names a
 * decorator, or any JSON file under a {@code decorators/} folder. Each file holds one decorator
 * object, and its id is derived from {@code unique-id}, like every other GitHub-mode store.
 *
 * <p>A decorator is read from the working tree of the clone (the current commit), so it has no
 * version of its own: its history is the one current entry. A file that does not parse as a
 * decorator is skipped with a warning rather than failing the whole list.</p>
 *
 * <p>A {@code target} is matched on the architecture it names, not on its spelling or version, so
 * a decorator keeps matching as commits change the version SHAs. These all name the architecture
 * {@code voice}: {@code /api/calm/namespaces/ns/architectures/voice/versions/1.0.0}, the same
 * path with the numeric id the UI sends (derived from the architecture's {@code unique-id}), the
 * path without a version, and the repo-relative path of the architecture file. Any other target
 * must match exactly.</p>
 *
 * <p>Every mutating method throws {@link GitHubWriteNotSupportedException}: this backend is
 * read-only, so decorators are changed by committing to the repository.</p>
 */
@ApplicationScoped
@Typed(GitHubDecoratorStore.class)
public class GitHubDecoratorStore extends AbstractGitHubStore implements DecoratorStore {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubDecoratorStore.class);

    // .../architectures/<id>[/versions/<version>]
    private static final Pattern ARCHITECTURE_TARGET =
            Pattern.compile("^.*/architectures/([^/]+)(?:/versions/[^/]+)?$");

    private static final String ARCHITECTURE_IDENTITY = "architecture:";

    private final NamespaceFileReader fileReader;

    @Inject
    public GitHubDecoratorStore(ResourceRegistry registryService, NamespaceFileReader fileReader) {
        super(registryService);
        this.fileReader = fileReader;
    }

    /** CDI proxy constructor only - see {@link AbstractGitHubStore#AbstractGitHubStore()}. */
    GitHubDecoratorStore() {
        super();
        this.fileReader = null;
    }

    @Override
    public void requireWritable() {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        UnaryOperator<String> identity = targetIdentity(namespace);
        return load(namespace).stream()
                .filter(l -> matches(l.decorator(), target, type, identity))
                .map(LoadedDecorator::id)
                .toList();
    }

    @Override
    public List<Decorator> getDecoratorValuesForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        UnaryOperator<String> identity = targetIdentity(namespace);
        return load(namespace).stream()
                .map(LoadedDecorator::decorator)
                .filter(d -> matches(d, target, type, identity))
                .toList();
    }

    @Override
    public Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException {
        verifyNamespace(namespace);
        return registryService.listByType(namespace, RegistryResourceType.DECORATOR).stream()
                .filter(e -> idOf(e) == id)
                .findFirst()
                .flatMap(e -> read(namespace, e))
                .map(LoadedDecorator::decorator);
    }

    @Override
    public int createDecorator(String namespace, String decoratorJson) throws NamespaceNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public void updateDecorator(String namespace, int id, String decoratorJson) throws NamespaceNotFoundException, DecoratorNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public int supersedeDecorator(String namespace, int id, String decoratorJson) throws NamespaceNotFoundException, DecoratorNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    @Override
    public List<DecoratorHistoryEntry> getDecoratorHistory(String namespace, int id) throws NamespaceNotFoundException, DecoratorNotFoundException {
        Decorator decorator = getDecoratorById(namespace, id).orElseThrow(DecoratorNotFoundException::new);
        return List.of(new DecoratorHistoryEntry(id, null, null, decorator));
    }

    @Override
    public void deleteCurrentDecoratorHistory(String namespace, int currentId) throws NamespaceNotFoundException, DecoratorNotFoundException {
        throw new GitHubWriteNotSupportedException(WRITE_UNSUPPORTED);
    }

    private List<LoadedDecorator> load(String namespace) {
        return registryService.listByType(namespace, RegistryResourceType.DECORATOR).stream()
                .map(e -> read(namespace, e))
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<LoadedDecorator> read(String namespace, RegistryEntry entry) {
        try {
            Decorator decorator = Decorator.fromDocument(
                    DecoratorJson.parseObject(fileReader.readContained(namespace, entry.filePath())));
            return Optional.ofNullable(decorator).map(d -> new LoadedDecorator(idOf(entry), d));
        } catch (IOException | RuntimeException e) {
            LOG.warn("Skipping decorator file {} in namespace {}: {}", entry.filePath(), namespace, e.getMessage());
            return Optional.empty();
        }
    }

    private static int idOf(RegistryEntry entry) {
        return entry.uniqueId().hashCode() & 0x7FFFFFFF;
    }

    private static boolean matches(Decorator decorator, String target, String type, UnaryOperator<String> identity) {
        return matchesType(decorator, type) && matchesTarget(decorator, target, identity);
    }

    private static boolean matchesType(Decorator decorator, String type) {
        return type == null || type.isEmpty() || type.equals(decorator.getType());
    }

    private static boolean matchesTarget(Decorator decorator, String target, UnaryOperator<String> identity) {
        if (target == null || target.isEmpty()) {
            return true;
        }
        List<String> targets = decorator.getTarget();
        if (targets == null) {
            return false;
        }
        String wanted = identity.apply(target);
        return targets.stream().anyMatch(t -> t.equals(target) || identity.apply(t).equals(wanted));
    }

    /**
     * Maps a target to the architecture it names, as {@code architecture:<unique-id>}: from an
     * architecture path (by unique-id, or by the numeric id derived from it) or from the
     * repo-relative path of an architecture file. Any other target maps to itself.
     */
    private UnaryOperator<String> targetIdentity(String namespace) {
        List<RegistryEntry> architectures = registryService.listByType(namespace, RegistryResourceType.ARCHITECTURE);
        return target -> {
            Matcher matcher = ARCHITECTURE_TARGET.matcher(target);
            if (matcher.matches()) {
                String segment = matcher.group(1);
                return ARCHITECTURE_IDENTITY + architectures.stream()
                        .filter(e -> e.uniqueId().equals(segment) || String.valueOf(idOf(e)).equals(segment))
                        .map(RegistryEntry::uniqueId)
                        .findFirst()
                        .orElse(segment);
            }
            return architectures.stream()
                    .filter(e -> e.filePath().toString().equals(target))
                    .map(e -> ARCHITECTURE_IDENTITY + e.uniqueId())
                    .findFirst()
                    .orElse(target);
        };
    }

    private record LoadedDecorator(int id, Decorator decorator) {
    }
}
