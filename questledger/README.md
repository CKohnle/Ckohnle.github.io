# QuestLedger for GitHub Pages + Firebase

This package is a static website. You can put its files directly in a GitHub
Pages repository. Firebase Authentication identifies the user, and Cloud
Firestore stores each user's ledger separately so it follows the account across
browsers and devices.

## Included

- Clickable calendar
- Blue dates with unfinished quests
- Gold dates whose quests are all complete
- Black-and-gold outline around the selected date
- Quest bubbles and detail panel
- Add, edit, complete, undo, and delete quests
- One-time, daily, weekly, and monthly quests
- Gold awarded per recurring occurrence
- Add, edit, delete, and redeem rewards
- Redemption records saved in Firestore
- Google account authentication
- Live cloud synchronization
- Responsive desktop/mobile layout

## Files

```text
index.html
styles.css
app.js
firebase-config.js
favicon.svg
firestore.rules
README.md
```

## 1. Create or configure Firebase

1. Open https://console.firebase.google.com/ and select your existing project,
   or create one.
2. Open **Project settings → Your apps**.
3. Add a **Web app** if one does not already exist.
4. Copy the displayed `firebaseConfig` values.
5. Open `firebase-config.js` in this package and replace every placeholder.

The Firebase web configuration is intentionally public. It is an identifier,
not an administrator password. The supplied Firestore rules are what prevent
one signed-in user from reading another user's ledger.

## 2. Enable Google sign-in

1. In Firebase, open **Build → Authentication → Sign-in method**.
2. Enable **Google**.
3. Choose a project support email and save.
4. Open **Authentication → Settings → Authorized domains**.
5. Add `ckohnle.github.io`.

If you later use a custom domain, add that domain too.

## 3. Create Firestore and publish the rules

1. Open **Build → Firestore Database**.
2. Create the database in production mode.
3. Open the **Rules** tab.
4. Replace the rule editor contents with `firestore.rules` from this package.
5. Click **Publish**.

The app writes the account's state to:

```text
users/{firebaseUserUid}/questLedger/state
```

The supplied rule permits access only when the authenticated UID matches the
`userId` path segment.

## 4. Put the site on GitHub

### Replace the repository homepage

Upload all files in this folder to the root of your GitHub Pages repository.
The site will load at:

```text
https://ckohnle.github.io/
```

### Keep your current homepage and use `/questledger/`

Create a folder named `questledger` in the repository and upload all package
files inside it. The tracker will load at:

```text
https://ckohnle.github.io/questledger/
```

The relative file paths work in either location.

## 5. Enable GitHub Pages

1. In GitHub, open the repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the branch containing these files, usually `main`.
5. Select `/ (root)` and save.
6. Wait for GitHub Pages to finish deploying, then hard-refresh the site.

## 6. Test before trusting it

Run this checklist using two browsers or devices:

1. Sign in with Google.
2. Add a one-time quest and a recurring quest.
3. Complete each and verify the gold balance.
4. Refresh the page.
5. Sign in on a second device with the same Google account.
6. Confirm the same quests and gold appear.
7. Sign out, then sign in with a different Google account.
8. Confirm that the second account starts with an empty ledger.
9. Add and redeem a reward.
10. Undo a quest completion and confirm its gold is removed.

## Existing tracker data

This package deliberately does **not** automatically merge the old
`trackers/{uid}` document from the earlier tracker. Automatic merging risks
duplicating gold and completion rewards. The new schema is isolated under
`users/{uid}/questLedger/state`.

Keep the old tracker and its Firestore data until you have tested QuestLedger.
A controlled one-time importer can be added after the new app is working.

## Troubleshooting

- **The page is blank:** inspect the browser console. A placeholder left in
  `firebase-config.js` is the most likely cause.
- **Google says the domain is unauthorized:** add the exact GitHub Pages domain
  to Firebase Authentication's authorized domains.
- **Sign-in works but loading/saving fails:** publish `firestore.rules` and
  confirm Firestore exists in the same Firebase project as the configuration.
- **Changes do not appear immediately:** wait for “Synced” in the header and
  hard-refresh.
- **The CSS is missing:** confirm `styles.css` is beside `index.html`, including
  exact capitalization.

## Security boundary

Do not put Firebase Admin SDK keys, service-account JSON, passwords, or private
API keys in this repository. This frontend needs only the normal Firebase web
configuration. Authorization is enforced by the included Firestore rules.
