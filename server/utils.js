export function toCamelRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      value
    ])
  );
}

export function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function ageInMonths(birthDate, now = new Date()) {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return 0;
  }

  let months = (now.getFullYear() - birth.getFullYear()) * 12;
  months += now.getMonth() - birth.getMonth();

  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

export function ageInDays(birthDate, now = new Date()) {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return 0;
  }

  const diff = now.getTime() - birth.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function enrichBaby(baby) {
  return {
    ...baby,
    ageMonths: ageInMonths(baby.birthDate),
    ageDays: ageInDays(baby.birthDate)
  };
}

export function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
