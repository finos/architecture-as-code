# Translator Service

> This is a WIP application

The Translator service is a [Spring Boot](https://spring.io/projects/spring-boot) application that converts the CALM
specification into alternative formats.

## Building & running the application

```shell
./mvnw install
./mvnw spring-boot:run
```

## Using the translators

The OpenAPI Specification is available at [/v3/api-docs](http://localhost:8080/v3/api-docs) and the Swagger UI is
available at [/swagger-ui/index.html](http://localhost:8080/swagger-ui/index.html)

## Supported translations

<table>
  <tr>
    <th>Format</th>
    <th>Endpoint</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>Structurizr-C4</td>
    <td>/translate/c4</td>
    <td>Produces a Workspace json object with generated default views that can be imported into <a href="https://structurizr.com/">https://structurizr.com/</a></td>
  </tr>
    <tr>
        <td colspan="3"><pre><code class="shell">curl -X 'POST' 'http://localhost:8080/translate/c4' -H 'accept: */*' -H 'Content-Type: application/json' -d "@./src/test/resources/traderx-calm.json"</code></pre></td>
    </tr>
  <tr>
    <td>k8s Manifest</td>
    <td>N/A</td>
    <td>Work in progress, will produce k8s manifests</td>
  </tr>
</table>

