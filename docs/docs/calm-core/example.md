---
sidebar_position: 2
slug: /calm-core/example
---

# Getting Started
As we discussed in the [Fast Track](/#fast-track) the CALM Core Manifest is structured around **nodes** and **relationships**. In this section we're going to look at how to model a super simple three tier application using the CALM Core Manifest.

Let's look at the following simple C4 Container Diagram.

```mermaid
    C4Container
    
    Container_Boundary(c1, "Three Tier App") {
        Container(spa, "Single-Page App", "JavaScript, Angular", "Exposes amazing features to customers via their web browser")
        Container(web_app, "Web Application", "Java, Spring MVC", "Delivers the amazing features of the application to the Single-Page App")
        ContainerDb(database, "Database", "SQL Database", "Stores user info, and details of the users interactions")
    }

    Rel(web_app, spa, "Delivers")
    Rel_Back(database, web_app, "Reads from and writes to", "JDBC")
    
    UpdateLayoutConfig($c4ShapeInRow="1", $c4BoundaryInRow="1")
```