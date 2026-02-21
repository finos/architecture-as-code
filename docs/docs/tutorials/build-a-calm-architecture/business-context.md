---
id: business-context
title: Business Context
sidebar_position: 2
---

# Trading System

## Introduction

This document walks through practical examples of CALM architecture constructs that will be used to build the complete architecture for the application. Each section demonstrates how to model different aspects of the system—from nodes and interfaces to relationships and process flows—using CALM's declarative JSON-based language. By working through these examples, you'll learn how to capture the essential architectural elements of an application in a machine-readable format that can be validated, visualized, and analyzed.

The application used in this tutorial is based on [FINOS TraderX](https://github.com/finos/traderX)


## Core Business Functions 

### Trading Operations

**Order Submission.** Users submit buy and sell orders for securities, specifying quantities and other required trade details. This capability forms the primary interaction between users and the trading system.

**Account Selection.** Before executing trades, users select the trading account against which the transaction will be executed, ensuring that orders are associated with the correct portfolio and entitlements.

**Position Management.** The system tracks current holdings and quantities for each security within an account, maintaining an up-to-date view of positions as trades are executed and settled.

**Trade History.** A complete audit trail of all executed trades is maintained, allowing users and administrators to review historical activity for reporting, compliance, and analysis purposes.

---

### Account Administration

**Account Management.** The platform supports creating new trading accounts and updating existing accounts, allowing administrators to manage account lifecycle and configuration.

**User Association.** Multiple users can be linked to accounts to provide appropriate access and entitlements, enabling collaboration and shared account management.

**Account Inquiry.** Users can view account details and see which users are associated with each account, providing transparency into ownership and permissions.

---

### Reference Information

**Security Master.** The system maintains a list of tradeable securities, including stock tickers and associated company information, ensuring that trading operations reference consistent and validated instrument data.

**User Directory.** User profiles and contact information are stored in a centralized directory, supporting authentication, search, and account association workflows.

**Trade Data Store.** A central repository stores trading accounts, trades, and related data, providing persistent storage and enabling queries by downstream services.

---

### Real-time Information

**Trade Updates.** Users receive immediate notifications when trades execute, allowing them to monitor activity without manual refresh.

**Position Updates.** Account positions automatically refresh as trades settle, ensuring that holdings reflect the most recent state.

**Trade Status.** The system allows users to monitor the lifecycle of a trade from submission through execution and settlement, providing transparency into processing stages.

---

## Business Workflows 

### 1: Load List of Accounts

In this workflow, the Web GUI requests the list of accounts from the Account Service. The Account Service queries the Trade Data Store to retrieve all accounts, receives the result set, and then returns the list to the Web GUI for display. 

---

### 2: Bootstrapping the Trade and Position Blotter

To initialize the blotter, the Web GUI requests trades and positions for a selected account from the Position Service. The Position Service queries the Trade Data Store and returns the initial dataset. After initialization, the Web GUI subscribes to the Trade Feed so that live trade and position updates are published and displayed in real time. 

---

### 3: Submitting a Trade Ticket

When submitting a trade, the Web GUI first retrieves the list of valid tickers from the Security Master. The user submits a trade request containing account, ticker, side, and quantity to the Trade Service. The Trade Service validates the ticker with the Security Master and validates the account with the Account Service. After validation, the Trade Service publishes a new trade event to the Trade Feed and returns a completion response to the Web GUI. 

---

### 4: Trade Processing

Trade processing begins when the Trade Feed delivers a new trade event to the Trade Processor. The processor inserts the trade into the Trade Data Store and publishes an account-specific trade event. The Web GUI receives this event through the Trade Feed. The Trade Processor then marks the trade as executed, updates or inserts the corresponding position, and publishes additional trade and position updates, which are forwarded to the Web GUI. 

---

### 5: Add or Update Account

In this workflow, the Web GUI sends an account creation or update request to the Account Service. The Account Service writes the new or updated account information to the Trade Data Store and returns a success or failure response to the Web GUI. 

---

### 6: Add or Update Users to Account

To associate users with an account, the Web GUI first retrieves the current list of associated people from the Account Service, which queries the Trade Data Store. The GUI then searches for users through the People Service, which queries the User Directory and returns matching records. After a user is selected, the Web GUI requests that the Account Service add the user to the account. The Account Service validates the user and updates the account-user mapping in the Trade Data Store, returning a success or failure response. 

---

### 7: Security Master Bootstrap

During startup, the Security Master loads a ticker list from a CSV file. This file supplies the initial set of securities maintained by the service. When the Web GUI later requests the ticker list, the Security Master returns the loaded data. 

---

## Business Entities

### Core Domain Objects

**Account.** An account is a container for trades and positions and is uniquely identified so that transactions and holdings can be tracked accurately.

**Trade.** A trade represents a buy or sell transaction and includes details such as security, quantity, price, and timestamp.

**Position.** A position represents the current aggregate holding of a specific security within an account, calculated from executed trades.

**Security.** A security is a tradeable instrument, such as a stock, identified by a ticker symbol and associated company information.

**User.** A user is a person who can be associated with accounts and granted trading access.

---

### Business Relationships

Users and accounts have a many-to-many relationship, allowing multiple users to access the same account and a user to be linked to multiple accounts. Accounts contain many trades and positions, and each trade references exactly one account and one security. Positions aggregate trades for the same security within an account to provide a consolidated view of holdings. 

---

**Note:** Throughout this guide, we will leverage CALM's AI Support to help build the application architecture, demonstrating how AI-assisted tools can accelerate and simplify the architectural modeling process.
