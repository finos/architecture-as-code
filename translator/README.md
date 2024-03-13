# Translator Service

> This is a WIP application

The Translator service is a [Spring Boot](https://spring.io/projects/spring-boot) application that converts the CALM specification into alternative formats.

The OpenAPI Specification is available at </v3/api-docs> (<http://localhost:8080/v3/api-docs>) and the UI is available at </swagger-ui/index.html> (<http://localhost:8080/swagger-ui/index.html>)


## Supported translations

| Format         | Endpoint      | Description                                                                                                       |
|----------------|---------------|-------------------------------------------------------------------------------------------------------------------|
| Structurizr-C4 | /translate/c4 | Produces a Workspace json object with generated default views that can be imported into <https://structurizr.com> |
