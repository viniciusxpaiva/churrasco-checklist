/***********************
 * CONFIG
 ***********************/
const USE_API = true; // usa o Worker (estado compartilhado)
const API_BASE = "https://autumn-boat-525c.viniciusxpaiva.workers.dev";

// fallback local (opcional)
const STORAGE_KEY = "churrascoChecklist_v4.0";

/***********************
 * Estado padrão (fallback local)
 * No modo API, quem manda é o /state do Worker.
 ***********************/
function getInitialState() {
  return {
    foods: [
      // CHURRASCO
      { id: "camafeu-mostarda", name: "1 - Camafeu com molho de mostarda", group: "churrasco", countErika: 0, countVinicius: 0 },
      { id: "panceta-ancho-farofa-vinagrete", name: "2 - Panceta, bife de ancho, farofa de bacon e vinagrete", group: "churrasco", countErika: 0, countVinicius: 0 },
      { id: "fraldinha-batata-alcatra", name: "3 - Fraldinha, batata assada e alcatra com molho de cerveja", group: "churrasco", countErika: 0, countVinicius: 0 },
      { id: "picanha-mandioca", name: "4 - Picanha suína/bovina e mandioca com molho de mostarda", group: "churrasco", countErika: 0, countVinicius: 0 },
      { id: "costela-farofa", name: "5 - Costela com farofa", group: "churrasco", countErika: 0, countVinicius: 0 },
      { id: "cupim-salada", name: "6 - Cupim com salada", group: "churrasco", countErika: 0, countVinicius: 0 },
      { id: "pao-de-alho", name: "* Pão de alho", group: "churrasco", countErika: 0, countVinicius: 0 },
      { id: "coracaozinho", name: "* Coraçãozinho", group: "churrasco", countErika: 0, countVinicius: 0 },

      // SOBREMESAS
      { id: "mousse-maracuja", name: "1 - Mousse de maracujá", group: "sobremesas", countErika: 0, countVinicius: 0 },
      { id: "torta-caramelo-churros", name: "2 - Torta caramelo/churros", group: "sobremesas", countErika: 0, countVinicius: 0 },
      { id: "pave-morango", name: "V - Pavê de morango", group: "sobremesas", countErika: 0, countVinicius: 0 },
      { id: "torta-ninho-nutella", name: "3 - Torta de ninho com Nutella", group: "sobremesas", countErika: 0, countVinicius: 0 },
      { id: "torta-pistache", name: "4 - Torta de pistache", group: "sobremesas", countErika: 0, countVinicius: 0 },
    ],
    log: [], // { foodId, foodName, by, tsISO }
  };
}

/***********************
 * STORAGE (local - fallback)
 ***********************/
function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    const parsed = JSON.parse(raw);
    if (!parsed?.foods || !parsed?.log) return getInitialState();
    return normalizeState(parsed);
  } catch {
    return getInitialState();
  }
}
function saveLocalState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/***********************
 * API (Worker)
 ***********************/
async function apiRequest(path, { method = "GET", body = null } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

async function apiGetState() {
  return apiRequest("/state");
}

async function apiMark(foodId, by) {
  const data = await apiRequest("/mark", { method: "POST", body: { foodId, by } });
  return data.state;
}

async function apiClearLog() {
  const data = await apiRequest("/clear-log", { method: "POST" });
  return data.state;
}

async function apiReset() {
  const data = await apiRequest("/reset", { method: "POST" });
  return data.state;
}

/***********************
 * Load state
 ***********************/
async function loadState() {
  if (!USE_API) return loadLocalState();
  const state = await apiGetState();
  return normalizeState(state);
}

/***********************
 * HELPERS
 ***********************/
function el(id) {
  return document.getElementById(id);
}

function formatTime(tsISO) {
  const d = new Date(tsISO);
  return d.toLocaleString("pt-BR");
}

function getGroup(food) {
  return food.group === "sobremesas" ? "sobremesas" : "churrasco";
}

/**
 * Normaliza para suportar:
 * - estados antigos com "count"
 * - estados sem "group"
 * - garante countErika/countVinicius
 */
function normalizeState(state) {
  const foods = (state.foods || []).map((f) => {
    const group = getGroup(f);

    // se vier o modelo antigo (count)
    const legacyCount = typeof f.count === "number" ? f.count : null;

    const countErika =
      typeof f.countErika === "number" ? f.countErika : legacyCount ? legacyCount : 0;
    const countVinicius =
      typeof f.countVinicius === "number" ? f.countVinicius : 0;

    return {
      ...f,
      group,
      countErika,
      countVinicius,
    };
  });

  const log = Array.isArray(state.log) ? state.log : [];

  return { ...state, foods, log };
}

function computeSummary(state) {
  const items = state.foods?.length || 0;
  const totalMarks = (state.foods || []).reduce(
    (acc, f) => acc + (f.countErika || 0) + (f.countVinicius || 0),
    0
  );
  return { items, totalMarks };
}

function getBorderClass(food) {
  const e = (food.countErika || 0) > 0;
  const v = (food.countVinicius || 0) > 0;

  if (e && v) return "marked-both"; // verde
  if (e) return "marked-erika"; // vermelho
  if (v) return "marked-vinicius"; // azul
  return "";
}

/***********************
 * RENDER
 ***********************/
function createFoodCard(food) {
  const card = document.createElement("div");
  card.className = "food-card";

  const borderClass = getBorderClass(food);
  if (borderClass) card.classList.add(borderClass);

  const main = document.createElement("div");

  const name = document.createElement("p");
  name.className = "food-name";
  name.textContent = food.name;

  const sub = document.createElement("p");
  sub.className = "food-sub";
  sub.textContent = `Érika: ${food.countErika || 0} • Vinícius: ${food.countVinicius || 0}`;

  main.appendChild(name);
  main.appendChild(sub);

  const actions = document.createElement("div");
  actions.className = "food-actions";

  const btnErika = document.createElement("button");
  btnErika.className = "small erika";
  btnErika.textContent = "Érika";
  btnErika.addEventListener("click", async () => {
    try {
      const newState = await markFood(food.id, "erika");
      render(newState);
      showToast(`Érika marcou: ${food.name}`);
    } catch (e) {
      showToast(e.message);
    }
  });

  const btnVinicius = document.createElement("button");
  btnVinicius.className = "small vinicius";
  btnVinicius.textContent = "Vinícius";
  btnVinicius.addEventListener("click", async () => {
    try {
      const newState = await markFood(food.id, "vinicius");
      render(newState);
      showToast(`Vinícius marcou: ${food.name}`);
    } catch (e) {
      showToast(e.message);
    }
  });

  actions.appendChild(btnErika);
  actions.appendChild(btnVinicius);

  card.appendChild(main);
  card.appendChild(actions);

  return card;
}

function renderLogList(listEl, entries) {
  listEl.innerHTML = "";
  const last = [...entries].slice(-25).reverse();

  if (last.length === 0) {
    const li = document.createElement("li");
    li.className = "log-item";
    li.innerHTML = `
      <div class="log-left">
        <div class="log-food">Nada ainda</div>
        <div class="log-meta">Comece marcando uma comida</div>
      </div>`;
    listEl.appendChild(li);
    return;
  }

  last.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "log-item";

    const left = document.createElement("div");
    left.className = "log-left";

    const food = document.createElement("div");
    food.className = "log-food";
    food.textContent = entry.foodName;

    const meta = document.createElement("div");
    meta.className = "log-meta";
    meta.textContent = formatTime(entry.tsISO);

    left.appendChild(food);
    left.appendChild(meta);

    li.appendChild(left);
    listEl.appendChild(li);
  });
}

function render(state) {
  const gridChurrasco = el("foods-grid-churrasco");
  const gridSobremesas = el("foods-grid-sobremesas");

  const pill = el("summary-pill");

  const listErika = el("log-list-erika");
  const listVinicius = el("log-list-vinicius");

  const { items, totalMarks } = computeSummary(state);
  if (pill) pill.textContent = `${items} itens • ${totalMarks} marcados`;

  // foods (duas seções)
  if (gridChurrasco) gridChurrasco.innerHTML = "";
  if (gridSobremesas) gridSobremesas.innerHTML = "";

  (state.foods || []).forEach((food) => {
    const group = getGroup(food);
    const target = group === "sobremesas" ? gridSobremesas : gridChurrasco;
    if (!target) return;
    target.appendChild(createFoodCard(food));
  });

  // logs por pessoa (abas)
  const logErika = (state.log || []).filter((x) => x.by === "erika");
  const logVinicius = (state.log || []).filter((x) => x.by === "vinicius");

  if (listErika) renderLogList(listErika, logErika);
  if (listVinicius) renderLogList(listVinicius, logVinicius);
}

/***********************
 * ACTIONS
 ***********************/
async function markFood(foodId, by) {
  if (by !== "erika" && by !== "vinicius") {
    throw new Error("Parâmetro inválido (by).");
  }

  if (USE_API) return normalizeState(await apiMark(foodId, by));

  const state = loadLocalState();
  const food = state.foods.find((f) => f.id === foodId);
  if (!food) throw new Error("Comida não encontrada.");

  food.countErika = food.countErika || 0;
  food.countVinicius = food.countVinicius || 0;

  if (by === "erika") food.countErika += 1;
  if (by === "vinicius") food.countVinicius += 1;

  state.log.push({ foodId, foodName: food.name, by, tsISO: new Date().toISOString() });
  saveLocalState(state);
  return state;
}

async function clearLog() {
  if (USE_API) return normalizeState(await apiClearLog());

  const state = loadLocalState();
  state.log = [];
  saveLocalState(state);
  return state;
}

async function resetAll() {
  if (USE_API) return normalizeState(await apiReset());

  const state = getInitialState();
  saveLocalState(state);
  return state;
}

/***********************
 * TABS (Histórico)
 ***********************/
function setActiveTab(which) {
  const tabErika = el("tab-erika");
  const tabVinicius = el("tab-vinicius");
  const panelErika = el("panel-erika");
  const panelVinicius = el("panel-vinicius");

  const isErika = which === "erika";

  if (tabErika) {
    tabErika.classList.toggle("is-active", isErika);
    tabErika.setAttribute("aria-selected", String(isErika));
  }
  if (tabVinicius) {
    tabVinicius.classList.toggle("is-active", !isErika);
    tabVinicius.setAttribute("aria-selected", String(!isErika));
  }

  if (panelErika) {
    panelErika.classList.toggle("is-active", isErika);
    panelErika.hidden = !isErika;
  }
  if (panelVinicius) {
    panelVinicius.classList.toggle("is-active", !isErika);
    panelVinicius.hidden = isErika;
  }
}

/***********************
 * TOAST
 ***********************/
let toastTimeout = null;
function showToast(message, duration = 2500) {
  const toast = el("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.classList.add("show");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
  }, duration);
}

/***********************
 * INIT
 ***********************/
document.addEventListener("DOMContentLoaded", async () => {
  const btnReset = el("btn-reset");
  const btnClearLog = el("btn-clear-log");

  const tabErika = el("tab-erika");
  const tabVinicius = el("tab-vinicius");

  // tabs
  if (tabErika) tabErika.addEventListener("click", () => setActiveTab("erika"));
  if (tabVinicius) tabVinicius.addEventListener("click", () => setActiveTab("vinicius"));
  setActiveTab("erika");

  // carrega do servidor
  try {
    const state = await loadState();
    if (!USE_API) saveLocalState(state);
    render(state);
  } catch (e) {
    console.error(e);
    showToast("Erro ao carregar estado do servidor.");
  }

  // limpar histórico
  if (btnClearLog) {
    btnClearLog.addEventListener("click", async () => {
      try {
        const newState = await clearLog();
        render(newState);
        showToast("Histórico limpo.");
      } catch (e) {
        showToast(e.message);
      }
    });
  }

  // reset
  if (btnReset) {
    btnReset.addEventListener("click", async () => {
      const sure = confirm("Zerar tudo (contadores e histórico)?");
      if (!sure) return;

      try {
        const newState = await resetAll();
        render(newState);
        showToast("Zerado.");
      } catch (e) {
        showToast(e.message);
      }
    });
  }
});
