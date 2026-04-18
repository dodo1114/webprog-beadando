(function bootstrapReactCrud() {
  const { useEffect, useMemo, useState, useDeferredValue, useTransition } = React;
  const { createRoot } = ReactDOM;
  const html = htm.bind(React.createElement);

  const STORAGE_KEY = "web1-react-crud-software";
  const DATA_URL = "./data/software.json";

  function sortByName(items) {
    return [...items].sort((left, right) => left.nev.localeCompare(right.nev, "hu"));
  }

  function normalizeItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .map((item) => ({
        id: Number(item.id),
        nev: String(item.nev ?? "").trim(),
        kategoria: String(item.kategoria ?? "").trim(),
      }))
      .filter((item) => Number.isFinite(item.id) && item.nev && item.kategoria);
  }

  function loadStoredItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeItems(JSON.parse(raw)) : null;
    } catch (error) {
      console.error("Nem sikerült beolvasni a localStorage adatokat.", error);
      return null;
    }
  }

  function persistItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function getNextId(items) {
    return items.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
  }

  function SummaryCard({ label, value, detail }) {
    return html`
      <article className="card summary-card">
        <p className="summary-label">${label}</p>
        <strong className="summary-value">${value}</strong>
        <p>${detail}</p>
      </article>
    `;
  }

  function CategoryFilter({ categories, activeCategory, onSelect }) {
    return html`
      <div className="chip-list">
        <button
          className=${`chip-button ${activeCategory === "osszes" ? "is-active" : ""}`}
          type="button"
          onClick=${() => onSelect("osszes")}
        >
          Minden kategória
        </button>
        ${categories.map(
          (category) => html`
            <button
              key=${category}
              className=${`chip-button ${activeCategory === category ? "is-active" : ""}`}
              type="button"
              onClick=${() => onSelect(category)}
            >
              ${category}
            </button>
          `
        )}
      </div>
    `;
  }

  function ReactCrudApp() {
    const [items, setItems] = useState([]);
    const [seedItems, setSeedItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("osszes");
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState({ nev: "", kategoria: "" });
    const [feedback, setFeedback] = useState("A React CRUD oldal betöltötte az alapadatokat.");
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [isPending, startTransition] = useTransition();
    const deferredSearchTerm = useDeferredValue(searchTerm);

    useEffect(() => {
      let isMounted = true;

      async function loadData() {
        try {
          const response = await fetch(DATA_URL, { cache: "no-store" });
          if (!response.ok) {
            throw new Error("Nem sikerült betölteni a software.json fájlt.");
          }

          const data = normalizeItems(await response.json());
          const storedItems = loadStoredItems();
          const hasStoredState = storedItems !== null;
          const nextItems = hasStoredState ? storedItems : data;

          if (!isMounted) {
            return;
          }

          setSeedItems(data);
          setItems(sortByName(nextItems));
          setFeedback(
            hasStoredState
              ? "A korábbi React-állapot localStorage-ból töltődött vissza."
              : "Az alapadatok sikeresen betöltődtek a React nézetbe."
          );
        } catch (error) {
          console.error(error);
          if (isMounted) {
            setErrorMessage("A React CRUD jelenleg nem tudta betölteni az adatforrást.");
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }

      loadData();

      return () => {
        isMounted = false;
      };
    }, []);

    useEffect(() => {
      if (!isLoading && !errorMessage) {
        persistItems(items);
      }
    }, [items, isLoading, errorMessage]);

    const categories = useMemo(
      () => [...new Set(items.map((item) => item.kategoria))].sort((left, right) => left.localeCompare(right, "hu")),
      [items]
    );

    const filteredItems = useMemo(() => {
      const searchValue = deferredSearchTerm.trim().toLowerCase();

      return items.filter((item) => {
        const matchesCategory = categoryFilter === "osszes" || item.kategoria === categoryFilter;
        const matchesSearch =
          !searchValue || `${item.nev} ${item.kategoria}`.toLowerCase().includes(searchValue);

        return matchesCategory && matchesSearch;
      });
    }, [items, categoryFilter, deferredSearchTerm]);

    const selectedItem = useMemo(
      () => items.find((item) => item.id === editingId) ?? null,
      [items, editingId]
    );

    function handleDraftChange(field, value) {
      setDraft((current) => ({ ...current, [field]: value }));
    }

    function resetEditor(message) {
      setEditingId(null);
      setDraft({ nev: "", kategoria: "" });
      if (message) {
        setFeedback(message);
      }
    }

    function handleSubmit(event) {
      event.preventDefault();

      const name = draft.nev.trim();
      const category = draft.kategoria.trim();

      if (!name || !category) {
        setFeedback("A név és a kategória kitöltése kötelező a React űrlapon is.");
        return;
      }

      if (editingId === null) {
        const createdItem = {
          id: getNextId(items),
          nev: name,
          kategoria: category,
        };

        setItems((current) => sortByName([createdItem, ...current]));
        resetEditor(`Új React-rekord mentve: ${name}.`);
        return;
      }

      setItems((current) =>
        sortByName(
          current.map((item) => (item.id === editingId ? { ...item, nev: name, kategoria: category } : item))
        )
      );
      resetEditor(`A rekord frissítve lett: ${name}.`);
    }

    function handleEdit(item) {
      setEditingId(item.id);
      setDraft({ nev: item.nev, kategoria: item.kategoria });
      setFeedback(`Szerkesztés alatt: ${item.nev}.`);
    }

    function handleDelete(item) {
      const confirmed = window.confirm(`Biztosan törlöd ezt a rekordot: ${item.nev}?`);
      if (!confirmed) {
        return;
      }

      setItems((current) => current.filter((entry) => entry.id !== item.id));

      if (editingId === item.id) {
        resetEditor(`A rekord törölve lett: ${item.nev}.`);
        return;
      }

      setFeedback(`A rekord törölve lett: ${item.nev}.`);
    }

    function handleResetData() {
      const resetItems = sortByName(seedItems);
      setItems(resetItems);
      setCategoryFilter("osszes");
      setSearchTerm("");
      resetEditor("A React CRUD visszaállt az eredeti JSON alapadatokra.");
    }

    if (isLoading) {
      return html`
        <section className="panel">
          <p className="eyebrow">React CRUD</p>
          <h1>Betöltés folyamatban</h1>
          <p className="lead">A komponensek összeállnak, az adatok rögtön érkeznek.</p>
        </section>
      `;
    }

    if (errorMessage) {
      return html`
        <header className="page-header">
          <a className="back-link" href="./index.html">Vissza a főmenübe</a>
          <span className="status">Hibás állapot</span>
        </header>
        <section className="panel">
          <p className="eyebrow">React CRUD</p>
          <h1>Adatbetöltési hiba</h1>
          <p className="lead">${errorMessage}</p>
        </section>
      `;
    }

    const summaryCards = [
      {
        label: "Látható elemek",
        value: filteredItems.length,
        detail: isPending ? "A keresőmező frissítése folyamatban van." : "A jelenlegi szűrés alapján.",
      },
      {
        label: "Összes rekord",
        value: items.length,
        detail: "Ez a React nézet saját localStorage állapota.",
      },
      {
        label: "Kategóriák",
        value: categories.length,
        detail: "Dinamikusan számolva az aktuális listából.",
      },
      {
        label: "Szerkesztés mód",
        value: selectedItem ? selectedItem.nev : "új elem",
        detail: selectedItem ? selectedItem.kategoria : "Nincs kiválasztott rekord.",
      },
    ];

    return html`
      <header className="page-header">
        <a className="back-link" href="./index.html">Vissza a főmenübe</a>
        <span className="status">React CRUD aktív</span>
      </header>

      <section className="hero">
        <p className="eyebrow">Komponens alapú kliensoldali nézet</p>
        <h1>React CRUD</h1>
        <p className="lead">
          Ez az oldal ugyanazt a szoftverleltár-adatkört kezeli, mint a sima JavaScript változat, de már React
          komponensekkel, származtatott állapottal és reszponzív szűréssel.
        </p>
        <div className="button-row">
          <a className="button primary" href="./javascript.html">JavaScript változat</a>
          <button className="button" type="button" onClick=${handleResetData}>React adatok visszaállítása</button>
        </div>
      </section>

      <section className="section card-grid">
        ${summaryCards.map(
          (card) => html`
            <${SummaryCard}
              key=${card.label}
              label=${card.label}
              value=${card.value}
              detail=${card.detail}
            />
          `
        )}
      </section>

      <section className="panel react-toolbar-panel">
        <div className="react-toolbar">
          <div className="field-group">
            <label className="field-label" htmlFor="reactSearchInput">Keresés névre vagy kategóriára</label>
            <input
              id="reactSearchInput"
              className="text-input"
              type="search"
              value=${searchTerm}
              placeholder="Pl. böngésző vagy Visual Studio Code"
              onChange=${(event) =>
                startTransition(() => {
                  setSearchTerm(event.target.value);
                })}
            />
          </div>
          <div className="react-insight">
            <p className="summary-label">Állapot</p>
            <strong>${isPending ? "Szűrés frissül..." : "Minden komponens szinkronban"}</strong>
            <p>${feedback}</p>
          </div>
        </div>
        <div className="stack-form">
          <div className="field-group">
            <span className="field-label">Kategória szűrő</span>
            <${CategoryFilter}
              categories=${categories}
              activeCategory=${categoryFilter}
              onSelect=${setCategoryFilter}
            />
          </div>
        </div>
      </section>

      <section className="panel react-layout">
        <section className="react-main">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Program neve</th>
                  <th>Kategória</th>
                  <th>Művelet</th>
                </tr>
              </thead>
              <tbody>
                ${filteredItems.length === 0
                  ? html`
                      <tr>
                        <td colSpan="4">
                          <div className="empty-state-box">Nincs találat a jelenlegi React-szűrésre.</div>
                        </td>
                      </tr>
                    `
                  : filteredItems.map(
                      (item) => html`
                        <tr key=${item.id} className=${item.id === editingId ? "is-selected" : ""}>
                          <td>${item.id}</td>
                          <td>
                            <strong>${item.nev}</strong>
                          </td>
                          <td><span className="table-badge">${item.kategoria}</span></td>
                          <td>
                            <div className="row-actions">
                              <button className="mini-button" type="button" onClick=${() => handleEdit(item)}>
                                Szerkesztés
                              </button>
                              <button className="mini-button danger" type="button" onClick=${() => handleDelete(item)}>
                                Törlés
                              </button>
                            </div>
                          </td>
                        </tr>
                      `
                    )}
              </tbody>
            </table>
          </div>
          <p className="muted-line">
            ${filteredItems.length} rekord látható, ${items.length} rekord van eltárolva a React nézetben.
          </p>
        </section>

        <aside className="panel react-side-panel">
          <p className="eyebrow">Űrlap</p>
          <h2>${editingId === null ? "Új szoftver felvétele" : "Szoftver szerkesztése"}</h2>
          <form className="stack-form" onSubmit=${handleSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="reactNameInput">Szoftver neve</label>
              <input
                id="reactNameInput"
                className="text-input"
                type="text"
                maxLength="255"
                value=${draft.nev}
                onChange=${(event) => handleDraftChange("nev", event.target.value)}
                required
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="reactCategoryInput">Kategória</label>
              <input
                id="reactCategoryInput"
                className="text-input"
                type="text"
                maxLength="255"
                value=${draft.kategoria}
                onChange=${(event) => handleDraftChange("kategoria", event.target.value)}
                required
              />
            </div>
            <div className="form-actions">
              <button className="button primary" type="submit">${editingId === null ? "Mentés" : "Frissítés"}</button>
              <button className="button" type="button" onClick=${() => resetEditor("Az űrlap alaphelyzetbe állt.")}>
                Szerkesztés megszakítása
              </button>
            </div>
          </form>
          <div className="react-note">
            <p className="summary-label">React megjegyzés</p>
            <p>
              A keresés átmenetes frissítéssel fut, az űrlap pedig külön állapotban kezeli az aktuális szerkesztést.
            </p>
          </div>
        </aside>
      </section>
    `;
  }

  const container = document.querySelector("#react-root");
  createRoot(container).render(html`<${ReactCrudApp} />`);
})();
