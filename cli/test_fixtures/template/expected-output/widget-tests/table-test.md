---
architecture: ../../../getting-started/STEP-3/conference-signup-with-flow.arch.json
url-to-local-file-mapping: ../../../getting-started/url-to-local-file-mapping.json
---
### Table of Nodes (Flat)

<div class="table-container">
    <table>
        <thead>
        <tr>
            <th>Node Type</th>
            <th>Description</th>
        </tr>
        </thead>
        <tbody>
        <tr>
            <td>webclient</td>
            <td>Website to sign up for a conference</td>
        </tr>
        <tr>
            <td>network</td>
            <td>The attendees service, or a placeholder for another application</td>
        </tr>
        <tr>
            <td>service</td>
            <td>The attendees service, or a placeholder for another application</td>
        </tr>
        <tr>
            <td>database</td>
            <td>Persistent storage for attendees</td>
        </tr>
        <tr>
            <td>system</td>
            <td>Kubernetes Cluster with network policy rules enabled</td>
        </tr>
        </tbody>
    </table>
</div>

### Table of Nodes (Nested)

<div class="table-container">
    <table>
        <thead>
        <tr>
            <th>Key</th>
            <th>Value</th>
        </tr>
        </thead>
        <tbody>
        <tr>
            <td><b>Conference Website</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                conference-website
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Node Type</b></td>
                            <td>
                                webclient
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Name</b></td>
                            <td>
                                Conference Website
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Description</b></td>
                            <td>
                                Website to sign up for a conference
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Interfaces</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Unique Id</b></td>
                                            <td>
                                                conference-website-url
                                                    </td>
                                        </tr>
                                        <tr>
                                            <td><b>Url</b></td>
                                            <td>
                                                [[ URL ]]
                                                    </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Load Balancer</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                load-balancer
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Node Type</b></td>
                            <td>
                                network
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Name</b></td>
                            <td>
                                Load Balancer
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Description</b></td>
                            <td>
                                The attendees service, or a placeholder for another application
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Interfaces</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Unique Id</b></td>
                                            <td>
                                                load-balancer-host-port
                                                    </td>
                                        </tr>
                                        <tr>
                                            <td><b>Host</b></td>
                                            <td>
                                                [[ HOST ]]
                                                    </td>
                                        </tr>
                                        <tr>
                                            <td><b>Port</b></td>
                                            <td>
                                                -1
                                                    </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Attendees</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                attendees
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Node Type</b></td>
                            <td>
                                service
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Name</b></td>
                            <td>
                                Attendees Service
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Description</b></td>
                            <td>
                                The attendees service, or a placeholder for another application
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Interfaces</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Unique Id</b></td>
                                            <td>
                                                attendees-image
                                                    </td>
                                        </tr>
                                        <tr>
                                            <td><b>Image</b></td>
                                            <td>
                                                [[ IMAGE ]]
                                                    </td>
                                        </tr>
                                        </tbody>
                                    </table>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Unique Id</b></td>
                                            <td>
                                                attendees-port
                                                    </td>
                                        </tr>
                                        <tr>
                                            <td><b>Port</b></td>
                                            <td>
                                                -1
                                                    </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Attendees Store</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                attendees-store
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Node Type</b></td>
                            <td>
                                database
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Name</b></td>
                            <td>
                                Attendees Store
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Description</b></td>
                            <td>
                                Persistent storage for attendees
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Interfaces</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Unique Id</b></td>
                                            <td>
                                                database-image
                                                    </td>
                                        </tr>
                                        <tr>
                                            <td><b>Image</b></td>
                                            <td>
                                                [[ IMAGE ]]
                                                    </td>
                                        </tr>
                                        </tbody>
                                    </table>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Unique Id</b></td>
                                            <td>
                                                database-port
                                                    </td>
                                        </tr>
                                        <tr>
                                            <td><b>Port</b></td>
                                            <td>
                                                -1
                                                    </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>K8s Cluster</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                k8s-cluster
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Node Type</b></td>
                            <td>
                                system
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Name</b></td>
                            <td>
                                Kubernetes Cluster
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Description</b></td>
                            <td>
                                Kubernetes Cluster with network policy rules enabled
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Controls</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Security</b></td>
                                            <td>
                                                <table class="nested-table">
                                                        <tbody>
                                                        <tr>
                                                            <td><b>Description</b></td>
                                                            <td>
                                                                Security requirements for the Kubernetes cluster
                                                                    </td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Requirements</b></td>
                                                            <td>
                                                                <table class="nested-table">
                                                                        <tbody>
                                                                        <tr>
                                                                            <td><b>Requirement Url</b></td>
                                                                            <td>
                                                                                https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>$schema</b></td>
                                                                            <td>
                                                                                https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>$id</b></td>
                                                                            <td>
                                                                                https://calm.finos.org/getting-started/controls/micro-segmentation.config.json
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Control Id</b></td>
                                                                            <td>
                                                                                security-001
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Name</b></td>
                                                                            <td>
                                                                                Micro-segmentation of Kubernetes Cluster
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Description</b></td>
                                                                            <td>
                                                                                Micro-segmentation in place to prevent lateral movement outside of permitted flows
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Permit Ingress</b></td>
                                                                            <td>
                                                                                true
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Permit Egress</b></td>
                                                                            <td>
                                                                                false
                                                                                    </td>
                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                            </td>
                                                        </tr>
                                                        </tbody>
                                                    </table>
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        </tbody>
    </table>
</div>

### Table of Relationships

<div class="table-container">
    <table>
        <thead>
        <tr>
            <th>Key</th>
            <th>Value</th>
        </tr>
        </thead>
        <tbody>
        <tr>
            <td><b>Conference Website Load Balancer</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                conference-website-load-balancer
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Relationship Type</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Connects</b></td>
                                            <td>
                                                <table class="nested-table">
                                                        <tbody>
                                                        <tr>
                                                            <td><b>Source</b></td>
                                                            <td>
                                                                <table class="nested-table">
                                                                        <tbody>
                                                                        <tr>
                                                                            <td><b>Node</b></td>
                                                                            <td>
                                                                                conference-website
                                                                                    </td>
                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Destination</b></td>
                                                            <td>
                                                                <table class="nested-table">
                                                                        <tbody>
                                                                        <tr>
                                                                            <td><b>Node</b></td>
                                                                            <td>
                                                                                load-balancer
                                                                                    </td>
                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                            </td>
                                                        </tr>
                                                        </tbody>
                                                    </table>
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        <tr>
                            <td><b>Controls</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Security</b></td>
                                            <td>
                                                <table class="nested-table">
                                                        <tbody>
                                                        <tr>
                                                            <td><b>Description</b></td>
                                                            <td>
                                                                Security Controls for the connection
                                                                    </td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Requirements</b></td>
                                                            <td>
                                                                <table class="nested-table">
                                                                        <tbody>
                                                                        <tr>
                                                                            <td><b>Requirement Url</b></td>
                                                                            <td>
                                                                                https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>$schema</b></td>
                                                                            <td>
                                                                                https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Control Id</b></td>
                                                                            <td>
                                                                                security-002
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Name</b></td>
                                                                            <td>
                                                                                Permitted Connection
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Description</b></td>
                                                                            <td>
                                                                                Permits a connection on a relationship specified in the architecture
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Reason</b></td>
                                                                            <td>
                                                                                Required to enable flow between architecture components
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Protocol</b></td>
                                                                            <td>
                                                                                HTTP
                                                                                    </td>
                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                            </td>
                                                        </tr>
                                                        </tbody>
                                                    </table>
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        <tr>
                            <td><b>Description</b></td>
                            <td>
                                Request attendee details
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Protocol</b></td>
                            <td>
                                HTTPS
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Load Balancer Attendees</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                load-balancer-attendees
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Relationship Type</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Connects</b></td>
                                            <td>
                                                <table class="nested-table">
                                                        <tbody>
                                                        <tr>
                                                            <td><b>Source</b></td>
                                                            <td>
                                                                <table class="nested-table">
                                                                        <tbody>
                                                                        <tr>
                                                                            <td><b>Node</b></td>
                                                                            <td>
                                                                                load-balancer
                                                                                    </td>
                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Destination</b></td>
                                                            <td>
                                                                <table class="nested-table">
                                                                        <tbody>
                                                                        <tr>
                                                                            <td><b>Node</b></td>
                                                                            <td>
                                                                                attendees
                                                                                    </td>
                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                            </td>
                                                        </tr>
                                                        </tbody>
                                                    </table>
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        <tr>
                            <td><b>Controls</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Security</b></td>
                                            <td>
                                                <table class="nested-table">
                                                        <tbody>
                                                        <tr>
                                                            <td><b>Description</b></td>
                                                            <td>
                                                                Security Controls for the connection
                                                                    </td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Requirements</b></td>
                                                            <td>
                                                                <table class="nested-table">
                                                                        <tbody>
                                                                        <tr>
                                                                            <td><b>Requirement Url</b></td>
                                                                            <td>
                                                                                https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>$schema</b></td>
                                                                            <td>
                                                                                https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Control Id</b></td>
                                                                            <td>
                                                                                security-002
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Name</b></td>
                                                                            <td>
                                                                                Permitted Connection
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Description</b></td>
                                                                            <td>
                                                                                Permits a connection on a relationship specified in the architecture
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Reason</b></td>
                                                                            <td>
                                                                                Required to enable flow between architecture components
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Protocol</b></td>
                                                                            <td>
                                                                                HTTP
                                                                                    </td>
                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                            </td>
                                                        </tr>
                                                        </tbody>
                                                    </table>
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        <tr>
                            <td><b>Description</b></td>
                            <td>
                                Forward
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Protocol</b></td>
                            <td>
                                mTLS
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Attendees Attendees Store</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                attendees-attendees-store
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Relationship Type</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Connects</b></td>
                                            <td>
                                                <table class="nested-table">
                                                        <tbody>
                                                        <tr>
                                                            <td><b>Source</b></td>
                                                            <td>
                                                                <table class="nested-table">
                                                                        <tbody>
                                                                        <tr>
                                                                            <td><b>Node</b></td>
                                                                            <td>
                                                                                attendees
                                                                                    </td>
                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Destination</b></td>
                                                            <td>
                                                                <table class="nested-table">
                                                                        <tbody>
                                                                        <tr>
                                                                            <td><b>Node</b></td>
                                                                            <td>
                                                                                attendees-store
                                                                                    </td>
                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                            </td>
                                                        </tr>
                                                        </tbody>
                                                    </table>
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        <tr>
                            <td><b>Controls</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Security</b></td>
                                            <td>
                                                <table class="nested-table">
                                                        <tbody>
                                                        <tr>
                                                            <td><b>Description</b></td>
                                                            <td>
                                                                Security Controls for the connection
                                                                    </td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Requirements</b></td>
                                                            <td>
                                                                <table class="nested-table">
                                                                        <tbody>
                                                                        <tr>
                                                                            <td><b>Requirement Url</b></td>
                                                                            <td>
                                                                                https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>$schema</b></td>
                                                                            <td>
                                                                                https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Control Id</b></td>
                                                                            <td>
                                                                                security-003
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Name</b></td>
                                                                            <td>
                                                                                Permitted Connection
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Description</b></td>
                                                                            <td>
                                                                                Permits a connection on a relationship specified in the architecture
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Reason</b></td>
                                                                            <td>
                                                                                Permitted to allow the connection between application and database
                                                                                    </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td><b>Protocol</b></td>
                                                                            <td>
                                                                                JDBC
                                                                                    </td>
                                                                        </tr>
                                                                        </tbody>
                                                                    </table>
                                                            </td>
                                                        </tr>
                                                        </tbody>
                                                    </table>
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        <tr>
                            <td><b>Description</b></td>
                            <td>
                                Store or request attendee details
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Protocol</b></td>
                            <td>
                                JDBC
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Deployed In K8s Cluster</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                deployed-in-k8s-cluster
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Relationship Type</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Deployed In</b></td>
                                            <td>
                                                <table class="nested-table">
                                                        <tbody>
                                                        <tr>
                                                            <td><b>Container</b></td>
                                                            <td>
                                                                k8s-cluster
                                                                    </td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Nodes</b></td>
                                                            <td>
                                                                load-balancer
                                                                attendees
                                                                attendees-store
                                                            </td>
                                                        </tr>
                                                        </tbody>
                                                    </table>
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        <tr>
                            <td><b>Description</b></td>
                            <td>
                                Components deployed on the k8s cluster
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        </tbody>
    </table>
</div>

### Table of `Nodes of Type Service`

<div class="table-container">
    <table>
        <thead>
        <tr>
            <th>Key</th>
            <th>Value</th>
        </tr>
        </thead>
        <tbody>
        <tr>
            <td><b>Unique Id</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Value</b></td>
                            <td>
                                attendees
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                unique-id
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Node Type</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Value</b></td>
                            <td>
                                service
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                node-type
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Name</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Value</b></td>
                            <td>
                                Attendees Service
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                name
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Description</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Value</b></td>
                            <td>
                                The attendees service, or a placeholder for another application
                                    </td>
                        </tr>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                description
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Details</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                details
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Interfaces</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Value</b></td>
                            <td>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Unique Id</b></td>
                                            <td>
                                                attendees-image
                                                    </td>
                                        </tr>
                                        <tr>
                                            <td><b>Image</b></td>
                                            <td>
                                                [[ IMAGE ]]
                                                    </td>
                                        </tr>
                                        </tbody>
                                    </table>
                                <table class="nested-table">
                                        <tbody>
                                        <tr>
                                            <td><b>Unique Id</b></td>
                                            <td>
                                                attendees-port
                                                    </td>
                                        </tr>
                                        <tr>
                                            <td><b>Port</b></td>
                                            <td>
                                                -1
                                                    </td>
                                        </tr>
                                        </tbody>
                                    </table>
                            </td>
                        </tr>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                interfaces
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Controls</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                controls
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        <tr>
            <td><b>Metadata</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Unique Id</b></td>
                            <td>
                                metadata
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        </tbody>
    </table>
</div>

### Table of Controls off of node with unique-id "k8s-cluster"

<div class="table-container">
    <table>
        <thead>
        <tr>
            <th>Control Id</th>
            <th>Name</th>
            <th>Description</th>
        </tr>
        </thead>
        <tbody>
        <tr>
            <td>security-001</td>
            <td>Micro-segmentation of Kubernetes Cluster</td>
            <td>Micro-segmentation in place to prevent lateral movement outside of permitted flows</td>
        </tr>
        </tbody>
    </table>
</div>

### Table with post filtering

<div class="table-container">
    <table>
        <thead>
        <tr>
            <th>Node Type</th>
            <th>Description</th>
        </tr>
        </thead>
        <tbody>
        <tr>
            <td>database</td>
            <td>Persistent storage for attendees</td>
        </tr>
        </tbody>
    </table>
</div>