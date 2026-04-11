<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Security Policy

## Reporting a Vulnerability

CalmStudio takes security seriously. If you discover a security vulnerability,
please report it responsibly through **GitHub Security Advisories**.

### How to Report

1. Go to the [Security Advisories page](https://github.com/finos/calmstudio/security/advisories)
2. Click **"Report a vulnerability"**
3. Fill in the details of the vulnerability

**Do NOT** open a public GitHub issue for security vulnerabilities.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

| Action | Timeline |
|--------|----------|
| Acknowledgment of report | Within 3 business days |
| Initial assessment | Within 7 business days |
| Fix development | Within 30 days for critical, 60 days for others |
| Public disclosure | 90 days after report (coordinated disclosure) |

We follow a **90-day coordinated disclosure** policy. If a fix is available
before the 90-day deadline, we will disclose at the time of the fix release.
If no fix is ready after 90 days, we will work with the reporter on an
appropriate disclosure timeline.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Previous minor | Security fixes only |
| Older versions | No |

## Security Best Practices

When contributing to CalmStudio:

- Never commit secrets, API keys, or credentials
- Keep dependencies up to date (Dependabot is enabled)
- Follow the principle of least privilege in code
- Validate all user input at system boundaries
- Use parameterized queries for any data operations

## FINOS Security

CalmStudio is developed under the [FINOS](https://finos.org) umbrella.
For FINOS-wide security concerns, contact [security@finos.org](mailto:security@finos.org).
