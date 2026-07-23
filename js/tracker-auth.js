import {
  auth,
  db,
  doc,
  getDoc,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect
} from "./tracker-firebase.js";

import { initUI } from "./tracker-render.js";

import {
  save,
  saveLocal
} from "./tracker-storage.js";

import { state } from "./tracker-state.js";

const loginButton =
  document.getElementById("login");

const status =
  document.getElementById("login-status");

let signingIn = false;

export function initializeAuthentication() {
  loginButton.addEventListener(
    "click",
    async () => {
      if (auth.currentUser) {
        await auth.signOut();
        return;
      }

      if (signingIn) {
        return;
      }

      signingIn = true;
      loginButton.disabled = true;

      const provider =
        new GoogleAuthProvider();

      try {
        await signInWithPopup(
          auth,
          provider
        );
      } catch (error) {
        const fallbackErrors = [
          "auth/popup-blocked",
          "auth/popup-closed-by-user",
          "auth/cancelled-popup-request",
          "auth/network-request-failed"
        ];

        if (
          fallbackErrors.includes(
            error.code
          )
        ) {
          await signInWithRedirect(
            auth,
            provider
          );

          return;
        }

        alert(
          `Sign-in failed: ${error.message}`
        );
      } finally {
        signingIn = false;
        loginButton.disabled = false;
      }
    }
  );

  onAuthStateChanged(
    auth,
    async user => {
      if (user) {
        loginButton.textContent =
          "↩️ Sign out";

        status.textContent =
          `(online – ${
            user.displayName || user.email
          })`;

        status.style.color = "#2a8f2a";

        const snapshot = await getDoc(
          doc(db, "trackers", user.uid)
        );

        if (snapshot.exists()) {
          const cloud = snapshot.data();

          Object.assign(
            state.settings,
            cloud.settings || {}
          );

          Object.assign(
            state.pointsData,
            cloud.pointsData || {}
          );

          Object.assign(
            state.tasks,
            cloud.tasks || {}
          );

          Object.assign(
            state.weeklyTasks,
            cloud.weeklyTasks || {}
          );

          Object.assign(
            state.categories,
            cloud.categories || {}
          );

          Object.assign(
            state.tokenUsage,
            cloud.tokenUsage || {}
          );
        } else {
          await save();
        }
      } else {
        loginButton.textContent =
          "🔒 Log in to sync";

        status.textContent = "(offline)";
        status.style.color = "#b00";
      }

      saveLocal();
      initUI();
    }
  );
}
