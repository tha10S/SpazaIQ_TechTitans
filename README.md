<<<<<<< HEAD
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
=======
# SpazaIQ_TechTitans
DSW2B Semester 2 Project
>>>>>>> e92d48d23296c3ae43b3f9cf2301f5a7a297ed1a

## AI assistant setup

The Tech Titans Chat Bot supports text questions and screenshot analysis through Gemini's free tier. The Expo app calls the serverless endpoint in `api/assistant.js`; the Gemini key must be stored only on the deployment platform as `GEMINI_API_KEY`.

To deploy the secure assistant with Vercel:

1. Deploy this repository with Vercel.
2. Add `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.5-flash-lite` as server environment variables.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_ASSISTANT_API_URL` to the deployed `/api/assistant` URL.
4. Restart Expo. Other users only need the app and the shared assistant URL; they do not need their own Gemini key.

Never put `GEMINI_API_KEY` or `EXPO_PUBLIC_AI_API_KEY` in the Expo app or commit `.env`.

The assistant is available from Home, Stock, Sell, Credit, Suppliers, and Insights. Use the image button in the chat to attach a screenshot, then ask for trend or improvement analysis.
# SpazalIQ (Thabo's Mini Mart) — React Native Prototype

This is a working React Native (Expo) implementation of the SpazalIQ Figma prototype, covering:

- **Home** — dashboard with sales/profit/stock/credit stats, quick actions, weekly sales chart, low stock alert
- **Suppliers** — searchable supplier list with preset products
- **Orders** — order history with status badges and "Reorder Same" action

## Project structure