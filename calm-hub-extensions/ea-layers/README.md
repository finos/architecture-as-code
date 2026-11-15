# Enterprise architecture layers extension of CALM Hub

The **Layers** lens on the **Diagram** tab of CALM Hub. It draws an architecture in the ArchiMate®
notation, in two views:

| View | What it shows |
|---|---|
| Layered | Each element in its business, application or technology layer. Composition and deployment are edges |
| Application cooperation | The application layer only. A container is drawn around its parts |

It is the second sample of a [diagram lens](../../docs/docs/calm-hub/extension-points.md#diagram-lens),
next to [`c4`](../c4). It shows that a lens can bring a notation that has nothing to do with C4: its
own shapes with a glyph in the corner, layer colours, and relationship ends that carry meaning. It is
also the smallest lens to copy. The service reads the architecture as plain JSON, with no CALM library.

## How CALM maps to the notation

| CALM node type | Element | Layer |
|---|---|---|
| `actor` | Business actor | Business |
| `system`, `service` | Application component | Application |
| `webclient` | Application interface | Application |
| `data-asset` | Data object | Application |
| `database` | System software | Technology |
| `ldap` | Technology service | Technology |
| `network` | Communication network | Technology |
| `ecosystem` | Grouping | None |
| Any other | Application component, marked "Type guessed" | Application |

| CALM relationship | Relationship |
|---|---|
| `connects` | Serving, from the destination to the source. Access, from the element to a data object |
| `interacts` | Serving, from each node to the actor |
| `composed-of` | Composition in the layered view. Nesting in the application cooperation view |
| `deployed-in` | Assignment, from the container to each node |

The shapes in [`notation.json`](notation.json) are our own outlines, drawn from the descriptions of the
elements. No figure of the specification is copied. To change them, edit the generator that wrote them
and keep the file valid against the notation schema of CALM Hub: the Java tests load this folder.

## Settings

The same as [`c4`](../c4/README.md#settings), with these differences:

| Variable | Default | Use |
|---|---|---|
| `PORT` | `8094` | The port |
| `CALM_EA_LAYERS_EXPORT_DIR` | not set | The folder to copy the extension files to |

The service has no mapping and follows no links: it reads only the architecture that the lens shows.

## Develop

From the repository root:

```shell
npm ci
npm run lint --workspace calm-hub-extensions/ea-layers
npm test --workspace calm-hub-extensions/ea-layers
npm run build --workspace calm-hub-extensions/ea-layers
```

ArchiMate is a registered trademark of The Open Group in the United States and other countries.
