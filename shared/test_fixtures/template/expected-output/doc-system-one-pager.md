## Nodes

| ID            | Name           | Type     | Description                          |
|---------------|----------------|----------|--------------------------------------|
| document-system | DocuFlow       | system | Main document management system |
| svc-upload | Upload Service       | service | Handles user document uploads |
| svc-storage | Storage Service       | service | Stores and retrieves documents securely |
| db-docs | Document Database       | database | Stores metadata and document references |

## Relationships

| ID               | Type         | Source       | Destination / Parts | Description |
|------------------|--------------|---------------|----------------------|-------------|
| rel-upload-to-storage | connects      | svc-upload | svc-storage | Upload Service sends documents to Storage Service for long-term storage |
| rel-storage-to-db | connects      | svc-storage | db-docs | Storage Service stores document metadata in the Document Database |
| document-system-system-is-composed-of | composed-of   | document-system | svc-upload, svc-storage, db-docs | |


## Ownership Controls

| Owner Type      | Name        | Email               | Description                        |
|-----------------|-------------|---------------------|------------------------------------|
| Business Owner | Jo Bloggs | jo.bloggs@finos.org | Captures who is responsible from business perspective |
| System Owner | Jane Doe | jane.doe@finos.org | Captures who is responsible from system ownership |
| Data Owner | Captain Data | captain.data@finos.org | Captures who is responsible for data captain |

## Metadata
```
{
  "data": {
    "arch-health": "BUY"
  }
}
```