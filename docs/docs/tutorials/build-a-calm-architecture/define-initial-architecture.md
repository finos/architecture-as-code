---
id: define-initial-architecture
title: Define Initial Architecture
sidebar_position: 3
---

## Create a minimal CALM architecture file

To start off, we will create a minimal CALM architecture file.

**Prompt to AI Assistant**
```text
create a minimal CALM architecture file called trading-system.architecture.json 
with no nodes or relationships
```

**Response from AI Assistant**
```text
Loading FINOS CALM instructions...

Let me read the CALM tool prompts to understand the current guidance. 

Ran terminal command:  cat "/Users/jim/Desktop/calm-demos/build-calm-architecture/.github/chatmodes/calm-prompts/architecture-creation.md"

Ran terminal command:  cat "/Users/jim/Desktop/calm-demos/build-calm-architecture/.github/chatmodes/calm-prompts/calm-cli-instructions.md"

I'm ready to assist with CALM architectures. Let me create the minimal architecture file for you. 

Ran terminal command:  cat > "/Users/jim/Desktop/calm-demos/build-calm-architecture/trading-system.architecture.json" << 'EOF'
{
    "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
    "unique-id": "trading-system",
    "name": "Trading System",
    "description": "A minimal trading system architecture",
    "nodes": [],
    "relationships": []
}
EOF


Now let me validate the architecture file to ensure it's compliant with CALM v1.1: 

Ran terminal command:  calm validate -a trading-system.architecture.json

Perfect! Created trading-system.architecture.json with the minimal required structure and validated successfully. The file includes:

- `$schema`: Reference to CALM v1.1 schema
- `unique-id`: "trading-system"
- `name`: "Trading System"
- `description`: A minimal description
- `nodes`: Empty array (ready for nodes to be added)
- `relationships`: Empty array (ready for relationships to be added)

The validation confirms no errors or warnings.
```

## Analyze business design to identify candidate nodes for the CALM architecture definition

**Prompt to AI Assistant**
```text
identify candidate CALM nodes with type for an event driven architecture for the provided 
business design.  Use only information found in the business design provided.  List each 
node with its type and a short description.
## Business Design

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
- **Trade Data Store**: Central repository of all trading accounts

**Real-time Information:**
- **Trade Updates**: Users receive immediate notifications when trades execute
- **Position Updates**: Account positions refresh automatically as trades settle
- **Trade Status**: Monitor trade lifecycle from submission through execution

### Business Workflows

**1: Load List of Accounts**
- **Actors**: Web GUI, Account Service, Trade Data Store.
- **Steps**:
  1. Web GUI asks Account Service to load the list of accounts.
  2. Account Service queries the Trade Data Store for all accounts.
  3. Trade Data Store returns the result set to Account Service.
  4. Account Service returns the list of accounts to Web GUI.

**2: Bootstrapping the Trade and Position Blotter**
- **Actors**: Web GUI, Position Service, Trade Feed, Trade Data Store.
- **Steps**:
  1. Web GUI requests trades and positions for a selected account from Position Service.
  2. Position Service queries the Trade Data Store for that account's trades and positions.
  3. Position Service returns the initial trades and positions to Web GUI.
  4. Web GUI subscribes to Trade Feed for account-specific trade and position updates.
  5. Live Updates publishes ongoing trade and position updates to Web GUI.

**3: Submitting a Trade Ticket**
- **Actors**: Web GUI, Security Master, Trade Service, Account Service, Trade Feed.
- **Steps**:
  1. Web GUI requests the ticker list from the Security Master; Security Master returns it.
  2. Web GUI submits a trade (account, ticker, side, quantity) to Trade Service.
  3. Trade Service validates the ticker with the Security Master.
  4. Trade Service validates the account with Account Service.
  5. Trade Service publishes a new trade event to Trade Feed (trades/new).
  6. Trade Service returns a trade submission completion response to Web GUI.

**4: Trade Processing**
- **Actors**: Trade Feed, Trade Processor, Trade Data Store, Web GUI.
- **Steps**:
  1. Trade Feed delivers a new trade event to Trade Processor.
  2. Trade Processor inserts the new trade into the Trade Data Store.
  3. Trade Processor publishes a new account-specific trade event Trade Feed.
  4. Trade Feed pushes the "new trade" event to Web GUI.
  5. Trade Processor marks the trade as executed in the Trade Data Store.
  6. Trade Processor inserts or updates the corresponding position (account, ticker, quantity) in the Trade Data Store.
  7. Trade Processor publishes trade update events and a position event via Trade Feed.
  8. Trade Feed forwards trade updates and position updates to Web GUI.

**5: Add/Update Account**
- **Actors**: Web GUI, Account Service, Trade Data Store.
- **Steps**:
  1. Web GUI sends an account create or update request to Account Service.
  2. Account Service inserts or updates the account row in the Trade Data Store.
  3. Account Service returns success or failure to Web GUI.

**6: Add/Update Users to Account**
- **Actors**: Web GUI, Account Service, Trade Data Store, People Service, User Directory.
- **Steps**:
  1. Web GUI asks Account Service for the current list of people associated with an account.
  2. Account Service queries the Trade Data Store for account-user mappings and returns them.
  3. Web GUI asks the People Service to search for a user by name.
  4. People Service queries User Directory and returns matching people records to People Service.
  5. People Service returns search results to Web GUI.
  6. Web GUI requests Account Service to add the selected user to the account.
  7. Account Service validates the username via the People Service.
  8. Account Service inserts or updates the account–user mapping in the Trade Data Store.
  9. Account Service returns success or failure to Web GUI.

**7: Security Master Bootstrap**
- **Actors**: Security Master, CSV file, Web GUI.
- **Steps**:
  1. On startup, the Security Master loads the ticker CSV file.
  2. The CSV file supplies the ticker list to the Security Master.
  3. When Web GUI requests the ticker list, the Security Master returns it.

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

**Response from AI Assitant**
```text
Based on the event-driven architecture described in the business design, here are the candidate CALM nodes:

## User Interface Nodes

**web-gui** (Type: `system`)
- Browser-based graphical user interface for traders to submit orders, view positions, manage accounts, and receive real-time trade updates

## Service Nodes

**account-service** (Type: `service`)
- Manages account creation, updates, and user associations; validates account data and queries account information from the data store

**trade-service** (Type: `service`)
- Handles trade ticket submission; validates trades against security master and account service before publishing to the trade feed

**position-service** (Type: `service`)
- Provides initial bootstrap data for trades and positions when users select an account; queries historical data from the trade data store

**people-service** (Type: `service`)
- Searches for users by name and validates user information against the user directory for account associations

**security-master** (Type: `service`)
- Maintains and serves the list of tradeable securities with ticker symbols and company information; bootstraps from CSV file on startup

**trade-processor** (Type: `service`)
- Asynchronous processor that consumes new trade events, persists trades to the data store, updates positions, and publishes account-specific trade and position events

## Event Streaming Node

**trade-feed** (Type: `service`)
- Event-driven message broker that publishes and delivers trade events (new trades, trade updates, position updates) to subscribers including the web GUI and trade processor

## Data Store Nodes

**trade-data-store** (Type: `datastore`)
- Central persistent repository storing accounts, trades, positions, and account-user mappings

**user-directory** (Type: `datastore`)
- Repository of user profiles and contact information queried by people service

## External Data Source

**ticker-csv-file** (Type: `system`)
- Static CSV file containing the list of tradeable securities loaded by security master at startup
```

## Review and revise the candidate list of CALM Nodes

After reviewing the proposed list of nodes, the architect determines a node representing the human trader is missing.  

**Prompt to AI Assistant**
```text
add a node called "Trader" of type actor to the node inventory.  display the updated 
node inventory.  I want to review and approve any changes.
```
_Note_: Reviewing and approving changes is a guardrail to help ensure the AI Assistant does not stray from the architect intent.  

**Response from AI Assistant**
```text
Here's the proposed addition to the node inventory:

## Updated Node Inventory

### Actor Nodes

**trader** (Type: `actor`)
- Person who interacts with the trading system to submit orders, manage accounts, and monitor positions through the web GUI

### User Interface Nodes

**web-gui** (Type: `system`)
- Browser-based graphical user interface for traders to submit orders, view positions, manage accounts, and receive real-time trade updates

### Service Nodes

**account-service** (Type: `service`)
- Manages account creation, updates, and user associations; validates account data and queries account information from the data store

**trade-service** (Type: `service`)
- Handles trade ticket submission; validates trades against security master and account service before publishing to the trade feed

**position-service** (Type: `service`)
- Provides initial bootstrap data for trades and positions when users select an account; queries historical data from the trade data store

**people-service** (Type: `service`)
- Searches for users by name and validates user information against the user directory for account associations

**security-master** (Type: `service`)
- Maintains and serves the list of tradeable securities with ticker symbols and company information; bootstraps from CSV file on startup

**trade-processor** (Type: `service`)
- Asynchronous processor that consumes new trade events, persists trades to the data store, updates positions, and publishes account-specific trade and position events

### Event Streaming Node

**trade-feed** (Type: `service`)
- Event-driven message broker that publishes and delivers trade events (new trades, trade updates, position updates) to subscribers including the web GUI and trade processor

### Data Store Nodes

**trade-data-store** (Type: `datastore`)
- Central persistent repository storing accounts, trades, positions, and account-user mappings

**user-directory** (Type: `datastore`)
- Repository of user profiles and contact information queried by people service

### External Data Source

**ticker-csv-file** (Type: `system`)
- Static CSV file containing the list of tradeable securities loaded by security master at startup

---

**Changes:** Added "trader" as an actor node to represent the human user who interacts with the system.

Do you approve this addition?

```

**Prompt to AI Assistant**
```text
yes
```

**Response from AI Assistant**
```text
The node inventory has been updated to include the "trader" actor node. The inventory now contains 12 nodes total:

- 1 actor node (trader)
- 1 user interface system (web-gui)
- 6 service nodes (account-service, trade-service, position-service, people-service, security-master, trade-processor)
- 1 event streaming service (trade-feed)
- 2 datastore nodes (trade-data-store, user-directory)
- 1 external data source system (ticker-csv-file)
```

## Create the baseline node and relationship definitions for the CALM architecture

**Prompt to AI Assistant**
```text
update the calm architecture file trading-system.architecture.json with 
nodes and relationships.
```

**Response from AI Assistant**
```text
Ran terminal command:  cat "/Users/jim/Desktop/calm-demos/build-calm-architecture/.github/chatmodes/calm-prompts/node-creation.md"

Ran terminal command:  cat "/Users/jim/Desktop/calm-demos/build-calm-architecture/.github/chatmodes/calm-prompts/relationship-creation.md"

Now let me update the architecture file with all the nodes and relationships based on the business design: 

Using "Replace String in File"

Now let me validate the updated architecture: 

Ran terminal command:  calm validate -a trading-system.architecture.json -f pretty

Perfect! Updated trading-system.architecture.json with:

**12 Nodes:**
- 1 actor (trader)
- 7 services (account-service, trade-service, position-service, people-service, security-master, trade-processor, trade-feed)
- 2 databases (trade-data-store, user-directory)
- 2 systems (web-gui, ticker-csv-file)

**18 Relationships:**
- 1 interacts relationship (trader → web-gui)
- 17 connects relationships showing data flows between components with appropriate protocols (HTTPS, JDBC, LDAP, AMQP, WebSocket)

The architecture validates successfully with no errors or warnings.

Made changes.
```

_Note_:  Whenever an update is made to the architecture file, the `calm validate` command should be used to ensure syntatic correctness.  If the AI Assistant does not run it, the architect should request it to be run.

### Excerpt of the CALM Architecture JSON
![Raw Architecture JSON](./images/00_initial_architecture_json.png)


## Using CALM Tool VSCode extenstion, review parts of the architecture representation

### Preview of the Overall Architecture
![Overall Architecturee](./images/01_initial_architecture_overall_preview.png)

### Preview of Trade Service
![Trade Service](./images/02_initial_architecture_trade_service_preview.png)

### Preview of Trade Data Store
![Trade Data Store](./images/03_initial_architecture_trade-data-store_preview.png)

## Commit Architecture to GIT repo

Another good practice is to commit the architecture json file after signficant updates.   The AI Assistant can help you with this task.

**Prompt to AI Assistant**
```text
git commit the architecture file with message "initial version"
```

**Response from AI Assistant**
```text
Ran terminal command:  git add trading-system.architecture.json && git commit -m "initial version"

Committed successfully. The trading-system.architecture.json file has been added to the repository with commit message "initial version".
```

## Add process flows to the architecture definition

**Prompt to AI Assistant**
```text
list candidate CALM flows described in the business design.
```

**Response from AI Assistant**
```text
Based on the business design, here are the candidate CALM flows:

## Candidate Flows

1. **load-accounts-flow**
   - Load the list of trading accounts for display in the UI
   - Actors: Web GUI, Account Service, Trade Data Store

2. **bootstrap-blotter-flow**
   - Bootstrap the trade and position blotter with historical data and subscribe to live updates
   - Actors: Web GUI, Position Service, Trade Feed, Trade Data Store

3. **submit-trade-flow**
   - Submit a trade ticket with validation and event publishing
   - Actors: Web GUI, Security Master, Trade Service, Account Service, Trade Feed

4. **process-trade-flow**
   - Process new trade events, persist to storage, update positions, and publish updates
   - Actors: Trade Feed, Trade Processor, Trade Data Store, Web GUI

5. **manage-account-flow**
   - Create or update trading account information
   - Actors: Web GUI, Account Service, Trade Data Store

6. **manage-account-users-flow**
   - Add or update user associations to trading accounts
   - Actors: Web GUI, Account Service, Trade Data Store, People Service, User Directory

7. **bootstrap-security-master-flow**
   - Load the security master with ticker data from CSV file on startup
   - Actors: Security Master, Ticker CSV File, Web GUI
```

**Prompt to AI Assistant**
```text
add flows to the trading-system.architecture.json
```

**Response from AI Assistant**
```text
Ran terminal command:  cat "/Users/jim/Desktop/calm-demos/build-calm-architecture/.github/chatmodes/calm-prompts/flow-creation.md"

Using "Replace String in File"

Ran terminal command:  tail -20 "/Users/jim/Desktop/calm-demos/build-calm-architecture/trading-system.architecture.json"

Using "Replace String in File"

Now let me validate the updated architecture with flows: 

Ran terminal command:  calm validate -a trading-system.architecture.json -f pretty

Perfect! Added 7 flows to trading-system.architecture.json:

1. **load-accounts-flow** - 4 transitions
2. **bootstrap-blotter-flow** - 5 transitions  
3. **submit-trade-flow** - 7 transitions
4. **process-trade-flow** - 8 transitions
5. **manage-account-flow** - 3 transitions
6. **manage-account-users-flow** - 12 transitions
7. **bootstrap-security-master-flow** - 4 transitions

All flows use existing relationships with bidirectional transitions where needed. The architecture validates successfully with no errors or warnings.

Made changes.
```

## Commit addition of process flow to GIT repo

**Prompt to AI Assistant**
```text
git commit architecture file with message "add initial flow definitions"
```

**Response from AI Assistant**
```text
Ran terminal command:  git add trading-system.architecture.json && git commit -m "add initial flow definitions"

Committed successfully with message "add initial flow definitions".
```

## Review process flows with CALM Tool VSCode extesion

_Note_: For purposes of this tutorial, only two process flows are reviewed.  In actual work, all process flows should be reviewed for completeness and accuracy.

### Review Submit Trade Process Flow
![Submit Trade Process Flow](./images/04_initial_flow_submit-trade_flow_preview.png)

### Review Process Trade Flow
![Process Trade Flow](./images/05_initial_flow_process-trade_flow_preview.png)

Based on this review the architect determines the `Trader` node is missing from this flows and requests the AI Assistant to add the missing node.


**Prompt to AI Assistant**
```text
add Trader node to submit-trade-flow where Trader interacts with the webgui to submit 
the trade ticket. add Trader to the process-trade-flow where the Trader receives 
notification from the webgui at the end to receive trade and position updates. 
Do not update architecture file.  I want review and approve changes.
```

**Response from AI Assistant**
```text
Here are the proposed changes to add the Trader node to the flows:

## submit-trade-flow

Add these transitions at the **beginning** of the flow:

   **New Transition 1:**
   {
      "relationship-unique-id": "trader-web-gui",
      "sequence-number": 1,
      "description": "Trader submits trade ticket through Web GUI",
      "direction": "source-to-destination"
   }


**Renumber existing transitions:** All current transitions shift from sequence 1-7 to sequence 2-8.

## process-trade-flow

Add this transition at the **end** of the flow:

**New Transition 9:**
   json
   {
      "relationship-unique-id": "trader-web-gui",
      "sequence-number": 9,
      "description": "Web GUI notifies Trader of trade and position updates",
      "direction": "destination-to-source"
   }


**Summary of Changes:**
- **submit-trade-flow**: Adds Trader initiating the trade submission (1 new transition at start, renumber existing 1-7 → 2-8)
- **process-trade-flow**: Adds Trader receiving updates at the end (1 new transition after current sequence 8)

Do you approve these changes?
```

Before accepting the change, the architect wants to see the complete updated process flow definitions.

**Prompt to AI Assistant**
```text
Show full definition of submit-trade-flow and process-trade-flow
```

**Response from AI Assistant**
```text
## submit-trade-flow (with proposed changes)

json
{
    "unique-id": "submit-trade-flow",
    "name": "Submit Trade Ticket",
    "description": "Submit a trade ticket with validation and event publishing",
    "transitions": [
        {
            "relationship-unique-id": "trader-web-gui",
            "sequence-number": 1,
            "description": "Trader submits trade ticket through Web GUI",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "web-gui-security-master",
            "sequence-number": 2,
            "description": "Web GUI requests ticker list from Security Master",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "web-gui-security-master",
            "sequence-number": 3,
            "description": "Security Master returns ticker list to Web GUI",
            "direction": "destination-to-source"
        },
        {
            "relationship-unique-id": "web-gui-trade-service",
            "sequence-number": 4,
            "description": "Web GUI submits trade with account, ticker, side, and quantity",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "trade-service-security-master",
            "sequence-number": 5,
            "description": "Trade Service validates ticker with Security Master",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "trade-service-account-service",
            "sequence-number": 6,
            "description": "Trade Service validates account with Account Service",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "trade-service-trade-feed",
            "sequence-number": 7,
            "description": "Trade Service publishes new trade event to Trade Feed",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "web-gui-trade-service",
            "sequence-number": 8,
            "description": "Trade Service returns submission confirmation to Web GUI",
            "direction": "destination-to-source"
        }
    ]
}


## process-trade-flow (with proposed changes)

json
{
    "unique-id": "process-trade-flow",
    "name": "Process Trade Event",
    "description": "Process new trade events, persist to storage, update positions, and publish updates",
    "transitions": [
        {
            "relationship-unique-id": "trade-feed-trade-processor",
            "sequence-number": 1,
            "description": "Trade Feed delivers new trade event to Trade Processor",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "trade-processor-trade-data-store",
            "sequence-number": 2,
            "description": "Trade Processor inserts new trade into Trade Data Store",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "trade-processor-trade-feed",
            "sequence-number": 3,
            "description": "Trade Processor publishes account-specific trade event",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "web-gui-trade-feed",
            "sequence-number": 4,
            "description": "Trade Feed pushes new trade event to Web GUI",
            "direction": "destination-to-source"
        },
        {
            "relationship-unique-id": "trade-processor-trade-data-store",
            "sequence-number": 5,
            "description": "Trade Processor marks trade as executed in Trade Data Store",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "trade-processor-trade-data-store",
            "sequence-number": 6,
            "description": "Trade Processor updates position in Trade Data Store",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "trade-processor-trade-feed",
            "sequence-number": 7,
            "description": "Trade Processor publishes trade update and position events",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "web-gui-trade-feed",
            "sequence-number": 8,
            "description": "Trade Feed forwards updates to Web GUI",
            "direction": "destination-to-source"
        },
        {
            "relationship-unique-id": "trader-web-gui",
            "sequence-number": 9,
            "description": "Web GUI notifies Trader of trade and position updates",
            "direction": "destination-to-source"
        }
    ]
}
```

The updated process flows look good, so the architect tells the AI Assistant that the proposed changes should be accepted.

**Prompt to AI Assistant**
```text
I accept the proposed changes
```

**Response from AI Assistant**
```text
Using "Multi-Replace String in Files"

Ran terminal command:  calm validate -a trading-system.architecture.json -f pretty

Changes applied successfully:

- **submit-trade-flow**: Added Trader initiating trade at sequence 1, renumbered all transitions (now 8 total)
- **process-trade-flow**: Added Trader receiving updates at sequence 9 (now 9 total transitions)

Architecture validates with no errors or warnings.

Made changes.
```

## Review updated process flows with CALM Tool VSCode Extension

The `Trader` node is now present in both flows.

### Updated Submit Trade Process Flow
![Submit Trade Process Flow](./images/06_revised_flow_submit-trade_flow_preview.png)

### Updated Process Trade Flow
![Process Trade Flow](./images/06_revised_flow_process-trade_flow_preview.png)


## Commit the architecture definition with revised process flow to GIT Repo

At this point the architect has completed the initial definition of the architecture.

**Prompt to AI Assistant**
```text
git commit architecture file with mesasge "revised trade-submit and process-trade flows"
```

**Response from AI Assistant**
```text
Ran terminal command:  git add trading-system.architecture.json && git commit -m "revised trade-submit and process-trade flows"

Committed successfully with message "revised trade-submit and process-trade flows".
```

## Summary 

At this point we have a baseline architecture defined and reviewed by an architect that reflects the business design.  The next step is to enhance the architecture with technical and other key information.