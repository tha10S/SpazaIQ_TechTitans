# SpazaIQ TechTitans

Expo React Native shop management app using Firebase Authentication and Cloud Firestore.

## Run

```bash
npm install
npx expo start
```

For Windows PowerShell environments that block npm shims:

```powershell
npm.cmd start
```

## Firebase setup

1. Enable Email/Password authentication in Firebase Console.
2. Create a Firestore database.
3. Deploy the rules and indexes:

```bash
firebase deploy --only firestore
```

The app uses the authenticated Firebase user UID as the store ID. Store data lives under `stores/{uid}` and is seeded with realistic products and customer accounts on first sign-in.

## Chatbot configuration

- The assistant answers supported sales, product, inventory, and customer-credit questions locally from the signed-in user's Firestore records.
- No OpenAI/Gemini API key or Firebase Functions deployment is required to use those answers.
- The `mock-store-1` dataset is used only by chatbot tests; signed-in users read their own store through the Firestore repository and existing store security rules.

## Data workflows

- Products and stock load in realtime from Firestore.
- POS sales atomically decrement stock.
- Cash, card, credit, and split payments are supported.
- Credit sales create ledger transactions and optional repayment schedules.
- Customers with overdue balances or exceeded credit limits cannot receive new credit.
- Payments create negative ledger transactions and update customer balances.
- Operation keys make sale, credit, and payment retries idempotent.
- The assistant reads products, sales, customers, and credit transactions from Firestore.

## Project structure

- `app/`: application shell and navigation
- `config/`: theme and shared configuration
- `screens/auth/`: authentication screens
- `screens/`: app screens
- `services/firestore/`: Firestore repositories, mappers, paths, seed data, and assistant access
- `hooks/`: realtime data hooks
- `components/`: reusable UI components
- `firestore.rules`: store-scoped security rules
- `firestore.indexes.json`: required Firestore indexes

#DATASET ON INSIGHTS SCREEN
 the workflow is: 
when you edit data/sales_history.csv → run node scripts/parseCsvToInsights.js to reload the data on the application.