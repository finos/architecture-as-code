---
name: 👥 Maintainer Update
about: Propose adding a new maintainer or removing an existing maintainer
---

## Maintainer Update Proposal

### Type of Update:

<!-- Select one by placing an 'x' in the brackets -->

- [ ] **Add New Maintainer** - Proposing to add a new maintainer to the project
- [ ] **Remove Maintainer** - Proposing to remove an existing maintainer from the project

---

### Maintainer Details:

**Name:** <!-- Full name of the maintainer -->

**GitHub Handle:** @<!-- GitHub username -->

**Component/Module:** <!-- Which component(s) will they maintain (e.g., CALM Hub UI, CLI, Shared, etc.) or "All" -->

---

## For New Maintainer Additions

<!-- Complete this section if proposing to ADD a new maintainer -->

### Contribution History:

...describe the substantial contributions this person has made to the project, including:

- Number and significance of pull requests merged
- Participation in issue discussions and reviews
- Documentation contributions
- Community engagement (Office Hours, meetings, etc.)
- Any other relevant contributions

### Why This Person Should Be a Maintainer:

...explain why this person is qualified and why their maintainer status would benefit the project...

### Links to Contributions:

<!-- Provide links to key PRs, issues, or other contributions -->

- PR:
- Issue:
- Other:

---

## For Maintainer Removals

<!-- Complete this section if proposing to REMOVE a maintainer -->

### Reason for Removal:

<!-- Select one by placing an 'x' in the brackets -->

- [ ] **Voluntary** - The maintainer has requested to be removed
- [ ] **Inactivity** - The maintainer has been inactive (see criteria below)

### Rationale:

...provide clear reasoning for the removal proposal:

**For Voluntary Removals:**
- State that the maintainer has requested to step down
- Include any relevant context they've provided (optional)

**For Inactivity Removals:**
- Confirm the maintainer has had no commits AND no involvement in issues/PRs for **3+ months**
- Specify the period of inactivity (e.g., "no activity since [DATE]")
- Note: This removal proposal does NOT reflect negatively on the individual, but rather acknowledges changes in their ability to contribute
- Explain why having the README.md reflect active maintainers is important for the project

### Notice Period:

<!-- For inactivity removals only -->

**Issue Created:** <!-- Date this issue was created -->

**Notice Period Ends:** <!-- Date 4 weeks from creation -->

**Vote May Proceed After:** <!-- Same as notice period end date -->

### Maintainer Notification:

<!-- For inactivity removals only - confirm the maintainer has been notified -->

- [ ] Maintainer tagged in this issue
- [ ] Maintainer contacted via email (if contact info available)
- [ ] Other notification methods used (specify):

---

## Voting Process

As per [Governance.md](https://github.com/finos/architecture-as-code/blob/main/Governance.md):

- All members of **@finos/architecture-as-code-maintainers** are eligible to participate
- Please register your vote by commenting with:
  - `+1` to approve the proposal
  - `-1` to reject the proposal
  - `+0` to abstain

**For New Maintainer Additions:**
- The nomination MUST receive a majority of votes to be approved
- All discussion and voting will take place publicly in the comments on this issue

**For Voluntary Removals:**
- No vote is required; Maintainers should acknowledge and proceed with removal

**For Inactivity Removals:**
- A minimum **4-week notice period** MUST be observed before voting
- If the maintainer responds or resumes activity during the notice period, this issue SHOULD be closed without a vote
- After the notice period, a vote will be held if the maintainer has not responded or resumed activity

**Voting Period:**

Unless consensus is reached earlier, this issue will remain open for voting and will be closed **on or after [DATE - typically 1 week after notice period for removals, or 1-2 weeks for additions]**, at which point the outcome will be recorded.

---

## Implementation Checklist

<!-- To be completed by the Lead Maintainer or designated Maintainer after approval -->

**For Additions:**
- [ ] Add maintainer to the GitHub team: `@finos/architecture-as-code-maintainers`
- [ ] Update `README.md` to list the new maintainer
- [ ] Update `.github/CODEOWNERS` if they will be owning specific components
- [ ] Welcome the new maintainer in the project channels

**For Removals:**
- [ ] Remove maintainer from the GitHub team: `@finos/architecture-as-code-maintainers`
- [ ] Update `README.md` to remove the maintainer from the list
- [ ] Update `.github/CODEOWNERS` to reassign their owned components
- [ ] Thank the maintainer for their contributions in the project channels (if appropriate)

---

## Additional Context

...add any other relevant context, history, or information about this proposal...
