const API_URL = "./api/v1/software";

const elements = {
  summary: document.querySelector("#fetch-summary"),
  tableBody: document.querySelector("#fetchTableBody"),
  tableMeta: document.querySelector("#fetchTableMeta"),
  searchInput: document.querySelector("#fetchSearchInput"),
  reloadButton: document.querySelector("#reloadDataButton"),
  form: document.querySelector("#fetchSoftwareForm"),
  formTitle: document.querySelector("#fetchFormTitle"),
  nameInput: document.querySelector("#fetchNameInput"),
  categoryInput: document.querySelector("#fetchCategoryInput"),
  cancelEditButton: document.querySelector("#fetchCancelEditButton"),
  submitButton: document.querySelector("#fetchSubmitButton"),
  feedbackMessage: document.querySelector("#fetchFeedbackMessage"),
};

const state = {
  items: [],
  selectedId: null,
  searchTerm: "",
  isLoading: true,
};

async function bootstrap() {
  bindEvents();
  await loadItems("A szerveroldali lista sikeresen betöltődött.");
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    render();
  });

  elements.reloadButton.addEventListener("click", async () => {
    await loadItems("A lista frissítve lett a szerverről.");
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = elements.nameInput.value.trim();
    const category = elements.categoryInput.value.trim();

    if (!name || !category) {
      setFeedback("A név és a kategória kitöltése kötelező.");
      return;
    }

    setBusy(true);

    try {
      if (state.selectedId === null) {
        const payload = await requestJson(API_URL, {
          method: "POST",
          body: JSON.stringify({
            nev: name,
            kategoria: category,
          }),
        });

        state.items = sortByName([payload.item, ...state.items]);
        resetForm();
        setFeedback(`Új szoftver rögzítve a szerveren: ${payload.item.nev}.`);
      } else {
        const payload = await requestJson(`${API_URL}/${state.selectedId}`, {
          method: "PATCH",
          body: JSON.stringify({
            nev: name,
            kategoria: category,
          }),
        });

        state.items = sortByName(
          state.items.map((item) => (item.id === state.selectedId ? payload.item : item))
        );
        resetForm();
        setFeedback(`A szerveroldali rekord frissítve lett: ${payload.item.nev}.`);
      }
    } catch (error) {
      console.error(error);
      setFeedback(error.message);
    } finally {
      setBusy(false);
      render();
    }
  });

  elements.cancelEditButton.addEventListener("click", () => {
    resetForm();
    setFeedback("Az űrlap alaphelyzetbe állt.");
    render();
  });

  elements.tableBody.addEventListener("click", async (event) => {
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
      setFeedback(`Szerkesztés alatt: ${item.nev}.`);
      render();
      return;
    }

    if (deleteButton) {
      const id = Number(deleteButton.dataset.id);
      const item = state.items.find((entry) => entry.id === id);
      if (!item) {
        return;
      }

      const confirmed = window.confirm(`Biztosan törlöd ezt a rekordot: ${item.nev}?`);
      if (!confirmed) {
        return;
      }

      setBusy(true);

      try {
        const payload = await requestJson(`${API_URL}/${id}`, {
          method: "DELETE",
        });

        state.items = state.items.filter((entry) => entry.id !== id);

        if (state.selectedId === id) {
          resetForm();
        }

        setFeedback(`A szerveroldali rekord törölve lett: ${payload.item.nev}.`);
      } catch (error) {
        console.error(error);
        setFeedback(error.message);
      } finally {
        setBusy(false);
        render();
      }
    }
  });
}

async function loadItems(successMessage = "") {
  setBusy(true);

  try {
    const payload = await requestJson(API_URL);
    state.items = sortByName(payload.items ?? []);
    if (successMessage) {
      setFeedback(successMessage);
    }
  } catch (error) {
    console.error(error);
    state.items = [];
    setFeedback(error.message);
  } finally {
    setBusy(false);
    render();
  }
}

function getFilteredItems() {
  return state.items.filter((item) => {
    const haystack = `${item.nev} ${item.kategoria}`.toLowerCase();
    return haystack.includes(state.searchTerm);
  });
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
      label: "Látható elemek",
      value: filteredItems.length,
      detail: "Az aktuális keresési állapot szerint.",
    },
    {
      label: "Összes rekord",
      value: state.items.length,
      detail: "A PHP backend által visszaadott szerveroldali lista.",
    },
    {
      label: "Kategóriák",
      value: categoryCount,
      detail: "Különböző kategóriák a jelenlegi szűrés alapján.",
    },
    {
      label: "Szerkesztés alatt",
      value: selectedItem ? selectedItem.nev : "nincs",
      detail: selectedItem ? selectedItem.kategoria : "Új rekord felvétele mód.",
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
            ${state.isLoading ? "Adatok betöltése folyamatban..." : "Nincs találat a jelenlegi szűrésre."}
          </div>
        </td>
      </tr>
    `;
    elements.tableMeta.textContent = state.isLoading ? "Kapcsolódás a szerverhez..." : "0 rekord látható.";
    return;
  }

  elements.tableBody.innerHTML = filteredItems
    .map(
      (item) => `
        <tr class="${item.id === state.selectedId ? "is-selected" : ""}">
          <td>${item.id}</td>
          <td><strong>${item.nev}</strong></td>
          <td><span class="table-badge">${item.kategoria}</span></td>
          <td>
            <div class="row-actions">
              <button class="mini-button" type="button" data-action="edit" data-id="${item.id}">Szerkesztés</button>
              <button class="mini-button danger" type="button" data-action="delete" data-id="${item.id}">Törlés</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  elements.tableMeta.textContent = `${filteredItems.length} rekord látható, ${state.items.length} rekord van a szerveren.`;
}

function renderFormState() {
  const selectedItem = state.items.find((item) => item.id === state.selectedId);
  elements.formTitle.textContent = selectedItem ? "Szoftver szerkesztése" : "Új szoftver felvétele";
}

function resetForm() {
  state.selectedId = null;
  elements.form.reset();
}

function setFeedback(message) {
  elements.feedbackMessage.textContent = message;
}

function setBusy(isBusy) {
  state.isLoading = isBusy;
  elements.reloadButton.disabled = isBusy;
  elements.submitButton.disabled = isBusy;
  elements.cancelEditButton.disabled = isBusy;
}

function sortByName(items) {
  return [...items].sort((left, right) => left.nev.localeCompare(right.nev, "hu"));
}

async function requestJson(url, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "A szerver nem tudta feldolgozni a kérést.");
  }

  return payload;
}

bootstrap().catch((error) => {
  console.error(error);
  setFeedback("A Fetch API oldal nem tudott elindulni.");
});
