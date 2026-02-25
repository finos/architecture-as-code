# Experimental modules and features

This folder contains experimental modules and features for CALM.

These modules and features:

- Are not considered stable
- Are subject to change or removal without notice
- Intended for testing and feedback purposes only
- Should not be used in production environments.
- May not be fully documented
- May have limited support.

Also note that some experimental features may reside in other parts of the codebase, and not necessarily in this folder.
This should only be the case for legacy experimental features that have not yet been removed/promoted, or where
separation of code is not practical.

## Feedback and acceptance process

When experimental modules or features are added to the CALM codebase, they follow a defined process to be evaluated and
then transitioned to non-experimental status, or removed.

This is to encourage:

- active ownership and development of experimental features
- a defined and recordable feedback flow
- a clean-up of abandoned experimental features

### When an experimental module or feature is added

- an Issue will be created summarising the experimental addition, guiding users on its intended usage, and inviting feedback
- the Issue will specify a defined timeframe for the Feedback Period.
- the timeframe for feedback will be a period of 3 months, measured from the first Monthly Working Group Meeting it is
  publicised at.

The Issue should be publicised at:
- a Monthly Working Group Meeting (this is the starting point for measuring the Feedback Period), ideally the first such meeting after the experimental module or feature is merged.
- the next Weekly Office Hours meeting.
- the Architecture as Code mailing list.

### During the Feedback Period

Maintainers will review feedback and potentially act on it to refine the experimental module or feature.

If the experimental module or feature is changed, a maintainer may call to extend the Feedback Period by a month, to
allow for additional feedback on the change. This call should be made at a Weekly Office Hours.

A brief reminder of the experimental module and its feedback Issue should be included at any Monthly Working Group Meetings.

### When the Feedback Period ends
When the feedback period expires a Maintainer vote should take place on the ongoing status of the experiment.

The vote will be between:

- promote the feature to non-experimental
- remove the feature from the codebase

If it is being promoted, then ideally at least two maintainers must be selected for the module. They must be documented
in the repository root's [README.md](../README.md).
