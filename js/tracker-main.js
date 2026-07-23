import {
  addCategory,
  addReward,
  addTask,
  buyReward,
  changeMonth,
  delTask,
  delWeeklyTask,
  removeCategory,
  selectDate,
  toggleDone,
  toggleWeeklyDone,
  updateSettings
} from "./tracker-actions.js";

import {
  clearAllData,
  loadBackup,
  saveBackup
} from "./tracker-backup.js";

import {
  initializeAuthentication
} from "./tracker-auth.js";

import { fmtDate } from "./tracker-dates.js";

import {
  initUI,
  renderShop
} from "./tracker-render.js";

import { state } from "./tracker-state.js";

state.selectedDate = fmtDate(new Date());

Object.assign(window, {
  addTask,
  toggleDone,
  delTask,
  toggleWeeklyDone,
  delWeeklyTask,
  addCategory,
  removeCategory,
  addReward,
  buyReward,
  updateSettings,
  saveBackup,
  loadBackup,
  clearAllData,
  changeMonth,
  selectDate,
  renderShop
});

initializeAuthentication();

window.addEventListener(
  "load",
  initUI
);
