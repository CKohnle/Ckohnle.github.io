function readStoredValue(key, fallback) {
  const stored = localStorage.getItem(key);
  return stored === null ? fallback : JSON.parse(stored);
}

export const state = {
  settings: readStoredValue("settings", { weeklyTokens: 80 }),

  pointsData: readStoredValue("pointsData", {
    current: 0,
    totalEarned: 0,
    totalSpent: 0
  }),

  tasks: readStoredValue("tasks", {}),
  weeklyTasks: readStoredValue("weeklyTasks", {}),

  categories: readStoredValue("categories", [
    {
      name: "General",
      rewards: [],
      cap: 100
    }
  ]),

  tokenUsage: readStoredValue("tokenUsage", {}),

  selectedDate: null,
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear()
};
