package integration;

import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.List;

/**
 * Deliberately does NOT override {@link #getConfigProfile()} - it stays the default
 * "test" profile, so the existing {@code %test.} lines in application.properties
 * (Mongo devservices, micrometer disabled, etc.) keep applying unchanged. Introducing
 * a new named profile here would repeat the class of trap already hit twice this week
 * on the "oidc" profile ({@code %<name>.} config-expansion defaults with no fallback,
 * etc.) - this only needs calm.database.mode switched to "github" and the github-mode
 * properties set, which {@link GitHubFixtureResource#start()} supplies as plain config
 * overrides on top of the default profile.
 *
 * <p>{@link #testResources()} (rather than a class-level {@code @QuarkusTestResource}
 * annotation) is what actually scopes {@link GitHubFixtureResource} to tests using this
 * profile - a class-level annotation on the profile itself is not restricted to it the
 * same way. {@link #disableGlobalTestResources()} additionally stops OTHER modules'
 * globally-scoped resources (the Mongo and Keycloak containers other integration test
 * profiles use, neither declared with any scoping of their own) from starting
 * alongside this one - observed directly when an early version of this profile still
 * had both containers spin up for a run that only selected this profile's test class.
 */
public class IntegrationTestGithubProfile implements QuarkusTestProfile {

    @Override
    public List<TestResourceEntry> testResources() {
        return List.of(new TestResourceEntry(GitHubFixtureResource.class));
    }

    @Override
    public boolean disableGlobalTestResources() {
        return true;
    }
}
