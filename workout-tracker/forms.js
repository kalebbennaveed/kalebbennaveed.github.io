const LB_PER_KG = 1 / 0.45359237;

// USDA National Nutrient Database for Standard Reference, Release 28.
// Food preparation is part of the item name. Values are kcal per 100 g.
const foods = [
  ["Almonds", 579], ["Apple, fresh", 52, "apple"], ["Avocado, fresh", 160, "avocado"],
  ["Banana, fresh", 89, "banana"], ["Black beans, boiled", 132, "black beans"],
  ["Blueberries, fresh", 57, "blueberries"], ["Broccoli, raw", 34, "broccoli"],
  ["Brown rice, long grain, cooked", 123, "brown rice"], ["Butter", 717],
  ["Carrot, raw", 41, "carrot"], ["Cheddar cheese", 404, "cheddar"],
  ["Chicken breast, roasted, skinless", 165, "chicken breast"],
  ["Chickpeas, boiled", 164, "chickpeas"], ["Cucumber, raw", 15, "cucumber"],
  ["Egg, hard-boiled", 155, "boiled egg"], ["Greek yogurt, plain, nonfat", 59, "greek yogurt"],
  ["Honey", 304], ["Lentils, boiled", 116, "lentils"], ["Milk, skim", 34, "skim milk"],
  ["Milk, whole", 61, "whole milk"], ["Oats, dry", 389, "oats"], ["Olive oil", 884],
  ["Onion, raw", 40, "onion"], ["Orange, fresh", 47, "orange"], ["Pasta, cooked", 158, "pasta"],
  ["Peanut butter, smooth", 598, "peanut butter"], ["Pork tenderloin, lean, roasted", 143],
  ["Quinoa, cooked", 120, "quinoa"], ["Salmon, Atlantic, farmed, cooked", 206, "salmon"],
  ["Spinach, raw", 23, "spinach"], ["Strawberries, fresh", 32, "strawberries"],
  ["Tofu, firm, calcium-set", 144, "firm tofu"], ["Tomato, raw", 18, "tomato"],
  ["Watermelon, fresh", 30, "watermelon"], ["White rice, long grain, cooked", 130, "white rice"],
  ["Whole wheat bread", 252]
];
const exercises = [
  "Back squat", "Barbell bench press", "Barbell row", "Bicep curl", "Bulgarian split squat",
  "Cable fly", "Cable row", "Calf raise", "Chest press", "Chin-up", "Deadlift", "Dip",
  "Dumbbell bench press", "Dumbbell row", "Front squat", "Goblet squat", "Hammer curl",
  "Hip thrust", "Incline dumbbell press", "Lat pulldown", "Lateral raise", "Leg curl",
  "Leg extension", "Leg press", "Lunge", "Overhead press", "Pull-up", "Push-up",
  "Romanian deadlift", "Shoulder press", "Triceps pushdown"
];
const names = {workout: "workout", meal: "meal", weight: "weigh-in", prayer: "SOAP entry"};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function field(label, control) {
  const wrapper = el("label", "fe-field");
  wrapper.append(el("span", "", label), control);
  return wrapper;
}

function input(type, value, props = {}) {
  const control = el("input");
  control.type = type;
  Object.assign(control, props);
  control.value = value ?? "";
  return control;
}

function action(text, className, handler) {
  const button = el("button", className, text);
  button.type = "button";
  if (handler) button.addEventListener("click", handler);
  return button;
}

function select(choices, selected) {
  const control = el("select");
  for (const [value, label] of choices) {
    const option = el("option", "", label);
    option.value = value;
    control.append(option);
  }
  control.value = selected;
  return control;
}

function datalist(id, items) {
  const list = el("datalist");
  list.id = id;
  for (const value of items) {
    const option = el("option");
    option.value = value;
    list.append(option);
  }
  return list;
}

function setError(control, message) {
  control.setCustomValidity(message);
  control.reportValidity();
  control.addEventListener("input", () => control.setCustomValidity(""), {once: true});
  return null;
}

function massInput(kg, unit, required) {
  const control = input("number", "", {min: required ? "0.001" : "0", step: "any", required,
    placeholder: required ? "0.0" : "0", inputMode: "decimal"});
  control.dataset.mass = "";
  if (kg != null && Number.isFinite(Number(kg))) setMass(control, Number(kg), unit);
  control.addEventListener("input", () => delete control.dataset.kg);
  return control;
}

function setMass(control, kg, unit) {
  // Keep exact kg for unchanged fields, including across repeated display-unit switches.
  control.dataset.kg = String(kg);
  control.value = String(Number((kg * (unit === "lb" ? LB_PER_KG : 1)).toFixed(4)));
}

function readMass(control, unit) {
  if (control.value === "") return 0;
  if (control.dataset.kg !== undefined) return Number(control.dataset.kg);
  return control.valueAsNumber * (unit === "lb" ? 0.45359237 : 1);
}

function workoutFields(body, entry, records, unit, prefix) {
  const workoutTitle = input("text", entry?.title, {placeholder: "e.g. Upper body", maxLength: 160});
  const minutes = input("number", entry?.duration, {min: "1", max: "1440", step: "1", placeholder: "Optional"});
  const top = el("div", "fe-grid fe-workout-basics");
  top.append(field("Workout name", workoutTitle), field("Minutes", minutes));
  body.append(top);

  const history = records.filter(r => r.type === "workout" && r.exercises?.length && !r.deleted)
    .sort((a,b) => String(b.date).localeCompare(String(a.date)) || b.updatedAt - a.updatedAt);
  const listId = prefix + "-exercises";
  const exerciseList = new Set(exercises);
  for (const prev of history) for (const exercise of prev.exercises) exerciseList.add(exercise.name);
  body.append(datalist(listId, Array.from(exerciseList).filter(Boolean).sort()));

  const routineArea = el("div", "fe-stack");
  function renumber() {
    [...routineArea.children].forEach((card, index, cards) => {
      card.querySelector(".fe-card-heading").textContent = "Exercise " + (index + 1);
      card.querySelector(".fe-remove-card").disabled = cards.length === 1;
      [...card.querySelector(".fe-sets").children].forEach((row, i, rows) => {
        row.firstChild.textContent = String(i + 1);
        row.querySelector("button").disabled = rows.length === 1;
        row.querySelector("button").setAttribute("aria-label", "Remove set " + (i + 1));
      });
    });
  }

  function addExercise(initial, focus = false) {
    const card = el("section", "fe-card");
    const header = el("div", "fe-card-top");
    const remove = action("Remove", "fe-remove-card fe-text-btn", () => {
      card.remove();
      renumber();
    });
    header.append(el("h3", "fe-card-heading"), remove);
    const name = input("text", initial?.name, {required: true, maxLength: 160, placeholder: "Search or name an exercise"});
    name.className = "fe-ex-name";
    name.setAttribute("list", listId);
    name.setAttribute("aria-label", "Exercise name");
    const columns = el("div", "fe-set-row fe-set-head");
    const weightLabel = el("span", "fe-unit-head", "Weight (" + unit.value + ")");
    columns.append(el("span", "", "Set"), weightLabel, el("span", "", "Reps"));
    const sets = el("div", "fe-sets");
    function addSet(source, focus = false) {
      const row = el("div", "fe-set-row");
      const weight = massInput(source?.kg, unit.value, false);
      weight.setAttribute("aria-label", "Weight in " + unit.value);
      const reps = input("number", source?.reps, {required: true, min: "1", max: "100000", step: "1", placeholder: "0"});
      reps.setAttribute("aria-label", "Repetitions");
      const removeSet = action("×", "fe-icon-btn fe-x-small", () => {row.remove(); renumber();});
      row.append(el("span", "fe-set-index"), weight, reps, removeSet);
      sets.append(row);
      renumber();
      if (focus) weight.focus();
    }
    const add = action("+ Add set", "fe-text-btn fe-add-set", () => {
      const last = sets.lastElementChild;
      const kgInput = last.querySelector("[data-mass]");
      addSet({kg: kgInput.value ? readMass(kgInput, unit.value) : null, reps: last.querySelector('[aria-label="Repetitions"]').value}, true);
    });
    card.append(header, name, columns, sets, add);
    routineArea.append(card);
    for (const set of initial?.sets?.length ? initial.sets : [{}]) addSet(set);
    if (focus) name.focus();
  }

  if (!entry && history.length) {
    const repeat = select([["", "Choose a previous workout"], ...history.map(r => [r.id, (r.title || "Workout") + " · " + r.date])], "");
    const apply = action("Use workout", "fe-btn fe-secondary", () => {
      const previous = history.find(r => r.id === repeat.value);
      if (!previous) return;
      const hasInput = workoutTitle.value || minutes.value || [...routineArea.querySelectorAll("input")].some(i => i.value);
      if (hasInput && !window.confirm("Replace the current exercises with this workout?")) return;
      workoutTitle.value = previous.title || "";
      minutes.value = "";
      routineArea.replaceChildren();
      for (const ex of previous.exercises) addExercise(ex);
      repeat.value = "";
      apply.disabled = true;
    });
    apply.disabled = true;
    repeat.onchange = () => {apply.disabled = !repeat.value;};
    const repeatRow = el("div", "fe-repeat");
    repeatRow.append(field("Repeat a workout", repeat), apply);
    body.append(repeatRow);
  }

  for (const ex of entry?.exercises?.length ? entry.exercises : [{}]) addExercise(ex);
  body.append(routineArea, action("+ Add exercise", "fe-btn fe-add", () => addExercise(null, true)));
  return () => {
    const items = [];
    for (const card of routineArea.children) {
      const name = card.querySelector(".fe-ex-name");
      if (!name.value.trim()) return setError(name, "Enter an exercise name.");
      const sets = [...card.querySelector(".fe-sets").children].map(row => ({
        kg: readMass(row.querySelector("[data-mass]"), unit.value), reps: row.querySelector('[aria-label="Repetitions"]').valueAsNumber
      }));
      items.push({name: name.value.trim(), sets});
    }
    const result = {title: workoutTitle.value.trim() || "Workout", exercises: items};
    if (minutes.value) result.duration = minutes.valueAsNumber;
    return result;
  };
}

function mealFields(body, entry, records, prefix) {
  const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"];
  const type = select(mealTypes.map(t => [t, t]), mealTypes.find(t => t.toLowerCase() === entry?.mealType?.toLowerCase()) || mealTypes[0]);
  body.append(field("Meal type", type));

  const options = new Map();
  const knownRates = new Map();
  const knownNames = new Map();
  function remember(name, rate, alias = null) {
    options.set(name.toLowerCase(), name);
    for (const key of [name, alias].filter(Boolean)) {
      knownRates.set(key.toLowerCase(), rate);
      knownNames.set(key.toLowerCase(), name);
    }
  }
  for (const [name, rate, alias] of foods) remember(name, rate, alias);
  const mealHistory = records.filter(r => r.type === "meal" && !r.deleted).sort((a,b) => a.updatedAt - b.updatedAt);
  for (const meal of mealHistory) for (const food of meal.foods || []) {
    if (food.name?.trim() && Number.isFinite(food.kcalPer100)) remember(food.name, food.kcalPer100);
  }
  const listId = prefix + "-foods";
  body.append(datalist(listId, [...options.values()].sort()));
  const cards = el("div", "fe-stack");
  const estimate = el("div", "fe-total");
  const total = el("output", "", "0 kcal");
  estimate.append(el("span", "", "Estimated meal calories"), total);
  function readFood(card) {
    const [name, grams, rate] = card.querySelectorAll("input");
    return {name: name.value.trim(), grams: grams.valueAsNumber, kcalPer100: rate.valueAsNumber};
  }
  function update() {
    let kcal = 0;
    [...cards.children].forEach((card, i, all) => {
      const food = readFood(card);
      const portion = food.grams * food.kcalPer100 / 100;
      const finite = Number.isFinite(portion);
      if (finite) kcal += portion;
      card.querySelector(".fe-portion").textContent = finite ? Math.round(portion).toLocaleString() + " kcal" : "";
      card.querySelector(".fe-card-heading").textContent = "Food " + (i + 1);
      card.querySelector(".fe-remove-card").disabled = all.length === 1;
    });
    total.textContent = Math.round(kcal).toLocaleString() + " kcal";
  }
  function addFood(initial, focus = false) {
    const card = el("section", "fe-card");
    const head = el("div", "fe-card-top");
    const remove = action("Remove", "fe-text-btn fe-remove-card", () => {card.remove(); update();});
    head.append(el("h3", "fe-card-heading"), remove);
    const name = input("text", initial?.name, {required: true, maxLength: 160, placeholder: "Search foods or enter your own"});
    name.setAttribute("list", listId);
    const grams = input("number", initial?.grams, {required: true, min: "0.01", max:"100000", step: "any", inputMode: "decimal", placeholder: "100"});
    const rate = input("number", initial?.kcalPer100, {required: true, min: "0", max:"1000", step: "any", inputMode: "decimal", placeholder: "From label"});
    let lastName = name.value.toLowerCase().trim();
    name.addEventListener("input", () => {
      const key = name.value.toLowerCase().trim();
      if (key !== lastName) rate.value = knownRates.get(key) ?? "";
      lastName = key;
    });
    name.addEventListener("change", () => {
      const canonical = knownNames.get(name.value.toLowerCase().trim());
      if (canonical) name.value = canonical;
      lastName = name.value.toLowerCase().trim();
    });
    const numberFields = el("div", "fe-grid");
    numberFields.append(field("Portion (g)", grams), field("kcal per 100 g", rate));
    card.append(head, field("Food name", name), numberFields, el("span", "fe-portion"));
    card.addEventListener("input", update);
    cards.append(card);
    update();
    if (focus) name.focus();
  }
  for (const f of entry?.foods?.length ? entry.foods : [{}]) addFood(f);
  const hint = el("p", "fe-hint", "Choose a food to fill its calorie estimate, or enter the kcal per 100 g from your label. ");
  const source = el("a", "", "USDA reference");
  source.href = "https://fdc.nal.usda.gov/download-datasets/#historical-data";
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  hint.append(source);
  body.append(cards, action("+ Add food", "fe-btn fe-add", () => addFood(null, true)), hint, estimate);
  return () => {
    const foods = [...cards.children].map(readFood);
    const empty = foods.findIndex(f => !f.name);
    if (empty !== -1) return setError(cards.children[empty].querySelector("input"), "Enter a food name.");
    const calories = Math.round(foods.reduce((sum, f) => sum + f.grams * f.kcalPer100 / 100, 0));
    return {mealType: type.value, foods, calories};
  };
}

const soap = [
  ["scripture", "Scripture", "Which passage are you reflecting on?"],
  ["observation", "Observation", "What stands out to you in the passage?"],
  ["application", "Application", "How will you put this into practice today?"],
  ["prayer", "Prayer", "Write your prayer…"]
];

function prayerFields(body, entry) {
  const controls = [];
  for (const [key, label, prompt] of soap) {
    const textarea = el("textarea");
    textarea.rows = key === "scripture" ? 2 : 3;
    textarea.maxLength = 30000;
    textarea.placeholder = prompt;
    textarea.value = entry?.[key] || "";
    const group = field(label, textarea);
    group.classList.add("fe-soap");
    group.firstElementChild.prepend(el("span", "fe-initial", label[0]));
    body.append(group);
    controls.push([key, textarea]);
  }
  body.addEventListener("input", () => controls[0][1].setCustomValidity(""));
  return () => {
    const data = Object.fromEntries(controls.map(([key, control]) => [key, control.value.trim()]));
    if (Object.values(data).some(Boolean)) return data;
    return setError(controls[0][1], "Write in at least one SOAP field.");
  };
}

export function openEditor({type, date, unit = "kg", entry = null, records = [], onSave, onDelete}) {
  if (!Object.hasOwn(names, type)) throw new Error("Unknown record type.");
  const dialog = el("dialog", "field-editor");
  const prefix = "fe-" + crypto.randomUUID();
  dialog.setAttribute("aria-labelledby", prefix + "-title");
  const form = el("form");
  const header = el("header", "fe-header");
  const title = el("h2", "", (entry ? "Edit " : type === "prayer" ? "Write " : "Log ") + (type === "prayer" && !entry ? "a " : "") + names[type]);
  title.id = prefix + "-title";
  const close = action("×", "fe-icon-btn fe-close", () => dialog.close());
  close.setAttribute("aria-label", "Close editor");
  header.append(title, close);
  const body = el("div", "fe-body");
  const dateInput = input("date", entry?.date || date, {required: true});
  const firstRow = el("div", "fe-grid");
  firstRow.append(field("Date", dateInput));
  const unitControl = select([["kg", "Kilograms (kg)"], ["lb", "Pounds (lb)"]], /^(lb|lbs|pounds)$/i.test(unit) ? "lb" : "kg");
  if (type === "workout" || type === "weight") {
    firstRow.append(field("Weight unit", unitControl));
    let oldUnit = unitControl.value;
    unitControl.onchange = () => {
      for (const control of body.querySelectorAll("[data-mass]")) {
        if (control.value !== "") setMass(control, readMass(control, oldUnit), unitControl.value);
        control.setAttribute("aria-label", "Weight in " + unitControl.value);
      }
      for (const label of body.querySelectorAll(".fe-unit-head")) label.textContent = "Weight (" + unitControl.value + ")";
      oldUnit = unitControl.value;
    };
  }
  body.append(firstRow);
  let read;
  if (type === "workout") read = workoutFields(body, entry, records, unitControl, prefix);
  if (type === "meal") read = mealFields(body, entry, records, prefix);
  if (type === "prayer") read = prayerFields(body, entry);
  if (type === "weight") {
    const weight = massInput(entry?.kg, unitControl.value, true);
    body.append(field("Body weight", weight));
    read = () => ({kg: readMass(weight, unitControl.value)});
  }
  const error = el("p", "fe-error");
  error.setAttribute("role", "alert");
  const footer = el("footer", "fe-footer");
  const cancel = action("Cancel", "fe-btn fe-secondary", () => dialog.close());
  const save = el("button", "fe-btn fe-primary", entry ? "Save changes" : "Save " + names[type]);
  save.type = "submit";
  const actions = el("div", "fe-actions");
  actions.append(cancel, save);
  let busy = false;
  async function persist(operation, pendingText) {
    if (busy) return;
    busy = true;
    const original = save.textContent;
    error.textContent = "";
    save.textContent = pendingText;
    form.inert = true;
    form.setAttribute("aria-busy", "true");
    try {
      await operation();
      dialog.close();
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "Could not update this entry. Try again.";
    } finally {
      form.inert = false;
      form.removeAttribute("aria-busy");
      save.textContent = original;
      busy = false;
    }
  }
  if (entry && onDelete) {
    const remove = action("Delete entry", "fe-text-btn fe-danger", () => {
      if (window.confirm("Delete this " + names[type] + "?")) persist(() => onDelete(entry.id), "Deleting…");
    });
    footer.append(remove);
  }
  footer.append(actions);
  form.append(header, body, error, footer);
  dialog.append(form);
  const id = entry?.id || crypto.randomUUID();
  form.onsubmit = e => {
    e.preventDefault();
    if (busy || !form.reportValidity()) return;
    const fields = read();
    if (!fields) return;
    const value = {id, type, date: dateInput.value, updatedAt: Date.now(), ...fields};
    persist(() => onSave(value), "Saving…");
  };
  dialog.addEventListener("cancel", event => {if (busy) event.preventDefault();});
  dialog.addEventListener("close", () => dialog.remove(), {once: true});
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
