---
id: define-initial-architecture
title: Define Initial Architecture
sidebar_position: 3
---

## Analyze the business context to identify candidate CALM nodes for the architecture

**Prompt to the AI Assistant**
```text
User: identify candidate CALM nodes with type for an event driven architecture for the business context.  List each node with its type and a short description
## Business Context

**TraderX** is a sample trading application developed by FINOS as a reference implementation for financial services trading operations. It serves as an educational platform to demonstrate typical trading workflows and business processes.

### Core Business Functions

**Trading Operations:**
- **Order Submission**: Users submit buy and sell orders for securities with specified quantities
- **Account Selection**: Users select which trading account to execute trades against
- **Position Management**: Track current holdings and quantities for each security in an account
- **Trade History**: Maintain complete audit trail of all executed trades

**Account Administration:**
- **Account Management**: Create and update trading accounts
- **User Association**: Link multiple users to accounts for access and entitlements
- **Account Inquiry**: View account details and associated users

**Reference Information:**
- **Security Master**: Maintains list of tradeable securities (stocks) with company information
- **User Directory**: Stores user profiles and contact information
- **Account Registry**: Central repository of all trading accounts

**Real-time Information:**
- **Live Updates**: Users receive immediate notifications when trades execute
- **Position Updates**: Account positions refresh automatically as trades settle
- **Trade Status**: Monitor trade lifecycle from submission through execution

### Business Workflows

**Primary Trading Process:**
1. User authenticates and selects a trading account
2. System displays current positions and trade history for that account
3. User views available securities from the security master
4. User submits a trade order specifying security, quantity, and buy/sell direction
5. System validates the account exists and security is valid
6. Trade order enters processing workflow
7. Order executes and updates to the trade blotter
8. Position is recalculated based on the executed trade
9. User sees updated position and trade information in real-time

**Account Setup Process:**
1. Administrator creates a new trading account
2. System assigns unique account identifier
3. Administrator searches for users in the directory
4. Users are associated with the account for access purposes
5. Account becomes available for trading operations

**Position Reconciliation:**
- When user selects an account, system loads historical trades
- System calculates current positions by aggregating all trades
- Ongoing trades continuously update positions
- Users maintain accurate real-time view of holdings

### Business Entities

**Core Domain Objects:**
- **Account**: Container for trades and positions with unique identifier
- **Trade**: Record of a buy or sell transaction with security, quantity, price, and timestamp
- **Position**: Current aggregate holding in a security within an account
- **Security**: Tradeable instrument (stock) with ticker symbol and company name
- **User**: Person who can be associated with accounts for trading access

**Business Relationships:**
- Users have many-to-many relationships with accounts
- Accounts contain many trades and positions
- Each trade references one account and one security
- Positions aggregate trades for the same security within an account

### Business Value
The application demonstrates essential trading operations including order entry, execution, settlement, and position keeping - core functions required by any trading platform in financial services. It provides a complete view of how accounts, users, trades, and positions interrelate throughout the trading lifecycle.
```

**AI Assistant Response**

```text
GitHub Copilot: Loading FINOS CALM instructions...

Searched codebase for "CALM architecture creation node types interface relationship flow control metadata pattern documentation standards", 23 results

Searched codebase for "CALM architecture creation node interface relationship flow control metadata pattern documentation chatmode prompts tools", 26 results

Now I'll read the CALM tool prompt files to get the detailed guidance:

Ran terminal command:  cat /Users/jim/Desktop/finos/architecture-as-code/.github/chatmodes/calm-prompts/architecture-creation.md

Ran terminal command:  cat /Users/jim/Desktop/finos/architecture-as-code/.github/chatmodes/calm-prompts/node-creation.md | head -200

Perfect! I'm ready to assist you with CALM architectures. Now I'll identify candidate CALM nodes for an event-driven architecture based on the TraderX business context.

## Candidate CALM Nodes for TraderX Event-Driven Architecture

Based on the business context, here are the recommended nodes with their types and descriptions:

### Core Application Nodes

1. **`trading-ui`** - Type: `webclient`
   - Web-based trading interface for users to submit orders, view positions, and monitor trade history

2. **`order-submission-service`** - Type: `service`
   - API service that receives and validates trade orders from the UI before publishing to event stream

3. **`trade-execution-service`** - Type: `service`
   - Service that consumes order events, executes trades, and publishes trade execution events

4. **`position-service`** - Type: `service`
   - Service that maintains current positions by consuming trade execution events and calculating aggregated holdings

5. **`account-service`** - Type: `service`
   - Service managing trading account CRUD operations and user-account associations

6. **`notification-service`** - Type: `service`
   - Service that publishes real-time updates to users when trades execute or positions change

### Data Storage Nodes

7. **`trade-database`** - Type: `database`
   - Persistent storage for trade history and execution records

8. **`position-database`** - Type: `database`
   - Storage for current account positions and aggregated holdings

9. **`account-database`** - Type: `database`
   - Storage for trading accounts and user-account associations

10. **`security-reference-database`** - Type: `database`
    - Master database of tradeable securities with company information

11. **`user-directory`** - Type: `ldap` (or `database`)
    - Directory service storing user profiles and contact information

### Event Infrastructure Nodes

12. **`order-event-stream`** - Type: `service` (or custom type: `event-stream`)
    - Event stream/topic for order submission events (e.g., Kafka topic)

13. **`trade-execution-event-stream`** - Type: `service` (or custom type: `event-stream`)
    - Event stream/topic for trade execution events

14. **`position-update-event-stream`** - Type: `service` (or custom type: `event-stream`)
    - Event stream/topic for position change events

15. **`notification-event-stream`** - Type: `service` (or custom type: `event-stream`)
    - Event stream/topic for user notification events

### External/Actor Nodes

16. **`trader`** - Type: `actor`
    - End users who submit trades and monitor positions

17. **`administrator`** - Type: `actor`
    - Users who manage accounts and user associations

---

### Architecture Pattern Notes

**Event-Driven Characteristics:**
- Services communicate primarily through asynchronous event streams
- Event streams act as integration points between producers and consumers
- Services maintain their own databases (database-per-service pattern)
- Decoupled architecture enables independent scaling and deployment

**Relationship Types to Use:**
- **`connects`** relationships between services and event streams (pub/sub)
- **`connects`** relationships between services and their databases
- **`interacts`** relationships between actors and UI/services
- **`connects`** relationships between UI and API services

This node structure supports event-driven patterns with clear separation of concerns, asynchronous communication, and independent data ownership per service.
```

## Based on architect expert judgement, some adjustments are needed to the candidate nodes.  The architect prompts the AI Assistant to make adjustments.

**Prompt to the AI Assistant**
```text
User: consolidate trade-database, postion-database, account-database into a single database called trade-database.   Consolidate all the nodes for event notification into a single service node called trade-event-notification.  update node inventory to reflect this change and list out all the nodes
```

**AI Assistant Response**

```text
GitHub Copilot: Based on your consolidation requirements, here's the updated node inventory for the TraderX event-driven architecture:

## Consolidated CALM Nodes for TraderX Event-Driven Architecture

### Core Application Nodes

1. **`trading-ui`** - Type: `webclient`
   - Web-based trading interface for users to submit orders, view positions, and monitor trade history

2. **`order-submission-service`** - Type: `service`
   - API service that receives and validates trade orders from the UI before publishing to event stream

3. **`trade-execution-service`** - Type: `service`
   - Service that consumes order events, executes trades, and publishes trade execution events

4. **`position-service`** - Type: `service`
   - Service that maintains current positions by consuming trade execution events and calculating aggregated holdings

5. **`account-service`** - Type: `service`
   - Service managing trading account CRUD operations and user-account associations

6. **`trade-event-notification`** - Type: `service`
   - Event infrastructure service handling order submissions, trade executions, position updates, and user notifications through event streams/topics

### Data Storage Nodes

7. **`trade-database`** - Type: `database`
   - Consolidated database storing trade history, execution records, current account positions, trading accounts, and user-account associations

8. **`security-reference-database`** - Type: `database`
   - Master database of tradeable securities with company information

9. **`user-directory`** - Type: `ldap` (or `database`)
   - Directory service storing user profiles and contact information

### External/Actor Nodes

10. **`trader`** - Type: `actor`
    - End users who submit trades and monitor positions

11. **`administrator`** - Type: `actor`
    - Users who manage accounts and user associations

---

### Total Node Count: 11 nodes
- **3 Service nodes** (order-submission-service, trade-execution-service, position-service, account-service) + **1 Event notification service** (trade-event-notification)
- **1 Web client** (trading-ui)
- **3 Data storage nodes** (trade-database, security-reference-database, user-directory)
- **2 Actor nodes** (trader, administrator)

### Architecture Pattern Notes

**Simplified Event-Driven Characteristics:**
- Single event notification service manages all event streams (Kafka, message broker, etc.)
- Consolidated database reduces operational complexity while maintaining clear data domains
- Services communicate through the centralized event notification service
- Clear separation between application services, data storage, and event infrastructure
```

## Create initial architecture from the revised node inventory

**Prompt to the AI Assistant**
```text
User: update the trading-system.architecture.json with the nodes and their relationships.
```

** AI Assistant Response**
```text
GitHub Copilot: Searched codebase for "trading-system.architecture.json calm example", 25 results

Ran terminal command:  find /Users/jim/Desktop/finos/architecture-as-code -name "trading-system.architecture.json" -type f 2>/dev/null | head -5

Ran terminal command:  cat /Users/jim/Desktop/finos/architecture-as-code/docs/docs/working-with-calm/calm-example/trading-system.architecture.json

Now I'll read the relationship creation guide to understand how to properly define relationships:

Ran terminal command:  cat /Users/jim/Desktop/finos/architecture-as-code/.github/chatmodes/calm-prompts/relationship-creation.md | head -300

Now I'll create a comprehensive trading system architecture with all nodes and relationships:


Now let's validate the architecture file:

Ran terminal command:  calm validate -a /Users/jim/Desktop/finos/architecture-as-code/docs/docs/working-with-calm/calm-example/trading-system.architecture.json

Perfect! Now let's view a summary of what was created:

Ran terminal command:  cat /Users/jim/Desktop/finos/architecture-as-code/docs/docs/working-with-calm/calm-example/trading-system.architecture.json | jq '{name, description, "node-count": (.nodes | length), "relationship-count": (.relationships | length), nodes: [.nodes[] | {id: ."unique-id", type: ."node-type", name}]}'

Excellent! The architecture has been successfully created and validated. Here's a summary of what was implemented:

## ✅ Trading System Architecture Complete

**File**: `trading-system.architecture.json`

**Validation**: ✅ Passes all CALM schema validation (`hasErrors: false, hasWarnings: false`)

### Architecture Summary

**Total Nodes**: 11
- **2 Actors**: trader, administrator
- **1 Web Client**: trading-ui
- **5 Services**: order-submission-service, trade-execution-service, position-service, account-service, trade-event-notification
- **2 Databases**: trade-database (consolidated), security-reference-database
- **1 LDAP**: user-directory

**Total Relationships**: 15

### Key Architecture Features

1. **Event-Driven Design**: Centralized `trade-event-notification` service handles all event streams (AMQP protocol)

2. **Consolidated Storage**: Single `trade-database` stores trades, positions, accounts, and user associations

3. **Service Interactions**:
   - UI communicates with services via HTTPS
   - Services publish/consume events via AMQP
   - Services access databases via JDBC
   - Account service queries user-directory via LDAP
   - Real-time updates to UI via WebSocket

4. **Actor Interactions**: Both trader and administrator interact with the trading-ui

The architecture follows event-driven microservices patterns with clear separation of concerns and asynchronous communication through the event notification service.

Made changes.
```

## From the business context add business flows

**Prompt to the AI Assistant**

```text
User: add flows to the architecture file
```

**AI Assistant Response**

```text
GitHub Copilot: I'll read the flow creation guide to understand how to properly define flows in CALM:

Ran terminal command:  cat /Users/jim/Desktop/finos/architecture-as-code/.github/chatmodes/calm-prompts/flow-creation.md

Now I'll add flows to the architecture file based on the business context. I'll create flows for the key business processes:

Using "Replace String in File"


```

```
Now let's validate the updated architecture with flows:

Ran terminal command:  calm validate -a /Users/jim/Desktop/finos/architecture-as-code/docs/docs/working-with-calm/calm-example/trading-system.architecture.json

Perfect! Now let's display a summary of the flows:

Ran terminal command:  cat /Users/jim/Desktop/finos/architecture-as-code/docs/docs/working-with-calm/calm-example/trading-system.architecture.json | jq '{name, "flow-count": (.flows | length), flows: [.flows[] | {id: ."unique-id", name, description, "transition-count": (.transitions | length)}]}'

Excellent! The flows have been successfully added. Here's what was implemented:

## ✅ Flows Added to Trading System Architecture

**Validation**: ✅ Passes all CALM schema validation (`hasErrors: false, hasWarnings: false`)

### Flow Summary

**Total Flows**: 4

1. **Trade Order Submission Flow** (4 transitions)
   - Trader submits order → UI → Order Submission Service → Security validation → Event notification
   - SLA: < 200ms, Peak: 1000 orders/second

2. **Trade Execution Flow** (5 transitions)
   - Event notification → Execution Service → Database persistence → Execution event → Position Service → Position update
   - Critical business process with MiFID II and Reg NMS compliance
   - SLA: < 500ms

3. **Position Update Notification Flow** (2 transitions)
   - Position Service → Event notification → Trading UI (WebSocket)
   - Real-time updates with < 100ms SLA

4. **Account Management Flow** (4 transitions)
   - Administrator → UI → Account Service → User Directory → Database
   - SOX and Access Control compliance
   - SLA: < 2 seconds

Each flow:
- References existing relationships in the architecture
- Includes sequence numbers for proper ordering
- Has business-focused descriptions for each transition
- Contains metadata with SLA, criticality, and compliance information
- Demonstrates how business processes traverse the technical architecture

Made changes.
```
