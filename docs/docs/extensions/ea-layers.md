---
id: ea-layers
title: Enterprise Architecture Layers
sidebar_label: Enterprise architecture layers
---

# Enterprise Architecture Layers

Adds the **Layers** lens to the **Diagram** tab of CALM Hub. Provided by FINOS CALM. See
[Install an extension](install.md).

The lens draws an architecture in the ArchiMate® notation, for enterprise architects who use it. You do
not change your architecture: the lens maps each CALM node type and relationship to the notation.

## The views

Select a view at the top of the lens. The view is in the URL, for example `?lens=layers&view=application`.

| View | Shows |
|:--|:--|
| Layered | Each element in its business, application or technology layer. Composition and deployment are edges |
| Application cooperation | The application elements, and the containers around them, except technology containers. A container is drawn around its parts |

![The layered view of the Conference Signup architecture, with the notes panel](/img/extensions/layers-layered.png)

![The application cooperation view of TraderX](/img/extensions/layers-application-cooperation.png)

## How CALM maps to the notation

| CALM node type | Element | Layer |
|:--|:--|:--|
| `actor` | Business actor | Business |
| `system`, `service` | Application component | Application |
| `webclient` | Application interface | Application |
| `data-asset` | Data object | Application |
| `database` | System software | Technology |
| `ldap` | Technology service | Technology |
| `network` | Communication network | Technology |
| `ecosystem` | Grouping | None |
| Any other | Application component, marked **Type guessed** | Application |

| CALM relationship | Relationship |
|:--|:--|
| `connects` | Serving, from the destination to the source. Access, from the element to a data object |
| `interacts` | Serving, from each node to the actor |
| `composed-of` | Composition in the layered view. Nesting in the application cooperation view |
| `deployed-in` | Assignment, from the container to each node |

A serving relationship points from the provider to the element that uses it, as the notation draws it.
Thus it points against the CALM `connects` relationship.

## Read the diagram

- **Key:** lists the elements and relationships on the diagram.
- **Notes:** lists the node types that the lens does not know, and how it maps each node type of the
  architecture. **Hide** closes the panel.
- **Type guessed:** the lens does not know the node type of this element, so it draws an application
  component.

## Decorators

The lens shows the [decorator overlays](../working-with-calm/calm-hub.md#overlays-on-an-extension-lens)
of the architecture, such as deployments and control evaluations.

| Element | Shows the decorators of |
|:--|:--|
| Element, or the container around its parts | Its CALM node. A container also shows those of its `composed-of` and `deployed-in` relationships |
| Serving or access relationship | Its CALM `connects` or `interacts` relationship. It shows a badge only when the relationship has an error or a warning |
| Composition or assignment relationship | None. They show on the container |
| Layer | None. It is not a CALM node |

The application cooperation view does not draw all of the architecture: a database, for example, is
not on it. When nothing on the diagram stands for a decorated CALM node or relationship, the lens
shows no badge for it, and says on the diagram that it is not shown. A decorator of a
`composed-of` or `deployed-in` relationship counts as a decorator of the container. Thus it shows when
the diagram draws the container, also when the diagram does not draw the parts.

## Settings

| | |
|:--|:--|
| Port | `8094` |
| Export folder variable | `CALM_EA_LAYERS_EXPORT_DIR` |
| CALM Hub sends | The architecture only (`hubData`) |
| Source | [`calm-hub-extensions/ea-layers`](https://github.com/finos/architecture-as-code/tree/main/calm-hub-extensions/ea-layers) |

The [README](https://github.com/finos/architecture-as-code/tree/main/calm-hub-extensions/ea-layers#settings)
lists all the settings of the service. They are the same as for the C4 extension, except that Layers
has no `CALM_C4_MAPPING_HOSTS`.

ArchiMate is a registered trademark of The Open Group in the United States and other countries.
