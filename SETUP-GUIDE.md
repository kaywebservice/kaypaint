# KayPaint — Setup Guide (do not lose this)

Everything needed to take the Plugin Market live with real payments.

## Status

| Item | Status |
|---|---|
| Creem account | NOT DONE (future) |
| Supabase | ABANDONED — free limit reached, skipped |
| Firebase project | DONE |
| Firebase rules | DONE |
| Web app registered (6 keys) | DONE |
| Email/Password auth | DONE |
| Firebase wired into app | DONE (by dev) |
| Test purchase loop | TODO (you) |

## 1. Firebase (done — account: kaypaint-d4252)

Project URL: https://console.firebase.google.com/project/kaypaint-d4252/overview

Config values already embedded in `lib/firebase.ts`:
- apiKey: AIzaSyAytTHFqbpOSWuA6EiSEJAqGaKbf9qskws
- authDomain: kaypaint-d4252.firebaseapp.com
- projectId: kaypaint-d4252
- storageBucket: kaypaint-d4252.firebasestorage.app
- messagingSenderId: 287431685710
- appId: 1:287431685710:web:ec201ca051eb8715f5b51f

## 2. How it works (recap)

- Sign in/out: Help > Sign In — real Firebase email+password, or tick "Create a new account"
- Purchases: Plugin Market "Complete Purchase" writes a license doc to Firestore `licenses/{uid}_{pluginId}` (simulated payment, no real money)
- Cross-device: sign in anywhere, licenses auto-sync
- Offline: localStorage cache still works; cloud merges on top
- Security: Firestore rules let users only read/write their own licenses

## 3. Test loop (TODO — 5 minutes)

1. Open kaypaint in the browser
2. Help > Sign In → email + password + tick "Create a new account"
3. Plugins > Plugin Market → buy any plugin (simulated checkout)
4. Firebase console → Firestore Database → `licenses` → your doc should appear
5. Open kaypaint in incognito, sign in with the same account → plugin shows as owned

## 4. Going live with Creem (future — wait for these)

1. Sign up at creem.io
2. Create one product per plugin (name + price) in Creem
3. Copy your Creem API secret key
4. Give the key to the dev → they wire:
   - Checkout link: Buy button → Creem hosted checkout
   - Webhook: Creem POSTs payment.completed → writes the same `licenses` doc in Firestore
   - Everything downstream already works

## 5. The 6 config values (in case anything breaks)

```
const firebaseConfig = {
  apiKey: "AIzaSyAytTHFqbpOSWuA6EiSEJAqGaKbf9qskws",
  authDomain: "kaypaint-d4252.firebaseapp.com",
  projectId: "kaypaint-d4252",
  storageBucket: "kaypaint-d4252.firebasestorage.app",
  messagingSenderId: "287431685710",
  appId: "1:287431685710:web:ec201ca051eb8715f5b51f",
};
```
