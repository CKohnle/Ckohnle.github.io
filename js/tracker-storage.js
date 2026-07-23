import { state } from "./tracker-state.js";
import {
  auth,
  db,
  doc,
  setDoc
} from "./tracker-firebase.js";

export function saveLocal() {
  localStorage.setItem(
    "settings",
    JSON.stringify(state.settings)
  );

  localStorage.setItem(
    "pointsData",
    JSON.stringify(state.pointsData)
  );

  localStorage.setItem(
    "tasks",
    JSON.stringify(state.tasks)
  );

  localStorage.setItem(
    "weeklyTasks",
    JSON.stringify(state.weeklyTasks)
  );

  localStorage.setItem(
    "categories",
    JSON.stringify(state.categories)
  );

  localStorage.setItem(
    "tokenUsage",
    JSON.stringify(state.tokenUsage)
  );
}

export async function save() {
  saveLocal();

  if (!auth.currentUser) {
    return;
  }

  await setDoc(
    doc(db, "trackers", auth.currentUser.uid),
    {
      settings: state.settings,
      pointsData: state.pointsData,
      tasks: state.tasks,
      weeklyTasks: state.weeklyTasks,
      categories: state.categories,
      tokenUsage: state.tokenUsage,
      lastUpdated: new Date()
    },
    {
      merge: true
    }
  );
}
