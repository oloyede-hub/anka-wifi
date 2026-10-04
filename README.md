# Anka WiFi

Anka WiFi is a full-stack Wi-Fi access management platform for selling internet packages, processing online payments, and securely distributing Wi-Fi access codes to customers.

The platform digitizes the process of selling prepaid Wi-Fi access codes. Customers can select an available internet package, provide their contact information, complete payment through Paystack, and receive an access code after the payment has been successfully verified.

## Overview

The traditional workflow involves generating Wi-Fi access codes, printing them, and selling them manually.

Anka WiFi moves this process online:

1. Customer selects a Wi-Fi package.
2. Customer provides their phone number and email address.
3. The system creates a pending purchase.
4. An available access code is temporarily reserved.
5. Payment is initialized through Paystack.
6. The customer completes payment.
7. The backend independently verifies the payment.
8. The purchase is completed.
9. The reserved access code is marked as sold and delivered to the customer.

Customers do not need to create an account before purchasing access.

## Features

### Customer

- Browse available Wi-Fi packages
- Purchase daily, weekly, or monthly packages
- Pay securely through Paystack
- Receive an access code after successful payment verification
- No customer account required

### Wi-Fi Package Management

- Create and manage Wi-Fi packages
- Daily, weekly, and monthly package types
- Activate or deactivate packages
- Server-controlled pricing

### Access Code Management

- Add individual access codes
- Bulk upload access codes
- Associate codes with specific packages
- Track code state:
  - Available
  - Reserved
  - Sold
  - Disabled
- Temporary checkout reservation
- Protection against concurrent customers claiming the same code

### Payments

- Paystack transaction initialization
- Server-side payment verification
- Multiple payment attempts per purchase
- Unique transaction references
- Amount and currency verification
- Payment API timeout handling
- Protection against duplicate payment fulfillment
- Atomic payment fulfillment

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript

### Backend

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- `class-validator`
- `class-transformer`

### Payments

- Paystack

### Development

- pnpm
- Turborepo
- Vitest
- ESLint / Oxlint
- Prettier

## Project Structure

```text
anka-wifi/
├── apps/
│   ├── api/                  # NestJS backend
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── access-codes/
│   │   │   ├── packages/
│   │   │   ├── payments/
│   │   │   ├── prisma/
│   │   │   └── purchases/
│   │   └── test/
│   │
│   └── web/                  # Next.js frontend
│       ├── public/
│       └── src/
│           └── app/
│
├── packages/                 # Shared monorepo packages
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── turbo.json
```

## Core Domain

### Wi-Fi Package

Represents an internet package available for purchase.

Package types:

```text
DAILY
WEEKLY
MONTHLY
```

Packages can be either active or inactive.

### Access Code

Represents a prepaid Wi-Fi access code associated with a package.

An access code moves through the following states:

```text
AVAILABLE
    ↓
RESERVED
    ↓
SOLD
```

A code may also be disabled by the administrator.

`RESERVED` means the code has temporarily been assigned to an active checkout. It does not represent the validity period of the customer's internet access.

### Purchase

Represents what a customer is attempting to buy.

A purchase stores information such as:

- Customer
- Package
- Purchase amount
- Purchase reference
- Reserved access code
- Purchase status

### Payment

Represents an attempt to pay for a purchase.

A single purchase can have multiple payment attempts:

```text
Purchase ANK-001
│
├── PAY-001 — Failed
├── PAY-002 — Failed
└── PAY-003 — Successful
```

This separation allows failed or interrupted payment attempts to be handled without creating duplicate purchases.

## Payment Architecture

The frontend is never trusted to determine the amount a customer should pay.

Instead:

```text
Customer
   ↓
Select Package
   ↓
Backend loads package price
   ↓
Create Purchase
   ↓
Reserve Access Code
   ↓
Create Payment Attempt
   ↓
Initialize Paystack
   ↓
Customer Pays
   ↓
Backend Verifies with Paystack
   ↓
Fulfill Purchase
```

After successful verification, the backend atomically performs:

```text
Payment    → SUCCESSFUL
Purchase   → COMPLETED
AccessCode → SOLD
```

The access code is only returned after successful payment verification.

## Payment Safety

The payment implementation is designed around several important principles.

### Server-Controlled Pricing

The client does not determine the payment amount.

The backend retrieves the price directly from the package stored in PostgreSQL.

### Payment Verification

A browser redirect is not considered proof of payment.

The backend independently verifies the transaction with Paystack and validates:

- Transaction status
- Transaction reference
- Amount
- Currency

### Concurrency Protection

Database transactions and PostgreSQL locking are used to prevent simultaneous requests from incorrectly modifying the same purchase or assigning the same access code to multiple customers.

### Idempotent Fulfillment

Processing the same successful payment multiple times does not result in multiple access codes being sold.

For example:

```text
First verification
→ Purchase completed
→ Code 12345678 sold

Second verification
→ Purchase already completed
→ Return the same result
```

### Money Handling

Monetary values are stored using PostgreSQL/Prisma decimal values rather than floating-point values.

Amounts are converted to Paystack's subunit before transaction initialization.

For example:

```text
₦2,500.00
     ↓
250000 kobo
```

## Getting Started

### Prerequisites

Make sure the following are installed:

- Node.js
- pnpm
- PostgreSQL

### Clone the Repository

```bash
git clone <repository-url>
cd anka-wifi
```

### Install Dependencies

From the monorepo root:

```bash
pnpm install
```

## Environment Variables

Create a `.env` file in the project root.

Example:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/anka_wifi?schema=public"

PAYSTACK_SECRET_KEY="your_paystack_secret_key"
PAYSTACK_PUBLIC_KEY="your_paystack_public_key"
PAYSTACK_BASE_URL="https://api.paystack.co"

FRONTEND_URL="http://localhost:3000"
API_URL="http://localhost:4000"
```

Never commit your actual `.env` file.

An example environment file is available in the API project.

## Database Setup

The project uses PostgreSQL with Prisma.

From `apps/api`:

```bash
pnpm exec prisma validate
```

Apply database migrations:

```bash
pnpm exec prisma migrate dev
```

Generate the Prisma client:

```bash
pnpm exec prisma generate
```

## Running the Application

From the monorepo root:

```bash
pnpm dev
```

The applications run locally at:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:4000
```

## Testing

The backend contains unit and integration tests covering areas including:

- Package management
- Purchase creation
- Access-code reservation
- Payment initialization
- Payment verification
- Concurrent requests
- Database rollback behavior
- Paystack response handling

Run the configured test commands from the API workspace.

## Security

Sensitive information such as the Paystack secret key and database credentials must remain server-side.

The `.env` file is excluded from Git.

The backend also validates incoming requests and prevents clients from directly controlling sensitive fields such as:

- Payment amount
- Payment status
- Purchase status
- Access-code status
- Reservation timestamps
- Payment references
- Completion timestamps

## Current Development Status

The core backend currently includes:

- Wi-Fi package management
- Access-code management
- Bulk access-code creation
- Purchase creation
- Access-code reservation
- Paystack payment initialization
- Paystack payment verification
- Concurrent purchase/payment protection
- Atomic payment fulfillment
- Automated backend tests

The project is actively under development.

Planned work includes:

- Paystack webhook processing
- Payment reconciliation and failure recovery
- Reservation expiry/recovery
- Public API rate limiting
- Admin authentication and management interface
- Customer-facing purchase interface
- Deployment and production configuration

## Design Principle

Anka WiFi follows one important payment rule:

> **Confirm the money before delivering the value.**

A customer receives a Wi-Fi access code only after the backend has independently confirmed that payment was successful.

## License

This project is currently maintained as a private/proprietary project unless otherwise specified.