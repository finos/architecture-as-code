package org.finos.calm.domain.exception;

/**
 * Thrown by GitHub stores when a write operation successfully creates a PR.
 * The resource layer catches this and returns 202 Accepted with the PR URL.
 * This is NOT an error — it signals that the write was accepted asynchronously.
 */
public class PendingWriteException extends Exception {

    private final String pullRequestUrl;
    private final int pullRequestNumber;
    private final String branch;

    public PendingWriteException(String pullRequestUrl, int pullRequestNumber, String branch) {
        super("Change submitted as PR #" + pullRequestNumber);
        this.pullRequestUrl = pullRequestUrl;
        this.pullRequestNumber = pullRequestNumber;
        this.branch = branch;
    }

    public String getPullRequestUrl() {
        return pullRequestUrl;
    }

    public int getPullRequestNumber() {
        return pullRequestNumber;
    }

    public String getBranch() {
        return branch;
    }
}
