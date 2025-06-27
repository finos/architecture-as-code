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
C4Container

            Container(conference-website,"Conference Website","","Website to sign up for a conference")



        System_Boundary("Kubernetes Cluster","Kubernetes Cluster with network policy rules enabled"){
                Container(load-balancer,"Load Balancer","","The attendees service, or a placeholder for another application")
                Container(attendees,"Attendees Service","","The attendees service, or a placeholder for another application")
                Container(attendees-store,"Attendees Store","","Persistent storage for attendees")
                Container(load-balancer,"Load Balancer","","The attendees service, or a placeholder for another application")
                Container(attendees,"Attendees Service","","The attendees service, or a placeholder for another application")
                Container(attendees-store,"Attendees Store","","Persistent storage for attendees")
        }


    Rel(conference-website,load-balancer,"Connects To")
    Rel(load-balancer,attendees,"Connects To")
    Rel(attendees,attendees-store,"Connects To")

UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="0")
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
     _No flows defined._

## Controls
| ID    | Name             | Description                  | Domain    | Scope        | Applied To                |
|-------|------------------|------------------------------|-----------|--------------|---------------------------|
|security-001|Micro-segmentation of Kubernetes Cluster|Micro-segmentation in place to prevent lateral movement outside of permitted flows|security|Node|k8s-cluster|
|security-002|Permitted Connection|Permits a connection on a relationship specified in the architecture|security|Relationship|conference-website-load-balancer|
|security-002|Permitted Connection|Permits a connection on a relationship specified in the architecture|security|Relationship|load-balancer-attendees|
|security-003|Permitted Connection|Permits a connection on a relationship specified in the architecture|security|Relationship|attendees-attendees-store|

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
