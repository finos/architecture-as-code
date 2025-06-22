---
id: conference-website-load-balancer
title: Conference Website Load Balancer
---

## Details
<div className="table-container">
| Field               | Value                    |
|---------------------|--------------------------|
| **Unique ID**       | conference-website-load-balancer                   |
| **Description**      |  Request attendee details   |
</div>

## Related Nodes
```mermaid
graph TD;
conference-website -- Connects --> load-balancer;

```

## Controls

        ### Security

        Security Controls for the connection

            <div className="table-container">
                <table>
                    <thead>
                    <tr>
                        <th>Key</th>
                        <th>Value</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>
                            <b>$schema</b>
                        </td>
                        <td>
                            https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json
                                </td>
                    </tr>
                    <tr>
                        <td>
                            <b>Control Id</b>
                        </td>
                        <td>
                            security-002
                                </td>
                    </tr>
                    <tr>
                        <td>
                            <b>Name</b>
                        </td>
                        <td>
                            Permitted Connection
                                </td>
                    </tr>
                    <tr>
                        <td>
                            <b>Description</b>
                        </td>
                        <td>
                            Permits a connection on a relationship specified in the architecture
                                </td>
                    </tr>
                    <tr>
                        <td>
                            <b>Reason</b>
                        </td>
                        <td>
                            Required to enable flow between architecture components
                                </td>
                    </tr>
                    <tr>
                        <td>
                            <b>Protocol</b>
                        </td>
                        <td>
                            HTTP
                                </td>
                    </tr>
                    </tbody>
                </table>
            </div>


## Metadata
  _No Metadata defined._
