---
title: "Define Initial Architecture"
id: define-initial-architecture
sidebar_position: 3
---

## AI Assistant Prompt
```text
create a minimal CALM architecture file calm-example/docs/tradining-system.architecture.json
```

## AI Assistant Response
```text
GitHub Copilot: Loading FINOS CALM instructions...

I'll read the CALM tool prompt files to understand the current guidance for creating architectures.

Ran terminal command:  cat .github/chatmodes/calm-prompts/architecture-creation.md

Ran terminal command:  cat .github/chatmodes/calm-prompts/calm-cli-instructions.md

Ran terminal command:  cat .github/chatmodes/calm-prompts/node-creation.md

Ran terminal command:  cat .github/chatmodes/calm-prompts/relationship-creation.md .github/chatmodes/calm-prompts/interface-creation.md .github/chatmodes/calm-prompts/metadata-creation.md

Perfect! I'm ready to assist you with CALM architectures. Now I'll create a minimal CALM architecture file for a trading system.

Ran terminal command:  cat > /Users/jim/Desktop/finos/architecture-as-code/calm-example/docs/trading-system.architecture.json << 'EOF'
{
    "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
    "unique-id": "trading-system",
    "name": "Trading System",
    "description": "A minimal trading system architecture demonstrating CALM modeling",
    "metadata": {
        "version": "1.0.0",
        "created-by": "Architecture Team",
        "environment": "production"
    },
    "nodes": [],
    "relationships": []
}
EOF


Now let me validate the architecture file using the CALM CLI to ensure it meets the schema requirements:

Ran terminal command:  which calm

Ran terminal command:  calm validate -a /Users/jim/Desktop/finos/architecture-as-code/calm-example/docs/trading-system.architecture.json

Perfect! I've successfully created a minimal CALM architecture file at trading-system.architecture.json.

The file includes:
- **Required schema reference** to CALM v1.1
- **Unique identifier**: `trading-system`
- **Name and description** for the trading system
- **Metadata** with version, creator, and environment information
- **Empty nodes and relationships arrays** ready for expansion

✅ **Validation confirmed**: The architecture passes all schema validation with no errors or warnings (`hasErrors: false, hasWarnings: false`).

This minimal architecture provides a solid foundation that you can build upon by adding nodes (services, databases, etc.) and relationships between them.
```

## AI Assistant Prompt
```text
User: identify candidate CALM nodes with type for an event driven architecture for the business context

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

## AI Assistant Response
```text
GitHub Copilot: I'll analyze the business context and identify candidate CALM nodes for an event-driven trading architecture.

Ran terminal command:  cat > /Users/jim/Desktop/finos/architecture-as-code/sandbox/trading-system-nodes.md << 'EOF'
# Trading System - Candidate CALM Nodes

## External Actors
- **trader** (actor) - End users who submit and monitor trades
- **administrator** (actor) - System administrators who manage accounts and users

## User-Facing Components
- **trading-ui** (webclient) - Web interface for trade submission and monitoring
- **admin-ui** (webclient) - Administrative interface for account and user management

## Core Services (Event-Driven)
- **order-service** (service) - Processes trade order submissions and validations
- **execution-service** (service) - Executes validated trade orders
- **position-service** (service) - Calculates and maintains current account positions
- **account-service** (service) - Manages trading accounts and user associations
- **reference-data-service** (service) - Provides security master and user directory information
- **notification-service** (service) - Distributes real-time updates to users

## Event Infrastructure
- **trade-event-bus** (network) - Message broker for trade lifecycle events (order submitted, executed, settled)
- **position-event-stream** (network) - Event stream for position updates
- **notification-event-stream** (network) - Event stream for user notifications

## Data Stores
- **account-database** (database) - Stores account and user association data
- **trade-database** (database) - Persists all trade records and audit trail
- **position-database** (database) - Stores current position snapshots
- **reference-database** (database) - Contains security master and user directory
- **event-store** (database) - Stores event history for event sourcing and replay

## Integration Points
- **market-data-feed** (system) - External market data provider for pricing
- **settlement-system** (system) - External settlement and clearing system

## Summary Statistics
Total Nodes: 17
- Actors: 2
- Webclients: 2
- Services: 6
- Networks: 3
- Databases: 5
- Systems: 2
EOF
cat /Users/jim/Desktop/finos/architecture-as-code/sandbox/trading-system-nodes.md

Based on the TraderX business context, here are **17 candidate CALM nodes** organized for an event-driven architecture:

## **External Actors (2)**
- **trader** (actor) - End users who submit and monitor trades
- **administrator** (actor) - System administrators who manage accounts and users

## **User-Facing Components (2)**
- **trading-ui** (webclient) - Web interface for trade submission and monitoring
- **admin-ui** (webclient) - Administrative interface for account and user management

## **Core Services (6)**
- **order-service** (service) - Processes trade order submissions and validations
- **execution-service** (service) - Executes validated trade orders
- **position-service** (service) - Calculates and maintains current account positions
- **account-service** (service) - Manages trading accounts and user associations
- **reference-data-service** (service) - Provides security master and user directory information
- **notification-service** (service) - Distributes real-time updates to users

## **Event Infrastructure (3)**
- **trade-event-bus** (network) - Message broker for trade lifecycle events (order submitted, executed, settled)
- **position-event-stream** (network) - Event stream for position updates
- **notification-event-stream** (network) - Event stream for user notifications

## **Data Stores (5)**
- **account-database** (database) - Stores account and user association data
- **trade-database** (database) - Persists all trade records and audit trail
- **position-database** (database) - Stores current position snapshots
- **reference-database** (database) - Contains security master and user directory
- **event-store** (database) - Stores event history for event sourcing and replay

## **Integration Points (2)**
- **market-data-feed** (system) - External market data provider for pricing
- **settlement-system** (system) - External settlement and clearing system

This event-driven architecture supports the key business workflows with asynchronous processing, real-time notifications, and proper separation of concerns between services.
```

