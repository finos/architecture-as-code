---
id: business-context
title: Business Context
sidebar_position: 1
---

# TraderX

## Introduction

This document walks through practical examples of CALM architecture constructs that will be used to build the complete architecture for the TraderX application. Each section demonstrates how to model different aspects of the system—from nodes and interfaces to relationships and data flows—using CALM's declarative JSON-based language. By working through these examples, you'll learn how to capture the essential architectural elements of a real-world trading platform in a machine-readable format that can be validated, visualized, and analyzed.

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

---

**Note:** Throughout this guide, we will leverage CALM's AI Support to help build the application architecture, demonstrating how AI-assisted tools can accelerate and simplify the architectural modeling process.
