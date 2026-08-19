package org.finos.calm.store.github.util;

import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.finos.calm.domain.exception.PendingWriteException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Orchestrates the fork-based write flow:
 * 1. Ensure user's fork exists (create if not)
 * 2. Sync fork to upstream HEAD
 * 3. Create branch on fork
 * 4. Commit file to branch
 * 5. Open cross-repo PR: user/fork:branch -> upstream:main
 *
 * Requires: user's GitHub token (from session cookie) and the upstream repo details.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "github")
@ApplicationScoped
public class GitHubForkPRService {

    private static final Logger LOG = LoggerFactory.getLogger(GitHubForkPRService.class);

    /**
     * Creates a PR for the given content change.
     *
     * @param userGhToken  the user's GitHub OAuth token
     * @param upstreamRepo the upstream repo (e.g. "finos/architecture-as-code")
     * @param branch       the upstream branch (e.g. "main")
     * @param filePath     the file path within the repo (e.g. "patterns/event-driven.json")
     * @param content      the JSON content to write
     * @param commitMessage the commit message
     * @return never — always throws PendingWriteException on success
     * @throws PendingWriteException on successful PR creation (contains PR URL)
     * @throws IllegalStateException if the GitHub API calls fail
     */
    public void createPullRequest(String userGhToken, String upstreamRepo, String branch,
                                  String filePath, String content, String commitMessage)
            throws PendingWriteException {
        // Full implementation will:
        // 1. GET /repos/{upstream}/forks filtered by user -> find or create fork
        // 2. POST /repos/{user}/{repo}/merge-upstream -> sync fork
        // 3. POST /repos/{user}/{repo}/git/refs -> create branch
        // 4. PUT /repos/{user}/{repo}/contents/{path} -> commit file
        // 5. POST /repos/{upstream}/pulls -> open cross-repo PR

        // Placeholder — will be implemented when GitHub OAuth token exchange is complete
        throw new GitHubWriteNotSupportedException(
                "PR creation requires GitHub account linking. This will be enabled when the full OAuth flow is wired.");
    }
}
