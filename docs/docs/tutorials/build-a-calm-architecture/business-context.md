---
id: business-context
title: Business Context
sidebar_position: 2
---

# Trading System

## Introduction

This document walks through practical examples of CALM architecture constructs that will be used to build the complete architecture for the application. Each section demonstrates how to model different aspects of the system—from nodes and interfaces to relationships and data flows—using CALM's declarative JSON-based language. By working through these examples, you'll learn how to capture the essential architectural elements of a real-world trading platform in a machine-readable format that can be validated, visualized, and analyzed.

The application used in this tutorial is based on [FINOS TraderX](https://github.com/finos/traderX)

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

---

**Note:** Throughout this guide, we will leverage CALM's AI Support to help build the application architecture, demonstrating how AI-assisted tools can accelerate and simplify the architectural modeling process.
