import {
  exerciseCapHrs,
  signifRate
} from "./tracker-config.js";

import {
  weekId,
  weekKeySunday
} from "./tracker-dates.js";

import {
  renderCalendar,
  renderCategoryUI,
  renderShop,
  renderTaskTable,
  renderWeeklyTasks,
  updatePointsDisplay,
  updateTokenBar
} from "./tracker-render.js";

import { save } from "./tracker-storage.js";
import { state } from "./tracker-state.js";

function tasksOfWeek(category, week) {
  let hours = 0;

  for (const date in state.tasks) {
    if (weekId(date) !== week) {
      continue;
    }

    state.tasks[date].forEach(task => {
      if (
        task.done &&
        task.cat === category
      ) {
        hours += task.dur || 0;
      }
    });
  }

  return hours;
}

export async function addTask() {
  const description =
    document.getElementById(
      "new-task-desc"
    ).value.trim();

  if (!description) {
    return alert("Enter description");
  }

  const scope =
    document.getElementById(
      "new-task-scope"
    ).value;

  const significance =
    document.getElementById(
      "new-task-signif"
    ).value;

  const category =
    document.getElementById(
      "new-task-cat"
    ).value;

  if (scope === "daily") {
    state.tasks[state.selectedDate] =
      state.tasks[state.selectedDate] || [];

    state.tasks[state.selectedDate].push({
      desc: description,
      signif: significance,
      cat: category,
      done: false,
      dur: 0
    });
  } else {
    const weekKey =
      weekKeySunday(state.selectedDate);

    state.weeklyTasks[weekKey] =
      state.weeklyTasks[weekKey] || [];

    state.weeklyTasks[weekKey].push({
      desc: description,
      cat: category,
      done: false
    });
  }

  document.getElementById(
    "new-task-desc"
  ).value = "";

  await save();

  renderTaskTable();
  renderWeeklyTasks();
}

export async function toggleDone(
  index,
  checkbox
) {
  const task =
    state.tasks[state.selectedDate][index];

  const selectedWeek =
    weekId(state.selectedDate);

  if (!task.done) {
    const minutes = parseFloat(
      prompt("Minutes spent?", "60")
    );

    if (
      Number.isNaN(minutes) ||
      minutes <= 0
    ) {
      checkbox.checked = false;
      return;
    }

    const hours = minutes / 60;

    const spent =
      signifRate[task.signif] * hours;

    state.tokenUsage[selectedWeek] =
      (state.tokenUsage[selectedWeek] || 0) +
      spent;

    const category = state.categories.find(
      item => item.name === task.cat
    );

    let categorySpent = 0;

    for (const date in state.tasks) {
      if (weekId(date) !== selectedWeek) {
        continue;
      }

      state.tasks[date].forEach(item => {
        if (
          item.done &&
          item.cat === task.cat
        ) {
          categorySpent += item.spent || 0;
        }
      });
    }

    if (
      category &&
      categorySpent + spent > category.cap
    ) {
      alert(
        `⚠️ Cap for ${task.cat} ` +
        `(${category.cap} Ŧ) exceeded`
      );
    }

    if (
      task.cat === "Exercise" &&
      tasksOfWeek(
        "Exercise",
        selectedWeek
      ) + hours > exerciseCapHrs
    ) {
      alert(
        "Exercise cap (10 h/wk) exceeded!"
      );
    }

    state.pointsData.current += spent;
    state.pointsData.totalEarned += spent;

    Object.assign(task, {
      done: true,
      dur: hours,
      spent
    });
  } else {
    state.tokenUsage[selectedWeek] -=
      task.spent || 0;

    state.pointsData.current -=
      task.spent || 0;

    state.pointsData.totalEarned -=
      task.spent || 0;

    task.done = false;
    task.spent = 0;
    task.dur = 0;
  }

  await save();

  renderTaskTable();
  updateTokenBar();
  updatePointsDisplay();
  renderShop();
  renderCategoryUI();
}

export async function toggleWeeklyDone(
  index,
  checkbox
) {
  const weekKey =
    weekKeySunday(state.selectedDate);

  const task =
    (state.weeklyTasks[weekKey] || [])[index];

  if (!task) {
    return;
  }

  task.done = checkbox.checked;

  await save();
  renderWeeklyTasks();
}

export async function delTask(index) {
  state.tasks[state.selectedDate].splice(
    index,
    1
  );

  await save();
  renderTaskTable();
}

export async function delWeeklyTask(index) {
  const weekKey =
    weekKeySunday(state.selectedDate);

  (state.weeklyTasks[weekKey] || []).splice(
    index,
    1
  );

  await save();
  renderWeeklyTasks();
}

export async function addCategory() {
  const name =
    document.getElementById(
      "new-cat-name"
    ).value.trim();

  if (!name) {
    return;
  }

  if (
    state.categories.some(
      category => category.name === name
    )
  ) {
    return alert("Exists!");
  }

  const cap = parseFloat(
    prompt(`Weekly Ŧ cap for "${name}"?`)
  );

  if (
    Number.isNaN(cap) ||
    cap <= 0
  ) {
    return alert("Invalid cap");
  }

  state.categories.push({
    name,
    rewards: [],
    cap
  });

  document.getElementById(
    "new-cat-name"
  ).value = "";

  await save();
  renderCategoryUI();
}

export async function removeCategory() {
  const name =
    document.getElementById(
      "remove-cat-select"
    ).value;

  if (
    !name ||
    !confirm(`Delete ${name} ?`)
  ) {
    return;
  }

  state.categories =
    state.categories.filter(
      category => category.name !== name
    );

  for (const date in state.tasks) {
    state.tasks[date] =
      state.tasks[date].filter(
        task => task.cat !== name
      );
  }

  for (const week in state.weeklyTasks) {
    state.weeklyTasks[week] =
      state.weeklyTasks[week].filter(
        task => task.cat !== name
      );
  }

  await save();

  renderTaskTable();
  renderWeeklyTasks();
  renderCategoryUI();
}

export async function addReward() {
  const categoryName =
    document.getElementById(
      "shop-cat-select"
    ).value;

  const description =
    document.getElementById(
      "new-reward-desc"
    ).value.trim();

  const cost = parseInt(
    document.getElementById(
      "new-reward-cost"
    ).value
  );

  if (!description || !cost) {
    return alert("Need desc & cost");
  }

  state.categories
    .find(
      category =>
        category.name === categoryName
    )
    .rewards.push({
      desc: description,
      cost
    });

  document.getElementById(
    "new-reward-desc"
  ).value = "";

  document.getElementById(
    "new-reward-cost"
  ).value = "";

  await save();
  renderShop();
}

export async function buyReward(
  categoryName,
  index
) {
  const category = state.categories.find(
    item => item.name === categoryName
  );

  const reward = category.rewards[index];

  if (
    state.pointsData.current < reward.cost
  ) {
    return alert("Not enough ₱");
  }

  if (
    !confirm(
      `Redeem "${reward.desc}" for ` +
      `${reward.cost} ₱ ?`
    )
  ) {
    return;
  }

  state.pointsData.current -= reward.cost;
  state.pointsData.totalSpent += reward.cost;

  await save();

  updatePointsDisplay();
  renderShop();

  alert(`Enjoy: ${reward.desc}!`);
}

export async function updateSettings() {
  state.settings.weeklyTokens =
    parseInt(
      document.getElementById(
        "weekly-tokens-input"
      ).value
    ) || state.settings.weeklyTokens;

  await save();
  updateTokenBar();
}

export function changeMonth(offset) {
  state.calendarMonth += offset;

  if (state.calendarMonth < 0) {
    state.calendarMonth = 11;
    state.calendarYear -= 1;
  }

  if (state.calendarMonth > 11) {
    state.calendarMonth = 0;
    state.calendarYear += 1;
  }

  renderCalendar();
}

export function selectDate(date) {
  state.selectedDate = date;

  document.getElementById(
    "date-today"
  ).textContent = date;

  renderCalendar();
  renderTaskTable();
  renderWeeklyTasks();
  updateTokenBar();
  renderCategoryUI();
}
