package org.finos.calm.store.github;

import org.finos.calm.domain.adr.AdrMeta;
import org.finos.calm.domain.adr.AdrSlugMapping;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.adr.Status;
import org.finos.calm.domain.exception.AdrNotFoundException;
import org.finos.calm.domain.exception.AdrParseException;
import org.finos.calm.domain.exception.AdrRevisionNotFoundException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestGitHubAdrStoreShould {

    private static final String NAMESPACE = "finos";
    private static final String REPO = "finos/adrs";
    private static final String BRANCH = "main";

    private static final String KEBAB_ADR = """
            {
              "title": "Use OAuth2",
              "status": "accepted",
              "decision-date": "2024-05-01",
              "context-and-problem-statement": "We need auth",
              "considered-options": [{"name": "OAuth2", "description": "Standard"}],
              "decision-outcome": {"chosen-option": "OAuth2", "rationale": "Widely used"}
            }
            """;
    private static final String CAMEL_ADR = """
            {
              "title": "Use Kafka",
              "status": "proposed",
              "contextAndProblemStatement": "We need events",
              "creationDateTime": [2024, 1, 2, 3, 4, 5]
            }
            """;
    private static final String SLUGGED_ADR = """
            {"slug": "chosen-slug", "title": "Anything", "status": "draft", "context-and-problem-statement": "x"}
            """;

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private GitHubCloneManager cloneManager;

    @Mock
    private GitHubFileHistoryClient versionService;

    @Mock
    private NamespaceFileReader fileReader;

    private GitHubAdrStore store;

    @BeforeEach
    void setup() {
        store = new GitHubAdrStore(registryService, cloneManager, versionService, fileReader);
    }

    private static RegistryEntry entry(String path) {
        String fileName = Path.of(path).getFileName().toString();
        String uniqueId = fileName.substring(0, fileName.indexOf('.'));
        return new RegistryEntry(uniqueId, Path.of(path), RegistryResourceType.ADR, uniqueId, Instant.now());
    }

    private static int idOf(RegistryEntry entry) {
        return entry.uniqueId().hashCode() & 0x7FFFFFFF;
    }

    private void namespaceHolds(Map<RegistryEntry, String> files, RegistryEntry... ordered) throws IOException {
        when(registryService.getSnapshot()).thenReturn(
                new RegistrySnapshot(Map.of(NAMESPACE, List.of(ordered)), Map.of()));
        when(registryService.listByType(NAMESPACE, RegistryResourceType.ADR)).thenReturn(List.of(ordered));
        for (Map.Entry<RegistryEntry, String> file : files.entrySet()) {
            when(fileReader.readContained(NAMESPACE, file.getKey().filePath())).thenReturn(file.getValue());
        }
    }

    private static AdrMeta meta(int id, int revision) {
        return new AdrMeta.AdrMetaBuilder().setNamespace(NAMESPACE).setId(id).setRevision(revision).build();
    }

    @Test
    void list_json_adrs_with_their_slug_title_and_status() throws Exception {
        RegistryEntry kebab = entry("adrs/0001-use-oauth2.json");
        RegistryEntry camel = entry("adrs/use-kafka.json");
        RegistryEntry markdown = entry("adrs/notes.md");
        namespaceHolds(Map.of(kebab, KEBAB_ADR, camel, CAMEL_ADR), kebab, camel, markdown);

        List<NamespaceAdrSummary> summaries = store.getAdrsForNamespace(NAMESPACE);

        assertThat(summaries, contains(
                new NamespaceAdrSummary("Use OAuth2", "accepted", idOf(kebab), "use-oauth2"),
                new NamespaceAdrSummary("Use Kafka", "proposed", idOf(camel), "use-kafka")));
        assertThat(store.countAdrsForNamespace(NAMESPACE), is(2));
    }

    @Test
    void list_placeholders_for_an_adr_file_that_cannot_be_read_or_parsed() throws Exception {
        RegistryEntry broken = entry("adrs/broken.json");
        RegistryEntry unreadable = entry("adrs/gone.json");
        namespaceHolds(Map.of(broken, "not json"), broken, unreadable);
        when(fileReader.readContained(NAMESPACE, unreadable.filePath())).thenThrow(new IOException("gone"));

        assertThat(store.getAdrsForNamespace(NAMESPACE), contains(
                new NamespaceAdrSummary("ADR " + idOf(broken), "unknown", idOf(broken), "broken"),
                new NamespaceAdrSummary("ADR " + idOf(unreadable), "unknown", idOf(unreadable), "gone")));
    }

    @Test
    void prefer_the_slug_a_file_declares_and_suffix_colliding_derived_slugs() throws Exception {
        RegistryEntry declared = entry("adrs/whatever.json");
        RegistryEntry first = entry("adrs/a/use-kafka.json");
        RegistryEntry second = entry("adrs/b/use-kafka.json");
        RegistryEntry numeric = entry("adrs/2024.json");
        namespaceHolds(Map.of(declared, SLUGGED_ADR, first, CAMEL_ADR, second, CAMEL_ADR, numeric, CAMEL_ADR),
                declared, first, second, numeric);

        List<AdrSlugMapping> slugs = store.getAdrSlugs(NAMESPACE);

        assertThat(slugs.stream().map(AdrSlugMapping::slug).toList(),
                contains("chosen-slug", "use-kafka", "use-kafka-2", "adr-" + idOf(numeric)));
    }

    @Test
    void resolve_an_adr_by_slug_and_by_numeric_id() throws Exception {
        RegistryEntry kebab = entry("adrs/0001-use-oauth2.json");
        namespaceHolds(Map.of(kebab, KEBAB_ADR), kebab);

        int id = store.getAdrIdBySlug(NAMESPACE, "use-oauth2");
        AdrMeta adr = store.getAdr(meta(id, 0));

        assertThat(id, is(idOf(kebab)));
        assertThat(adr.getSlug(), is("use-oauth2"));
        assertThat(adr.getRevision(), is(1));
        assertThat(adr.getAdr().getTitle(), is("Use OAuth2"));
        assertThat(adr.getAdr().getStatus(), is(Status.accepted));
        assertThat(adr.getAdr().getDecisionDate(), is(LocalDate.of(2024, 5, 1)));
        assertThat(adr.getAdr().getDecisionOutcome().getChosenOption().getDescription(), is("Standard"));
        assertThat(store.getAdrRevisions(meta(id, 0)), contains(1));
        assertThat(store.getAdrRevision(meta(id, 1)).getAdr().getTitle(), is("Use OAuth2"));
    }

    @Test
    void throw_not_found_for_an_unknown_slug_or_id() throws Exception {
        RegistryEntry kebab = entry("adrs/use-oauth2.json");
        namespaceHolds(Map.of(kebab, KEBAB_ADR), kebab);

        assertThrows(AdrNotFoundException.class, () -> store.getAdrIdBySlug(NAMESPACE, "missing"));
        assertThrows(AdrNotFoundException.class, () -> store.getAdr(meta(1, 0)));
        assertThrows(AdrNotFoundException.class, () -> store.getAdrRevisions(meta(1, 0)));
        assertThrows(AdrNotFoundException.class, () -> store.getAdrVersions(NAMESPACE, 1));
    }

    @Test
    void throw_revision_not_found_for_any_revision_but_the_current_one() throws Exception {
        RegistryEntry kebab = entry("adrs/use-oauth2.json");
        namespaceHolds(Map.of(kebab, KEBAB_ADR), kebab);

        assertThrows(AdrRevisionNotFoundException.class, () -> store.getAdrRevision(meta(idOf(kebab), 2)));
    }

    @Test
    void throw_a_parse_exception_when_the_file_is_not_an_adr() throws Exception {
        RegistryEntry broken = entry("adrs/broken.json");
        namespaceHolds(Map.of(broken, "[]"), broken);

        assertThrows(AdrParseException.class, () -> store.getAdr(meta(idOf(broken), 0)));
        assertThrows(AdrParseException.class, () -> store.getAdrForVersion(NAMESPACE, idOf(broken), "1"));
    }

    @Test
    void list_commit_shas_as_versions_and_label_the_latest_with_the_newest() throws Exception {
        RegistryEntry kebab = entry("adrs/use-oauth2.json");
        namespaceHolds(Map.of(kebab, KEBAB_ADR), kebab);
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn(REPO);
        when(cloneManager.getBranchForNamespace(NAMESPACE)).thenReturn(BRANCH);
        when(versionService.getFileVersions(REPO, BRANCH, kebab.filePath().toString()))
                .thenReturn(List.of("aaaaaaa", "bbbbbbb"));

        assertThat(store.getAdrVersions(NAMESPACE, idOf(kebab)), contains("aaaaaaa", "bbbbbbb"));
        assertThat(store.getVersionLabel(meta(idOf(kebab), 1)), is("bbbbbbb"));
    }

    @Test
    void fall_back_to_revision_one_when_no_version_history_is_available() throws Exception {
        RegistryEntry kebab = entry("adrs/use-oauth2.json");
        namespaceHolds(Map.of(kebab, KEBAB_ADR), kebab);

        assertThat(store.getAdrVersions(NAMESPACE, idOf(kebab)), contains("1"));
        assertThat(store.getVersionLabel(meta(idOf(kebab), 1)), is("1"));
        assertThat(store.getVersionLabel(meta(12345, 1)), is("1"));
    }

    @Test
    void read_an_adr_at_a_commit_sha() throws Exception {
        RegistryEntry kebab = entry("adrs/use-oauth2.json");
        namespaceHolds(Map.of(kebab, KEBAB_ADR), kebab);
        when(cloneManager.headSha(NAMESPACE)).thenReturn("ccccccc");
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn(REPO);
        when(versionService.getFileAtVersion(REPO, kebab.filePath().toString(), "aaaaaaa")).thenReturn(CAMEL_ADR);

        AdrMeta atSha = store.getAdrForVersion(NAMESPACE, idOf(kebab), "aaaaaaa");
        AdrMeta current = store.getAdrForVersion(NAMESPACE, idOf(kebab), "1");

        assertThat(atSha.getAdr().getTitle(), is("Use Kafka"));
        assertThat(atSha.getSlug(), is("use-oauth2"));
        assertThat(current.getAdr().getTitle(), is("Use OAuth2"));
    }

    @Test
    void throw_revision_not_found_for_an_unknown_or_unreadable_version() throws Exception {
        RegistryEntry kebab = entry("adrs/use-oauth2.json");
        namespaceHolds(Map.of(kebab, KEBAB_ADR), kebab);
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn(REPO);
        when(cloneManager.headSha(NAMESPACE)).thenReturn("ccccccc");

        assertThrows(AdrRevisionNotFoundException.class,
                () -> store.getAdrForVersion(NAMESPACE, idOf(kebab), "2"));
        assertThrows(AdrRevisionNotFoundException.class,
                () -> store.getAdrForVersion(NAMESPACE, idOf(kebab), "aaaaaaa"));

        when(fileReader.readContained(NAMESPACE, kebab.filePath()))
                .thenReturn(KEBAB_ADR).thenThrow(new IOException("gone"));
        assertThrows(AdrRevisionNotFoundException.class,
                () -> store.getAdrForVersion(NAMESPACE, idOf(kebab), "ccccccc"));
    }

    @Test
    void throw_a_parse_exception_when_a_version_is_not_an_adr() throws Exception {
        RegistryEntry kebab = entry("adrs/use-oauth2.json");
        namespaceHolds(Map.of(kebab, KEBAB_ADR), kebab);
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn(REPO);
        when(versionService.getFileAtVersion(anyString(), anyString(), any())).thenReturn("42");

        assertThrows(AdrParseException.class, () -> store.getAdrForVersion(NAMESPACE, idOf(kebab), "aaaaaaa"));
    }

    @Test
    void throw_namespace_not_found_for_an_unknown_namespace() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class, () -> store.getAdrsForNamespace("nonexistent"));
        assertThrows(NamespaceNotFoundException.class, () -> store.countAdrsForNamespace("nonexistent"));
        assertThrows(NamespaceNotFoundException.class, () -> store.getAdrSlugs("nonexistent"));
        assertThrows(NamespaceNotFoundException.class, () -> store.getAdrIdBySlug("nonexistent", "a"));
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getAdr(new AdrMeta.AdrMetaBuilder().setNamespace("nonexistent").build()));
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getAdrRevisions(new AdrMeta.AdrMetaBuilder().setNamespace("nonexistent").build()));
        assertThrows(NamespaceNotFoundException.class, () -> store.getAdrVersions("nonexistent", 1));
        assertThrows(NamespaceNotFoundException.class, () -> store.getAdrForVersion("nonexistent", 1, "1"));
    }

    @Test
    void return_nothing_for_a_namespace_with_no_adrs() throws Exception {
        namespaceHolds(Map.of());

        assertThat(store.getAdrsForNamespace(NAMESPACE), is(empty()));
        assertThat(store.countAdrsForNamespace(NAMESPACE), equalTo(0));
    }

    @Test
    void throw_write_not_supported_on_every_write() {
        AdrMeta adrMeta = meta(1, 1);
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.createAdrForNamespace(adrMeta));
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.updateAdrForNamespace(adrMeta));
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.createAdrRevision(adrMeta));
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.updateAdrStatus(adrMeta, Status.accepted));
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.deleteAdr(NAMESPACE, 1));
    }
}
