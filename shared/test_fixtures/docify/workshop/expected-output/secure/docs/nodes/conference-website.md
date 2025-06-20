---
id: conference-website
title: Conference Website
---

## Details
<div className="table-container">
| Field               | Value                    |
|---------------------|--------------------------|
| **Unique ID**       | conference-website                   |
| **Node Type**       | webclient             |
| **Name**            | Conference Website                 |
| **Description**     | Website to sign up for a conference          |
| **Data Classification** |  |
| **Run As**          |                 |
</div>

## Interfaces
    | Unique ID | Host | Port | Url |
    |-----------|------|------|-----|
        | conference-website-url |  |  | https://calm.finos.org/amazing-website |


## Related Nodes
```mermaid
graph TD;
conference-website[conference-website]:::highlight;
conference-website -- Connects --> load-balancer;
classDef highlight fill:#f2bbae;

```
## Controls
    _No controls defined._

## Metadata
  _No Metadata defined._
