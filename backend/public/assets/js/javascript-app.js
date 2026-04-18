const STORAGE_KEY = "web1-javascript-crud-software";
const DATA_URL = "./data/software.json";

const elements = {
  summary: document.querySelector("#js-summary"),
  tableBody: document.querySelector("#softwareTableBody"),
  tableMeta: document.querySelector("#tableMeta"),
  searchInput: document.querySelector("#searchInput"),
  resetDataButton: document.querySelector("#resetDataButton"),
  form: document.querySelector("#softwareForm"),
  formTitle: document.querySelector("#formTitle"),
  nameInput: document.querySelector("#nameInput"),
  categoryInput: document.querySelector("#categoryInput"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  feedbackMessage: document.querySelector("#feedbackMessage"),
};

const state = {
  items: [],
  seedItems: [],
  selectedId: null,
  searchTerm: "",
};

async function bootstrap() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Nem sikerult betolteni a software.json adatfajlt.");
  }

  const seedItems = await response.json();
  state.seedItems = Array.isArray(seedItems) ? seedItems : [];

  const storedItems = localStorage.getItem(STORAGE_KEY);
  state.items = storedItems ? JSON.parse(storedItems) : structuredClone(state.seedItems);

  bindEvents();
  render();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    render();
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = elements.nameInput.value.trim();
    const category = elements.categoryInput.value.trim();

    if (!name || !category) {
      setFeedback("A nev es a kategoria kitoltese kotelezo.");
      return;
    }

    if (state.selectedId === null) {
      const nextId = state.items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;
      state.items.unshift({
        id: nextId,
        nev: name,
        kategoria: category,
      });
      setFeedback(`Uj szoftver rogzitve: ${name}.`);
    } else {
      state.items = state.items.map((item) =>
        item.id === state.selectedId ? { ...item, nev: name, kategoria: category } : item
      );
      setFeedback(`Szoftver frissitve: ${name}.`);
    }

    persist();
    resetForm();
    render();
  });

  elements.cancelEditButton.addEventListener("click", () => {
    resetForm();
    render();
  });

  elements.resetDataButton.addEventListener("click", () => {
    state.items = structuredClone(state.seedItems);
    persist();
    resetForm();
    setFeedback("Az alapadatok vissza lettek allitva.");
    render();
  });

  elements.tableBody.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-action='edit']");
    const deleteButton = event.target.closest("[data-action='delete']");

    if (editButton) {
      const id = Number(editButton.dataset.id);
      const item = state.items.find((entry) => entry.id === id);
      if (!item) {
        return;
      }

      state.selectedId = item.id;
      elements.nameInput.value = item.nev;
      elements.categoryInput.value = item.kategoria;
      setFeedback(`Szerkesztes alatt: ${item.nev}.`);
      render();
      return;
    }

    if (deleteButton) {
      const id = Number(deleteButton.dataset.id);
      const item = state.items.find((entry) => entry.id === id);
      if (!item) {
        return;
      }

      state.items = state.items.filter((entry) => entry.id !== id);
      persist();

      if (state.selectedId === id) {
        resetForm();
      }

      setFeedback(`Torolve: ${item.nev}.`);
      render();
    }
  });
}

function getFilteredItems() {
  const filtered = state.items.filter((item) => {
    const haystack = `${item.nev} ${item.kategoria}`.toLowerCase();
    return haystack.includes(state.searchTerm);
  });

  return filtered.sort((left, right) => left.nev.localeCompare(right.nev, "hu"));
}

function render() {
  const filteredItems = getFilteredItems();
  renderSummary(filteredItems);
  renderTable(filteredItems);
  renderFormState();
}

function renderSummary(filteredItems) {
  const categoryCount = new Set(filteredItems.map((item) => item.kategoria)).size;
  const selectedItem = state.items.find((item) => item.id === state.selectedId);

  const cards = [
    {
      label: "Lathato elemek",
      value: filteredItems.length,
      detail: "Aktualis keresesi allapot szerint",
    },
    {
      label: "Osszes szoftver",
      value: state.items.length,
      detail: "LocalStorage-ben tarolt aktualis lista",
    },
    {
      label: "Kategoriak",
      value: categoryCount,
      detail: "Kulonbozo kategoriak a szurt listaban",
    },
    {
      label: "Szerkesztes alatt",
      value: selectedItem ? selectedItem.nev : "nincs",
      detail: selectedItem ? selectedItem.kategoria : "Uj rekord felvetel mod",
    },
  ];

  elements.summary.innerHTML = cards
    .map(
      (card) => `
        <article class="card summary-card">
          <p class="summary-label">${card.label}</p>
          <strong class="summary-value">${card.value}</strong>
          <p>${card.detail}</p>
        </article>
      `
    )
    .join("");
}

function renderTable(filteredItems) {
  if (filteredItems.length === 0) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state-box">
            Nincs talalat a jelenlegi szuresre.
          </div>
        </td>
      </tr>
    `;
    elements.tableMeta.textContent = "0 rekord lathato.";
    return;
  }

  elements.tableBody.innerHTML = filteredItems
    .map(
      (item) => `
        <tr class="${item.id === state.selectedId ? "is-selected" : ""}">
          <td>${item.id}</td>
          <td>
            <strong>${item.nev}</strong>
          </td>
          <td><span class="table-badge">${item.kategoria}</span></td>
          <td>
            <div class="row-actions">
              <button class="mini-button" type="button" data-action="edit" data-id="${item.id}">Szerkesztes</button>
              <button class="mini-button danger" type="button" data-action="delete" data-id="${item.id}">Torles</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  elements.tableMeta.textContent = `${filteredItems.length} rekord lathato, ${state.items.length} rekord tarolva.`;
}

function renderFormState() {
  const selectedItem = state.items.find((item) => item.id === state.selectedId);
  elements.formTitle.textContent = selectedItem ? "Szoftver szerkesztese" : "Uj szoftver felvetele";
}

function resetForm() {
  state.selectedId = null;
  elements.form.reset();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function setFeedback(message) {
  elements.feedbackMessage.textContent = message;
}

bootstrap().catch((error) => {
  console.error(error);
  elements.feedbackMessage.textContent = "Hiba tortent az adatok betoltesekor.";
  elements.summary.innerHTML = `
    <article class="card summary-card">
      <p class="summary-label">Hiba</p>
      <strong class="summary-value">Adatbetoltes sikertelen</strong>
      <p>Ellenorizd a software.json fajlt.</p>
    </article>
  `;
});
