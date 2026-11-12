import {
  CHOICES as originalChoices,
  LABELS as originalLabels,
  GROUPS as originalGroups,
  formatChoice as formatOriginalChoice,
  normaliseSettings,
  randomChoice
} from "./config.js";

export { normaliseSettings };

export const CHOICES = {
  ...originalChoices,
  jitter: [0, 10, 20],
  opacity: [0, 100],
  scale: [0, 100],
  rotationEasing: ["なし", "あり"]
};

export const LABELS = Object.fromEntries(
  Object.entries(originalLabels).flatMap(([key, label]) => key === "rotation"
    ? [[key, label], ["rotationEasing", "回転緩急"]]
    : [[key, label]])
);

export const GROUPS = originalGroups.map(group => ({
  ...group,
  keys: group.keys.flatMap(key => key === "rotation" ? [key, "rotationEasing"] : [key])
}));

const OPTION_LABELS = {
  fontSize: { 12: "小", 18: "中", 24: "大" },
  jitter: { 0: "なし", 10: "小", 20: "大" },
  scale: { 0: "縮小から開始", 100: "そのまま" },
  opacity: { 0: "透明から開始", 100: "そのまま" }
};

export function formatChoice(key, value) {
  const customLabel = OPTION_LABELS[key]?.[value];
  if (customLabel !== undefined) return customLabel;
  if (key === "jitter" && typeof value === "number") return `${value}px`;
  return formatOriginalChoice(key, value);
}

export function createInitialSettings() {
  const settings = Object.fromEntries(
    Object.entries(CHOICES).map(([key, choices]) => [key, randomChoice(choices)])
  );
  settings.background = randomChoice(
    CHOICES.background.filter(color => color !== settings.textColor)
  );
  return settings;
}
