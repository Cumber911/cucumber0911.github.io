import { CHOICES, GROUPS, LABELS, formatChoice, normaliseSettings } from "./config.js";

// ラジオボタンを一度だけ生成し、値の変更時は必要な属性だけを更新します。
export function createSettingsPanel(container, initial, onChange) {
  let settings = { ...initial };
  container.replaceChildren();
  const radios = {};

  for (const group of GROUPS) {
    const section = document.createElement("section");
    section.className = "setting-group";
    const title = document.createElement("h2");
    title.textContent = `《${group.title}》`;
    section.append(title);

    for (const key of group.keys) {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "setting-field";
      fieldset.dataset.setting = key;
      const legend = document.createElement("legend");
      legend.textContent = LABELS[key];
      fieldset.append(legend);
      const grid = document.createElement("div");
      grid.className = "radio-grid";
      radios[key] = [];

      for (const value of CHOICES[key]) {
        const label = document.createElement("label");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = key;
        radio.value = String(value);
        radio.checked = settings[key] === value;
        radio.addEventListener("change", () => {
          if (!radio.checked) return;
          // type=radio は文字列しか返さないため、CHOICES から元の型を復元。
          settings[key] = CHOICES[key].find(item => String(item) === radio.value);
          settings = normaliseSettings(settings);
          refresh();
          onChange({ ...settings });
        });
        const name = document.createElement("span");
        name.textContent = formatChoice(key, value);
        label.append(radio, name);
        grid.append(label);
        radios[key].push({ radio, value, label });
      }
      fieldset.append(grid);
      section.append(fieldset);
    }
    container.append(section);
  }

  function refresh() {
    for (const [key, entries] of Object.entries(radios)) {
      for (const { radio, value, label } of entries) {
        const disabled =
          ((key === "direction" || key === "easing") && settings.movement === "無") ||
          (key === "background" && value === settings.textColor);
        radio.checked = settings[key] === value;
        radio.disabled = disabled;
        label.classList.toggle("disabled-option", disabled);
      }
    }
  }

  refresh();
  return { getSettings: () => ({ ...settings }) };
}
