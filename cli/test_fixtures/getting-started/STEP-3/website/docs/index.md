---
id: index
title: Welcome to CALM Documentation
sidebar_position: 1
slug: /
---

# Welcome to CALM Documentation

This documentation is generated from the **CALM Architecture-as-Code** model.

## High Level Architecture
```mermaid
C4Deployment

    Deployment_Node(deployment, "Architecture", ""){
        Container(conference-website, "Conference Website", "", "Website to sign up for a conference")
        Deployment_Node(k8s-cluster, "Kubernetes Cluster", "Kubernetes Cluster with network policy rules enabled"){
            Container(load-balancer, "Load Balancer", "", "The attendees service, or a placeholder for another application")
            Container(attendees, "Attendees Service", "", "The attendees service, or a placeholder for another application")
            Container(attendees-store, "Attendees Store", "", "Persistent storage for attendees")
        }
    }

    Rel(conference-website,load-balancer,"Connects To")
    Rel(load-balancer,attendees,"Connects To")
    Rel(attendees,attendees-store,"Connects To")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```
## Nodes
    - [Conference Website](nodes/conference-website)
    - [Load Balancer](nodes/load-balancer)
    - [Attendees Service](nodes/attendees)
    - [Attendees Store](nodes/attendees-store)
    - [Kubernetes Cluster](nodes/k8s-cluster)

## Relationships
    - [Conference Website Load Balancer](relationships/conference-website-load-balancer)
    - [Load Balancer Attendees](relationships/load-balancer-attendees)
    - [Attendees Attendees Store](relationships/attendees-attendees-store)
    - [Deployed In K8s Cluster](relationships/deployed-in-k8s-cluster)


## Flows
    - [Conference Signup Flow](flows/flow-conference-signup)

## Controls
| Requirement URL               | Category    | Scope        | Applied To                |
|-------------------------------|-----------|--------------|---------------------------|
|https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json|security|Node|k8s-cluster|
|https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json|security|Relationship|conference-website-load-balancer|
|https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json|security|Relationship|load-balancer-attendees|
|https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json|security|Relationship|attendees-attendees-store|

## Metadata
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
                  <b>Kubernetes</b>
              </td>
              <td>
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
                                  <b>Namespace</b>
                              </td>
                              <td>
                                  conference
                                      </td>
                          </tr>
                          </tbody>
                      </table>
                  </div>
              </td>
          </tr>
          </tbody>
      </table>
  </div>

## Adrs
  _No Adrs defined._
