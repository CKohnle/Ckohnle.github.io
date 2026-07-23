export const fmtDate = date =>
  `${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}-${date.getFullYear()}`;

/* Original ISO week ID used by tokens and progress. */
export function weekId(dateStr) {
  const [month, dayOfMonth, year] = dateStr.split("-").map(Number);
  const date = new Date(`${year}-${month}-${dayOfMonth}`);

  date.setHours(0, 0, 0, 0);

  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day + 3);

  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;

  firstThursday.setDate(
    firstThursday.getDate() - firstDay + 3
  );

  const week =
    Math.round((date - firstThursday) / 604800000) + 1;

  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekKeySunday(dateStr) {
  const [month, dayOfMonth, year] = dateStr.split("-").map(Number);
  const date = new Date(`${year}-${month}-${dayOfMonth}`);

  date.setHours(0, 0, 0, 0);

  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());

  return fmtDate(sunday);
}

export function weekRangeSundayToSaturday(dateStr) {
  const [month, dayOfMonth, year] = dateStr.split("-").map(Number);
  const date = new Date(`${year}-${month}-${dayOfMonth}`);

  date.setHours(0, 0, 0, 0);

  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  return `${fmtDate(sunday)} – ${fmtDate(saturday)}`;
}
