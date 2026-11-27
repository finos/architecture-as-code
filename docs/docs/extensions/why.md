---
id: why
title: Why Build an Extension
sidebar_label: Why build an extension
---

# Why Build an Extension

CALM Hub stores each architecture as CALM, one model that all teams share. Each organisation also has
its own notations, tools and processes. An extension connects them to CALM Hub, without a fork. The
architecture stays the single source, and each team sees it in the form that it uses.

## What you can add

| You want to | Extension point | For example |
|:--|:--|:--|
| Show an architecture in your notation | [`diagram-lens`](../calm-hub/extension-points.md#diagram-lens) | The [C4](c4.md) and [ArchiMate® layers](ea-layers.md) lenses |
| Show the results of your tools on the diagram | [`decorator-views`](../calm-hub/extension-points.md#decorator-views) | Control results, deployment status, security scan results |
| Show facts about an architecture or a node | [`designer-tab`](../calm-hub/extension-points.md#designer-tab), [`detail-panel`](../calm-hub/extension-points.md#detail-panel) | The owner from your CMDB, open incidents, cost |
| Start a process from an architecture | [`action`](../calm-hub/extension-points.md#action) | Request a design review, open a ticket |
| Get input from a user | [`form`](../calm-hub/extension-points.md#form) | Log a release, request a review of a node |
| Add a page or a card on the home page | [`screen`](../calm-hub/extension-points.md#screen), [`landing-card`](../calm-hub/extension-points.md#landing-card) | A release calendar |
| Show your records on the search page | [`search-provider`](../calm-hub/extension-points.md#search-provider) | Releases, tickets, entries of your service catalogue |
| Add a chat with an assistant | [`chat`](../calm-hub/extension-points.md#chat) | Answers about your architectures, with links to the sources |
| Let the CLI and AI assistants use it | [`commands`](../calm-hub/extension-points.md#commands) | `calm hub ext <id> <command>`, and an MCP tool for each command |

One extension can use many extension points. The
[release-tracker tutorial](../tutorials/advanced/hub-extension.md) uses `screen`, `designer-tab`, `landing-card`,
`detail-panel`, `action`, `form`, `decorator-views` and `commands`.

## Why not a fork

| | A fork of CALM Hub | An extension |
|:--|:--|:--|
| CALM Hub updates | You merge each release into your fork | You update CALM Hub. The extension does not change |
| Your release schedule | Tied to CALM Hub | Your own |
| Language | Java and React | Any language that serves HTTP |
| Your data | In CALM Hub | In your service. Your architectures can stay in your network |
| Share it | Hard to share | Other organisations install it. You can [list it](/extensions) |

## What CALM Hub does for you

An extension is an HTTP service and a manifest. CALM Hub does the work that each extension needs, so
the service can stay small:

- **Access.** CALM Hub signs the user in and checks the scope of each route before it calls the
  service. See [Extension access](../calm-hub/extension-access.md).
- **Data.** CALM Hub can read the architecture, with the rights of the user, and send it in the call.
  The service then needs no account in CALM Hub and no route back to it.
- **Identity.** CALM Hub signs a short assertion of who asked, so the service can trust the call.
- **UI.** The service returns data, and CALM Hub draws it with its own components. No extension code
  runs in the browser, so an extension cannot read the token of the user or change the page.
- **Audit and limits.** CALM Hub records each call that is not read-only, and limits the size and the
  time of each call.

## When to use something else

| You want to | Use |
|:--|:--|
| Change what CALM can describe | A change to the [CALM schema](https://github.com/finos/calm-schema) |
| Require properties on your nodes or relationships | A [standard](../core-concepts/standards.md) |
| Require a structure for a type of architecture | A [pattern](../core-concepts/patterns.md) |
| Make a document or a website from an architecture | [Docify](../tutorials/intermediate/11-docify.md) and [widgets](../tutorials/intermediate/12-calm-widgets.md) |

## Next steps

- Follow the [extension tutorial](../tutorials/advanced/hub-extension.md).
- Read the [extension point reference](../calm-hub/extension-points.md).
- Copy a [sample extension](https://github.com/finos/architecture-as-code/tree/main/calm-hub-extensions).

ArchiMate is a registered trademark of The Open Group in the United States and other countries.
