## Node types

### `service`
Generates
- k8s service
- k8s deployment

Need to know:
- Ingress point?
- Egress? 
- What connects to/from this service?
    - service discovery config - how does it know how to call a service it connects to? config map or environment variables for the service names
    - network rules/calico
    - service mesh
    - rego/opa stuff?

### `database`
- Very similar to service

### `system`
- Generic
- Represents stuff we don't understand.
- Probably should ignore this

### `actor`
### `webclient` / `userinterface`

### `network`

### `ldap`

