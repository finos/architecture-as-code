# Enterprise architecture layers extension of CALM Hub

The **Layers** lens on the **Diagram** tab of CALM Hub. It draws an architecture in the ArchiMate®
notation, in two views:

| View | What it shows |
|---|---|
| Layered | Each element in its business, application or technology layer. Composition and deployment are edges |
| Application cooperation | The application elements, and the containers around them, except technology containers. A container is drawn around its parts |

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

## Decorators

Hub draws decorator badges on the diagram from the `calm` ids of each element (see
[Decorator views](../../docs/docs/calm-hub/decorator-views.md#how-hub-draws-a-view)):

| Element | `calm` ids | Decorators that show on it |
|---|---|---|
| Element, or the container group of the application cooperation view | The CALM node | Those of the node, and of its `composed-of` and `deployed-in` relationships |
| Serving or access relationship | The CALM `connects` or `interacts` relationship | Those of the relationship. Hub draws a badge only when one of them is `error` or `warn` |
| Composition or assignment relationship | The CALM `composed-of` or `deployed-in` relationship | None. Hub shows them on the container |
| Layer | None | None. It is not a CALM node |

The application cooperation view does not draw all of the architecture. When no node, group or edge of the
reply names a decorated CALM id, such as the id of a database, Hub shows no badge for it and says that it is
not shown. Hub counts a decorator of a `composed-of` or `deployed-in` relationship as a decorator of the
container. Thus it shows when the view draws the container, also when the view does not draw the parts.

## Settings

The same as [`c4`](../c4/README.md#settings), with these differences:

| Variable | Default | Use |
|---|---|---|
| `PORT` | `8094` | The port |
| `CALM_EA_LAYERS_EXPORT_DIR` | not set | The folder to copy the extension files to |

The route asks only for `"hubData": ["document"]`: CALM Hub sends the architecture that the lens shows,
and the service follows no links. It has no `CALM_C4_MAPPING_HOSTS`.

## Develop

From the repository root:

```shell
npm ci
npm run lint --workspace calm-hub-extensions/ea-layers
npm test --workspace calm-hub-extensions/ea-layers
npm run build --workspace calm-hub-extensions/ea-layers
```

ArchiMate is a registered trademark of The Open Group in the United States and other countries.
