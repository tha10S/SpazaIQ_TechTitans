# SpazalIQ (Thabo's Mini Mart) — React Native Prototype

This is a working React Native (Expo) implementation of the SpazalIQ Figma prototype, covering:

- **Home** — dashboard with sales/profit/stock/credit stats, quick actions, weekly sales chart, low stock alert
- **Suppliers** — searchable supplier list with preset products
- **Orders** — order history with status badges and "Reorder Same" action

## Project structure

```
SpazalIQ/
├── App.js                     # Navigation setup (bottom tabs + stack)
├── theme.js                   # Shared colors, spacing, typography
├── package.json
└── screens/
    ├── HomeScreen.js
    ├── SuppliersOrdersScreen.js   # Suppliers + Orders (toggle tab)
    └── PlaceholderScreen.js       # For Stock / Sell / Credit / Insights (not designed yet)
```

## How to run it

You'll need [Node.js](https://nodejs.org/) and the **Expo Go** app on your phone (or an emulator).

1. Unzip this project and open a terminal in the `SpazalIQ` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npx expo start
   ```
4. Scan the QR code with the **Expo Go** app (Android) or the **Camera app** (iOS), or press `a` / `i` in the terminal to open an Android/iOS emulator.

## Navigation flow

- Bottom tabs: **Home, Stock, Sell, Credit, Insights**
- Only **Home** is fully built. Tapping **"Suppliers"** or **"Reorders"** on the Home screen pushes the **Suppliers/Orders** screen (with its own internal toggle), matching the Figma prototype.
- **Stock, Sell, Credit, Insights** are placeholder screens — swap in your teammates' screens as they finish their parts.

## Notes for your group

- All data is currently **mock data** at the top of each screen file (`stats`, `suppliers`, `orders` arrays). Replace these with real state/API calls when the backend is ready.
- Colors, spacing, and font sizes are centralized in `theme.js` — update there to keep the whole app consistent if the design changes.
- To add a new screen: create it in `screens/`, then register it in `App.js`.
