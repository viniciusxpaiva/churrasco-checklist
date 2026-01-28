/***********************
 * CONFIG
 ***********************/
const USE_API = true; // usa o Worker (estado compartilhado)
const API_BASE = "https://autumn-boat-525c.viniciusxpaiva.workers.dev";

// fallback local (opcional)
const STORAGE_KEY = "churrascoChecklist_v3.3";

/***********************
 * Estado padrão (fallback)
 * IMPORTANTE: no modo API, quem manda é o /state do Worker.
 * Aqui mantemos coerente e já com "group".
 ***********************/
function getInitialState() {
  return {
    foods: [
      // CHURRASCO
      { id: "camafeu-mostarda", name: "1 - Camafeu com molho de mostarda", group: "churrasco", count: 0 },
      { id: "panceta-ancho-farofa-vinagrete", name: "2 - Panceta, bife de ancho, farofa de bacon e vinagrete", group: "churrasco", count: 0 },
      { id: "fraldinha-batata-alcatra", name: "3 - Fraldinha, batata assada e alcatra com molho de cerveja", group: "churrasco", count: 0 },
      { id: "picanha-mandioca", name: "4 - Picanha suína/bovina e mandioca com molho de mostarda", group: "churrasco", count: 0 },
      { id: "costela-farofa", name: "5 - Costela com farofa", group: "churrasco", count: 0 },
      { id: "cupim-salada", name: "6 - Cupim com salada", group: "churrasco", count: 0 },
      { id: "pao-de-alho", name: "* Pão de alho", group: "churrasco", count: 0 },
      { id: "coracaozinho", name: "* Coraçãozinho", group: "churrasco", count: 0 },

      // SOBREMESAS
      { id: "mousse-maracuja", name: "1 - Mousse de maracujá", group: "sobremesas", count: 0 },
      { id: "torta-caramelo-churros", name: "2 - Torta caramelo/churros", group: "sobremesas", count: 0 },
      { id: "pave-morango", name: "V - Pavê de morango", group: "sobremesas", count: 0 },
      { id: "torta-ninho-nutella", name: "3 - Torta de ninho com Nutella", group: "sobremesas", count: 0 },
      { id: "torta-pistache", name: "4 - Torta de pistache", group: "sobremesas", count: 0 },
    ],
    log: [],
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
    return parsed;
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
async function apiMark(foodId) {
  const data = await apiRequest("/mark", { method: "POST", body: { foodId } });
  return data.state;
}
async function apiAdd(name) {
  const data = await apiRequest("/add", { method: "POST", body: { name } });
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
  return apiGetState();
}

/***********************
 * HELPERS UI
 ***********************/
function el(id) {
  return document.getElementById(id);
}

function safeIdFromName(name) {
  return (name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `food-${Date.now()}`;
}

function formatTime(tsISO) {
  const d = new Date(tsISO);
  return d.toLocaleString("pt-BR");
}

function computeSummary(state) {
  const items = state.foods?.length || 0;
  const totalMarks = (state.foods || []).reduce((acc, f) => acc + (f.count || 0), 0);
  return { items, totalMarks };
}

function getGroup(food) {
  // fallback: se o Worker ainda não tiver "group", joga tudo no churrasco
  return food.group === "sobremesas" ? "sobremesas" : "churrasco";
}

/***********************
 * RENDER
 ***********************/
function createFoodCard(food) {
  const card = document.createElement("div");
card.className = "food-card";

// se já foi marcado pelo menos 1 vez
if ((food.count || 0) > 0) {
  card.classList.add("is-marked");
}

  const main = document.createElement("div");

  const name = document.createElement("p");
  name.className = "food-name";
  name.textContent = food.name;

  const sub = document.createElement("p");
  sub.className = "food-sub";
  sub.textContent = `Marcamos: ${food.count || 0} vez(es)`;

  main.appendChild(name);
  main.appendChild(sub);

  const actions = document.createElement("div");
  actions.className = "food-actions";

  const btnEat = document.createElement("button");
  btnEat.className = "small primary";
  btnEat.textContent = "Adicionar";
  btnEat.addEventListener("click", async () => {
    try {
      const newState = await markFood(food.id);
      render(newState);
      showToast(`${food.name} marcado!`);
    } catch (e) {
      showToast(e.message);
    }
  });

  actions.appendChild(btnEat);

  card.appendChild(main);
  card.appendChild(actions);

  return card;
}

function render(state) {
  const gridChurrasco = el("foods-grid-churrasco");
  const gridSobremesas = el("foods-grid-sobremesas");
  const logList = el("log-list");
  const pill = el("summary-pill");

  const { items, totalMarks } = computeSummary(state);
  if (pill) pill.textContent = `${items} itens • ${totalMarks} marcados`;

  // Foods (duas seções)
  if (gridChurrasco) gridChurrasco.innerHTML = "";
  if (gridSobremesas) gridSobremesas.innerHTML = "";

  (state.foods || []).forEach((food) => {
    const group = getGroup(food);
    const target = group === "sobremesas" ? gridSobremesas : gridChurrasco;
    if (!target) return;

    target.appendChild(createFoodCard(food));
  });

  // Log (últimos 25)
  if (logList) {
    logList.innerHTML = "";
    const last = [...(state.log || [])].slice(-25).reverse();

    if (last.length === 0) {
      const li = document.createElement("li");
      li.className = "log-item";
      li.innerHTML = `
        <div class="log-left">
          <div class="log-food">Nada ainda</div>
          <div class="log-meta">Comece marcando uma comida</div>
        </div>`;
      logList.appendChild(li);
    } else {
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
        logList.appendChild(li);
      });
    }
  }
}

/***********************
 * ACTIONS (Worker ou fallback local)
 ***********************/
async function markFood(foodId) {
  if (USE_API) return apiMark(foodId);

  const state = loadLocalState();
  const food = state.foods.find((f) => f.id === foodId);
  if (!food) throw new Error("Comida não encontrada.");

  food.count = (food.count || 0) + 1;
  state.log.push({ foodId, foodName: food.name, tsISO: new Date().toISOString() });
  saveLocalState(state);
  return state;
}

async function addFood({ name }) {
  const cleaned = (name || "").trim();
  if (!cleaned) throw new Error("Digite um nome.");

  if (USE_API) return apiAdd(cleaned);

  const state = loadLocalState();
  const id = safeIdFromName(cleaned);

  if (state.foods.some((f) => f.id === id)) {
    throw new Error("Essa comida já existe.");
  }

  state.foods.push({ id, name: cleaned, group: "churrasco", count: 0 });
  saveLocalState(state);
  return state;
}

async function clearLog() {
  if (USE_API) return apiClearLog();

  const state = loadLocalState();
  state.log = [];
  saveLocalState(state);
  return state;
}

async function resetAll() {
  if (USE_API) return apiReset();

  const state = getInitialState();
  saveLocalState(state);
  return state;
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
  const form = el("add-form");
  const nameInput = el("food-name");
  const btnReset = el("btn-reset");
  const btnClearLog = el("btn-clear-log");

  // Carrega do servidor
  try {
    const state = await loadState();
    if (!USE_API) saveLocalState(state);
    render(state);
  } catch (e) {
    console.error(e);
    showToast("Erro ao carregar estado do servidor.");
  }

  // Adicionar
  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const name = nameInput?.value || "";

      try {
        const newState = await addFood({ name });
        render(newState);
        if (nameInput) nameInput.value = "";
        showToast("Comida adicionada!");
      } catch (e) {
        showToast(e.message);
      }
    });
  }

  // Limpar histórico
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

  // Reset
  if (btnReset) {
    btnReset.addEventListener("click", async () => {
      const sure = confirm("Zerar tudo (lista e histórico)?");
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
