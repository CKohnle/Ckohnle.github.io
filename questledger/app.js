import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup,
  signInWithRedirect, signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  doc, getFirestore, onSnapshot, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const emptyState = () => ({
  schemaVersion: 1, gold: 0, quests: [], rewards: [], redemptions: [],
  categories: ["General", "Research", "Study", "Health", "Admin", "Personal"]
});

let state = emptyState();
let selectedDate = formatKey(new Date());
let visibleMonth = new Date();
let activeQuestId = null;
let currentUser = null;
let unsubscribe = null;
let saveTimer = null;
let applyingRemote = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

function formatKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseKey(key) { return new Date(`${key}T12:00:00`); }
function prettyDate(key) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(parseKey(key));
}
function toast(message) {
  const node = $("#toast"); node.textContent = message; node.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2800);
}
function normalizeRemote(data) {
  const base = emptyState();
  return {
    ...base, ...data,
    quests: Array.isArray(data?.quests) ? data.quests : [],
    rewards: Array.isArray(data?.rewards) ? data.rewards : [],
    redemptions: Array.isArray(data?.redemptions) ? data.redemptions : [],
    categories: Array.isArray(data?.categories) ? data.categories : base.categories,
    gold: Number(data?.gold) || 0
  };
}
function recurrenceMatches(quest, dateKey) {
  if (dateKey < quest.date) return false;
  if (quest.recurrence === "none") return quest.date === dateKey;
  const start = parseKey(quest.date), date = parseKey(dateKey);
  if (quest.recurrence === "daily") return true;
  if (quest.recurrence === "weekly") return start.getDay() === date.getDay();
  if (quest.recurrence === "monthly") return start.getDate() === date.getDate();
  return false;
}
function isComplete(quest, dateKey) {
  return quest.recurrence === "none" ? Boolean(quest.complete) : Boolean(quest.completedDates?.includes(dateKey));
}
function questsForDate(dateKey) { return state.quests.filter(q => recurrenceMatches(q, dateKey)); }
function scheduleSave() {
  if (!currentUser || applyingRemote) return;
  $("#sync-status").textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 350);
}
async function saveNow() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, "users", currentUser.uid, "questLedger", "state"), {
      ...state, ownerUid: currentUser.uid, updatedAt: serverTimestamp()
    });
    $("#sync-status").textContent = "Synced";
  } catch (error) {
    console.error(error); $("#sync-status").textContent = "Sync failed"; toast("Cloud save failed. Check Firestore rules and your connection.");
  }
}

function render() {
  const dayQuests = questsForDate(selectedDate);
  $("#selected-date-heading").textContent = prettyDate(selectedDate);
  const openCount = dayQuests.filter(q => !isComplete(q, selectedDate)).length;
  $("#day-status").textContent = !dayQuests.length ? "No quests" : openCount ? `${openCount} open` : "Day complete";
  $("#gold-balance").textContent = state.gold.toLocaleString();

  $("#quests").innerHTML = dayQuests.length ? dayQuests.map(q => `
    <button class="quest-pill ${isComplete(q, selectedDate) ? "complete" : ""}" data-open-quest="${escapeHtml(q.id)}">
      <span class="quest-check">${isComplete(q, selectedDate) ? "✓" : ""}</span>
      <span class="quest-copy"><strong>${escapeHtml(q.title)}</strong><small>${escapeHtml(q.importance)} · ${escapeHtml(q.category)}</small></span>
      <span class="quest-gold">◉ ${Number(q.reward).toLocaleString()}</span>
    </button>`).join("") : `<button class="empty-quest" id="empty-add">No quests are recorded for this day. Add one +</button>`;

  renderCalendar();
  renderDetail();
  renderRewards();
  $("#category-list").innerHTML = state.categories.map(c => `<option value="${escapeHtml(c)}"></option>`).join("");
}

function renderCalendar() {
  $("#month-heading").textContent = visibleMonth.toLocaleString("en-US", { month: "long", year: "numeric" });
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  $("#calendar-grid").innerHTML = days.map(day => {
    const key = formatKey(day), items = questsForDate(key);
    const status = items.length ? (items.every(q => isComplete(q, key)) ? "done" : "open") : "";
    const muted = day.getMonth() !== visibleMonth.getMonth() ? "muted" : "";
    const selected = key === selectedDate ? "selected" : "";
    return `<button class="${muted} ${selected} ${status}" data-date="${key}" aria-label="${escapeHtml(prettyDate(key))}${status === "open" ? ", unfinished quests" : status === "done" ? ", completed quests only" : ""}"><span>${day.getDate()}</span>${status ? "<i></i>" : ""}</button>`;
  }).join("");
}

function renderDetail() {
  const quest = state.quests.find(q => q.id === activeQuestId);
  if (!quest || !recurrenceMatches(quest, selectedDate)) {
    $("#quest-detail").innerHTML = `<div class="detail-empty"><span>✦</span><h2>Select a quest</h2><p>Choose a quest bubble to inspect its full ledger entry.</p></div>`;
    return;
  }
  const complete = isComplete(quest, selectedDate);
  const stars = "✦".repeat(["Low", "Medium", "High", "Critical"].indexOf(quest.importance) + 1);
  const schedule = ({ none: "One time", daily: "Daily", weekly: "Weekly", monthly: "Monthly" })[quest.recurrence] || "One time";
  $("#quest-detail").innerHTML = `
    <button class="close-card" id="close-detail" aria-label="Close details">×</button>
    <p class="eyebrow">Quest details</p><h2>${escapeHtml(quest.title)}</h2>
    <p class="description">${escapeHtml(quest.description)}</p>
    <dl>
      <div><dt>Importance</dt><dd class="stars">${stars}</dd></div>
      <div><dt>Category</dt><dd>${escapeHtml(quest.category)}</dd></div>
      <div><dt>Gold reward</dt><dd class="gold-text">◉ ${Number(quest.reward).toLocaleString()}</dd></div>
      <div><dt>Schedule</dt><dd>${schedule}</dd></div>
      <div><dt>Status</dt><dd>${complete ? "Complete" : "In progress"}</dd></div>
    </dl>
    <div class="detail-actions">
      <button class="complete-button" id="toggle-complete">${complete ? `Undo completion · −${quest.reward} gold` : `Complete quest · +${quest.reward} gold`}</button>
      <button class="small-button" id="edit-quest">Edit</button>
      <button class="small-button danger" id="delete-quest">Delete</button>
    </div>`;
}

function renderRewards() {
  $("#reward-list").innerHTML = state.rewards.length ? state.rewards.map(reward => `
    <article class="reward">
      <div class="reward-icon">${escapeHtml(reward.icon || "✦")}</div>
      <div><h3>${escapeHtml(reward.name)}</h3><p>${escapeHtml(reward.description)}</p><b>◉ ${Number(reward.cost).toLocaleString()}</b></div>
      <div class="reward-actions">
        <button data-redeem="${escapeHtml(reward.id)}" ${state.gold < reward.cost ? "disabled" : ""}>Redeem</button>
        <button class="small-button" data-edit-reward="${escapeHtml(reward.id)}">Edit</button>
        <button class="small-button danger" data-delete-reward="${escapeHtml(reward.id)}">Delete</button>
      </div>
    </article>`).join("") : `<p class="description">No rewards yet. Add something worth working toward.</p>`;
}

function openQuestForm(quest = null) {
  const form = $("#quest-form"); form.reset();
  $("#quest-form-title").textContent = quest ? "Edit Quest" : "Add a Quest";
  form.elements.id.value = quest?.id || "";
  form.elements.title.value = quest?.title || "";
  form.elements.description.value = quest?.description || "";
  form.elements.date.value = quest?.date || selectedDate;
  form.elements.reward.value = quest?.reward || 50;
  form.elements.importance.value = quest?.importance || "Medium";
  form.elements.category.value = quest?.category || "General";
  form.elements.recurrence.value = quest?.recurrence || "none";
  $("#quest-dialog").showModal();
}
function openRewardForm(reward = null) {
  const form = $("#reward-form"); form.reset();
  $("#reward-form-title").textContent = reward ? "Edit Reward" : "Add a Reward";
  form.elements.id.value = reward?.id || "";
  form.elements.name.value = reward?.name || "";
  form.elements.description.value = reward?.description || "";
  form.elements.icon.value = reward?.icon || "✦";
  form.elements.cost.value = reward?.cost || 100;
  $("#reward-dialog").showModal();
}
function uuid() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

async function beginSignIn() {
  try { await signInWithPopup(auth, provider); }
  catch (error) {
    if (["auth/popup-blocked", "auth/cancelled-popup-request"].includes(error.code)) await signInWithRedirect(auth, provider);
    else { console.error(error); toast(`Sign-in failed: ${error.message}`); }
  }
}

onAuthStateChanged(auth, user => {
  currentUser = user;
  unsubscribe?.(); unsubscribe = null;
  if (!user) {
    state = emptyState(); activeQuestId = null; $("#auth-gate").classList.remove("hidden");
    $("#auth-button").textContent = "Sign in"; $("#sync-status").textContent = "Signed out"; render(); return;
  }
  $("#auth-gate").classList.add("hidden"); $("#auth-button").textContent = "Sign out";
  $("#sync-status").textContent = "Loading…";
  const ref = doc(db, "users", user.uid, "questLedger", "state");
  unsubscribe = onSnapshot(ref, async snapshot => {
    applyingRemote = true;
    if (snapshot.exists()) state = normalizeRemote(snapshot.data());
    else { state = emptyState(); await setDoc(ref, { ...state, ownerUid: user.uid, updatedAt: serverTimestamp() }); }
    applyingRemote = false; $("#sync-status").textContent = "Synced"; render();
  }, error => { console.error(error); $("#sync-status").textContent = "Sync failed"; toast("Could not load your cloud ledger. Check Firestore setup."); });
});

$("#auth-button").addEventListener("click", () => currentUser ? signOut(auth) : beginSignIn());
$("#gate-sign-in").addEventListener("click", beginSignIn);
$("#add-quest-button").addEventListener("click", () => openQuestForm());
$("#add-reward-button").addEventListener("click", () => openRewardForm());
$("#previous-month").addEventListener("click", () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); renderCalendar(); });
$("#next-month").addEventListener("click", () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); renderCalendar(); });
$$("[data-close-dialog]").forEach(button => button.addEventListener("click", () => $(`#${button.dataset.closeDialog}`).close()));
$$("dialog").forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }));

document.addEventListener("click", event => {
  const dateButton = event.target.closest("[data-date]");
  if (dateButton) { selectedDate = dateButton.dataset.date; activeQuestId = null; render(); return; }
  const questButton = event.target.closest("[data-open-quest]");
  if (questButton) { activeQuestId = questButton.dataset.openQuest; renderDetail(); return; }
  if (event.target.closest("#empty-add")) return openQuestForm();
  if (event.target.closest("#close-detail")) { activeQuestId = null; renderDetail(); return; }
  const quest = state.quests.find(q => q.id === activeQuestId);
  if (event.target.closest("#edit-quest") && quest) return openQuestForm(quest);
  if (event.target.closest("#delete-quest") && quest && confirm(`Delete “${quest.title}”?`)) {
    state.quests = state.quests.filter(q => q.id !== quest.id); activeQuestId = null; scheduleSave(); render(); return;
  }
  if (event.target.closest("#toggle-complete") && quest) {
    const complete = isComplete(quest, selectedDate);
    if (quest.recurrence === "none") quest.complete = !complete;
    else {
      quest.completedDates ||= [];
      quest.completedDates = complete ? quest.completedDates.filter(d => d !== selectedDate) : [...quest.completedDates, selectedDate];
    }
    state.gold = Math.max(0, state.gold + (complete ? -Number(quest.reward) : Number(quest.reward)));
    scheduleSave(); render(); return;
  }
  const redeem = event.target.closest("[data-redeem]");
  if (redeem) {
    const reward = state.rewards.find(r => r.id === redeem.dataset.redeem);
    if (reward && state.gold >= reward.cost && confirm(`Redeem “${reward.name}” for ${reward.cost} gold?`)) {
      state.gold -= Number(reward.cost);
      state.redemptions.push({ id: uuid(), rewardId: reward.id, name: reward.name, cost: reward.cost, redeemedAt: new Date().toISOString() });
      scheduleSave(); render(); toast(`Redeemed: ${reward.name}`); return;
    }
  }
  const editReward = event.target.closest("[data-edit-reward]");
  if (editReward) return openRewardForm(state.rewards.find(r => r.id === editReward.dataset.editReward));
  const deleteReward = event.target.closest("[data-delete-reward]");
  if (deleteReward) {
    const reward = state.rewards.find(r => r.id === deleteReward.dataset.deleteReward);
    if (reward && confirm(`Delete reward “${reward.name}”?`)) { state.rewards = state.rewards.filter(r => r.id !== reward.id); scheduleSave(); render(); }
  }
});

$("#quest-form").addEventListener("submit", event => {
  event.preventDefault(); const data = new FormData(event.currentTarget); const id = String(data.get("id") || "");
  const existing = state.quests.find(q => q.id === id);
  const quest = {
    id: id || uuid(), title: String(data.get("title")).trim(), description: String(data.get("description")).trim(),
    date: String(data.get("date")), reward: Number(data.get("reward")), importance: String(data.get("importance")),
    category: String(data.get("category")).trim(), recurrence: String(data.get("recurrence")),
    complete: existing?.complete || false, completedDates: existing?.completedDates || []
  };
  if (existing) Object.assign(existing, quest); else state.quests.push(quest);
  if (!state.categories.includes(quest.category)) state.categories.push(quest.category);
  selectedDate = quest.date; visibleMonth = parseKey(quest.date); activeQuestId = quest.id;
  $("#quest-dialog").close(); scheduleSave(); render();
});

$("#reward-form").addEventListener("submit", event => {
  event.preventDefault(); const data = new FormData(event.currentTarget); const id = String(data.get("id") || "");
  const reward = { id: id || uuid(), name: String(data.get("name")).trim(), description: String(data.get("description")).trim(), icon: String(data.get("icon") || "✦"), cost: Number(data.get("cost")) };
  const existing = state.rewards.find(r => r.id === id);
  if (existing) Object.assign(existing, reward); else state.rewards.push(reward);
  $("#reward-dialog").close(); scheduleSave(); render();
});

render();
