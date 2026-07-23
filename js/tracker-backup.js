import { fmtDate } from "./tracker-dates.js";
import { saveLocal } from "./tracker-storage.js";
import { state } from "./tracker-state.js";

export function saveBackup() {
  const backup = {
    settings: state.settings,
    pointsData: state.pointsData,
    tasks: state.tasks,
    weeklyTasks: state.weeklyTasks,
    categories: state.categories,
    tokenUsage: state.tokenUsage
  };

  const blob = new Blob(
    [JSON.stringify(backup)],
    {
      type: "application/json"
    }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    `backup_${fmtDate(new Date())}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export function loadBackup(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const backup = JSON.parse(
        reader.result
      );

      state.settings =
        backup.settings || state.settings;

      state.pointsData =
        backup.pointsData || state.pointsData;

      state.tasks =
        backup.tasks || state.tasks;

      state.weeklyTasks =
        backup.weeklyTasks ||
        state.weeklyTasks;

      state.categories =
        backup.categories ||
        state.categories;

      state.tokenUsage =
        backup.tokenUsage ||
        state.tokenUsage;

      saveLocal();
      location.reload();
    } catch (error) {
      alert("Invalid backup file.");
    }
  };

  reader.readAsText(file);
}

export function clearAllData() {
  if (!confirm("Delete ALL local data?")) {
    return;
  }

  localStorage.clear();
  location.reload();
}
