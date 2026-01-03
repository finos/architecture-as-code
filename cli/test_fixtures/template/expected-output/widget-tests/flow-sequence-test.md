---
architecture: ../../../getting-started/STEP-3/conference-signup-with-flow.arch.json
url-to-local-file-mapping: ../../../getting-started/url-to-local-file-mapping.json
---
```mermaid
sequenceDiagram
    Conference Website ->> Load Balancer: User submits sign-up form via Conference Website to Load Balancer
    Load Balancer ->> Attendees Service: Load Balancer forwards request to Attendees Service
    Attendees Service ->> Attendees Store: Attendees Service stores attendee info in the Attendees Store
```

