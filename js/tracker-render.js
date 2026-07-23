import { signifRate } from "./tracker-config.js";

import {
  fmtDate,
  weekId,
  weekKeySunday,
  weekRangeSundayToSaturday
} from "./tracker-dates.js";

import { state } from "./tracker-state.js";

export function renderCalendar() {
  const first = new Date(
    state.calendarYear,
    state.calendarMonth,
    1
  );

  const days = new Date(
    state.calendarYear,
    state.calendarMonth + 1,
    0
  ).getDate();

  document.getElementById(
    "calendar-month-year"
  ).textContent =
    `${first.toLocaleString("default", {
      month: "long"
    })} ${state.calendarYear}`;

  let html = `
    <table>
      <tr>
        ${[
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat"
        ]
          .map(day => `<th>${day}</th>`)
          .join("")}
      </tr>
      <tr>
  `;

  for (let i = 0; i < first.getDay(); i += 1) {
    html += "<td></td>";
  }

  for (let day = 1; day <= days; day += 1) {
    const current = fmtDate(
      new Date(
        state.calendarYear,
        state.calendarMonth,
        day
      )
    );

    if (
      (first.getDay() + day - 1) % 7 === 0 &&
      day !== 1
    ) {
      html += "</tr><tr>";
    }

    let style = "";
    const today = fmtDate(new Date());

    if (
      current === state.selectedDate &&
      current === today
    ) {
      style =
        "background:linear-gradient(to bottom right,#3399ff 50%,#ff4444 50%);color:#fff;";
    } else if (current === state.selectedDate) {
      style = "background:#ff4444;color:#fff;";
    } else if (current === today) {
      style = "background:#3399ff;color:#fff;";
    }

    html += `
      <td
        style="${style}"
        onclick="selectDate('${current}')"
      >
        ${day}
      </td>
    `;
  }

  document.getElementById(
    "calendar"
  ).innerHTML = `${html}</tr></table>`;
}

export function renderTaskTable() {
  const table = document.getElementById("task-table");

  table.innerHTML = `
    <tr>
      <th>Task</th>
      <th>Signif</th>
      <th>Cat</th>
      <th>Ŧ/h</th>
      <th>Done?</th>
      <th>Del</th>
    </tr>
  `;

  (state.tasks[state.selectedDate] || []).forEach(
    (task, index) => {
      table.innerHTML += `
        <tr>
          <td class="${
            task.done ? "task-completed" : ""
          }">
            ${task.desc}
          </td>

          <td>${task.signif}</td>
          <td>${task.cat}</td>
          <td>${signifRate[task.signif]}</td>

          <td>
            <input
              type="checkbox"
              ${task.done ? "checked" : ""}
              onchange="toggleDone(${index},this)"
            >
          </td>

          <td>
            <button onclick="delTask(${index})">
              x
            </button>
          </td>
        </tr>
      `;
    }
  );
}

export function renderWeeklyTasks() {
  const weekKey = weekKeySunday(state.selectedDate);

  document.getElementById(
    "weekly-header"
  ).textContent =
    `Weekly Tasks (${weekRangeSundayToSaturday(
      state.selectedDate
    )})`;

  const table = document.getElementById(
    "weekly-task-table"
  );

  table.innerHTML = `
    <tr>
      <th>Task</th>
      <th>Cat</th>
      <th>Done?</th>
      <th>Del</th>
    </tr>
  `;

  (state.weeklyTasks[weekKey] || []).forEach(
    (task, index) => {
      table.innerHTML += `
        <tr>
          <td class="${
            task.done ? "task-completed" : ""
          }">
            ${task.desc}
          </td>

          <td>${task.cat || ""}</td>

          <td>
            <input
              type="checkbox"
              ${task.done ? "checked" : ""}
              onchange="toggleWeeklyDone(${index},this)"
            >
          </td>

          <td>
            <button
              onclick="delWeeklyTask(${index})"
            >
              x
            </button>
          </td>
        </tr>
      `;
    }
  );
}

export function renderCategoryUI() {
  const taskCategory =
    document.getElementById("new-task-cat");

  const removeCategory =
    document.getElementById("remove-cat-select");

  const shopCategory =
    document.getElementById("shop-cat-select");

  [
    taskCategory,
    removeCategory,
    shopCategory
  ].forEach(select => {
    select.innerHTML = "";
  });

  state.categories.forEach(category => {
    taskCategory.insertAdjacentHTML(
      "beforeend",
      `<option>${category.name}</option>`
    );

    shopCategory.insertAdjacentHTML(
      "beforeend",
      `<option>${category.name}</option>`
    );

    if (category.name !== "General") {
      removeCategory.insertAdjacentHTML(
        "beforeend",
        `<option>${category.name}</option>`
      );
    }
  });

  const progress =
    document.getElementById("progress-container");

  progress.innerHTML = "";

  const selectedWeek = weekId(state.selectedDate);

  state.categories.forEach(category => {
    let spent = 0;

    for (const date in state.tasks) {
      if (weekId(date) !== selectedWeek) {
        continue;
      }

      state.tasks[date].forEach(task => {
        if (
          task.done &&
          task.cat === category.name
        ) {
          spent += task.spent || 0;
        }
      });
    }

    const cap = category.cap || 100;

    const percentage = Math.min(
      100,
      (spent / cap * 100).toFixed(1)
    );

    progress.innerHTML += `
      <div class="progress-wrapper">
        <span class="progress-label">
          ${category.name}
        </span>

        <div class="progress-bar">
          <div
            class="progress-fill${
              spent > cap ? " over" : ""
            }"
            style="width:${percentage}%"
          ></div>

          <div class="progress-text">
            ${spent.toFixed(1)} / ${cap} Ŧ
          </div>
        </div>
      </div>
    `;
  });

  renderShop();
}

export function renderShop() {
  const selectedName =
    document.getElementById(
      "shop-cat-select"
    ).value || state.categories[0].name;

  const category = state.categories.find(
    item => item.name === selectedName
  );

  document.getElementById(
    "shop-title"
  ).textContent =
    `Reward Shop (${selectedName}) – ₱: ` +
    `${state.pointsData.current.toFixed(1)} ` +
    `(Spent: ${state.pointsData.totalSpent.toFixed(1)})`;

  const list = document.getElementById("shop-list");
  list.innerHTML = "";

  category.rewards.forEach((reward, index) => {
    list.innerHTML += `
      <div class="flex">
        <span style="flex:1">
          ${reward.desc} –
          <b>${reward.cost} ₱</b>
        </span>

        <button
          onclick="buyReward('${selectedName}',${index})"
        >
          Buy
        </button>
      </div>
    `;
  });
}

export function updateTokenBar() {
  const selectedWeek = weekId(state.selectedDate);
  const used = state.tokenUsage[selectedWeek] || 0;

  const percentage = Math.min(
    100,
    (
      used /
      state.settings.weeklyTokens *
      100
    ).toFixed(1)
  );

  const fill = document.getElementById(
    "token-week-fill"
  );

  fill.style.width = `${percentage}%`;

  fill.className =
    `token-week-fill${
      used > state.settings.weeklyTokens
        ? " over"
        : ""
    }`;

  document.getElementById(
    "token-week-label"
  ).textContent = `${percentage} %`;

  document.getElementById(
    "token-week-text"
  ).textContent =
    `Ŧ Used: ${used.toFixed(1)} / ` +
    `${state.settings.weeklyTokens}`;
}

export function updatePointsDisplay() {
  document.getElementById(
    "points-current"
  ).textContent =
    state.pointsData.current.toFixed(1);

  document.getElementById(
    "points-earned"
  ).textContent =
    state.pointsData.totalEarned.toFixed(1);

  document.getElementById(
    "points-spent"
  ).textContent =
    state.pointsData.totalSpent.toFixed(1);
}

export function initUI() {
  const weekly = document.getElementById(
    "weekly-tokens-input"
  );

  if (weekly) {
    weekly.value = state.settings.weeklyTokens;
  }

  document.getElementById(
    "date-today"
  ).textContent = state.selectedDate;

  renderCalendar();
  renderCategoryUI();
  renderTaskTable();
  renderWeeklyTasks();
  updateTokenBar();
  updatePointsDisplay();
  renderShop();
}
