# finos.calm Standards

`deployment/` holds copies of the deployment decorator standards that
[finos/calm-schema](https://github.com/finos/calm-schema/tree/standard-deployment-v1.0/standards/deployment)
releases, from the tag `standard-deployment-v1.0`:

| File | `$id` |
|---|---|
| `deployment.decorator.standard.json` | `https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json` |
| `kubernetes.decorator.standard.json` | `https://calm.finos.org/standards/deployment/1.0/kubernetes.decorator.standard.json` |

Do not edit the files here. Change the standard in calm-schema, release it, then copy the released files.

`init-nitrite.sh` (`create_standards`) seeds them through the numeric API, because the name-based API needs a
hub `$id`. The name-based seed (`create_namespace_standards`) reads only the JSON files at the top of each
namespace directory, so it does not read `deployment/`.

How CALM Hub gets these standards in future is open: see [#3434](https://github.com/finos/architecture-as-code/issues/3434).
