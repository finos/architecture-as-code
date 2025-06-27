---
id: flow-conference-signup
title: Conference Signup Flow
---

## Details
<div className="table-container">
| Field               | Value                    |
|---------------------|--------------------------|
| **Unique ID**       | flow-conference-signup                   |
| **Name**            | Conference Signup Flow                 |
| **Description**     | Flow for registering a user through the conference website and storing their details in the attendee database.          |
</div>

## Sequence Diagram
```mermaid
sequenceDiagram
            Conference Website ->> Load Balancer: User submits sign-up form via Conference Website to Load Balancer
            Load Balancer ->> Attendees Service: Load Balancer forwards request to Attendees Service
            Attendees Service ->> Attendees Store: Attendees Service stores attendee info in the Attendees Store
```
## Controls
    _No controls defined._

## Metadata
  _No Metadata defined._
