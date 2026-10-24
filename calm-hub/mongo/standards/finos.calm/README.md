# finos.calm Standards

Each subdirectory holds copies of the decorator standards of one
[finos/calm-schema](https://github.com/finos/calm-schema/tree/main/standards) release:

| Directory | calm-schema tag | File | `$id` |
|---|---|---|---|
| `deployment/` | `standard-deployment-v1.0` | `deployment.decorator.standard.json` | `https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json` |
| `deployment/` | `standard-deployment-v1.0` | `kubernetes.decorator.standard.json` | `https://calm.finos.org/standards/deployment/1.0/kubernetes.decorator.standard.json` |
| `control-evaluation/` | `standard-control-evaluation-v1.0` | `control-evaluation.decorator.standard.json` | `https://calm.finos.org/standards/control-evaluation/1.0/control-evaluation.decorator.standard.json` |

Do not edit the files here. Change the standard in calm-schema, release it, then copy the released files.

`init-nitrite.sh` (`create_standards`) seeds every subdirectory through the numeric API, because the
name-based API needs a hub `$id`. It seeds `deployment/` first, so that the deployment standard keeps standard
id 1. The name-based seed (`create_namespace_standards`) reads only the JSON files at the top of each namespace
directory, so it does not read the subdirectories.

How CALM Hub gets these standards in future is open: see [#3434](https://github.com/finos/architecture-as-code/issues/3434).
