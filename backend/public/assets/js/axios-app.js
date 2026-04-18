(function bootstrapAxiosCrud() {
  const { useDeferredValue, useEffect, useMemo, useState, useTransition } = React;
  const { createRoot } = ReactDOM;
  const html = htm.bind(React.createElement);

  const API_URL = "./api/v1/software";
  const PREFERENCES_KEY = "web1-axios-crud-preferences";

  const api = axios.create({
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

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
      .filter((item) => Number.isFinite(item.id) && item.nev && item.kategoria)
      .sort((left, right) => left.nev.localeCompare(right.nev, "hu"));
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

  function loadPreferences() {
    try {
      const raw = localStorage.getItem(PREFERENCES_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      return {
        categoryFilter: String(parsed.categoryFilter ?? "osszes"),
        searchTerm: String(parsed.searchTerm ?? ""),
      };
    } catch (error) {
      console.error("Nem sikerült visszaolvasni az Axios beállításokat.", error);
      return null;
    }
  }

  function AxiosCrudApp() {
    const [items, setItems] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState({ nev: "", kategoria: "" });
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("osszes");
    const [feedback, setFeedback] = useState("Az Axios nézet inicializálása folyamatban van.");
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isBusy, setIsBusy] = useState(false);
    const [isPending, startTransition] = useTransition();
    const deferredSearch = useDeferredValue(searchTerm);

    useEffect(() => {
      const preferences = loadPreferences();
      if (preferences) {
        setSearchTerm(preferences.searchTerm);
        setCategoryFilter(preferences.categoryFilter);
      }
    }, []);

    useEffect(() => {
      localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify({
          searchTerm,
          categoryFilter,
        })
      );
    }, [searchTerm, categoryFilter]);

    useEffect(() => {
      let isMounted = true;

      async function bootstrap() {
        try {
          const nextItems = await fetchItems();
          if (!isMounted) {
            return;
          }

          setItems(nextItems);
          setFeedback("Az Axios kliens sikeresen betöltötte a szerveroldali listát.");
        } catch (error) {
          console.error(error);
          if (isMounted) {
            setErrorMessage(getErrorMessage(error));
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }

      bootstrap();

      return () => {
        isMounted = false;
      };
    }, []);

    const categories = useMemo(
      () => [...new Set(items.map((item) => item.kategoria))].sort((left, right) => left.localeCompare(right, "hu")),
      [items]
    );

    const filteredItems = useMemo(() => {
      const query = deferredSearch.trim().toLowerCase();

      return items.filter((item) => {
        const matchesCategory = categoryFilter === "osszes" || item.kategoria === categoryFilter;
        const matchesSearch = !query || `${item.nev} ${item.kategoria}`.toLowerCase().includes(query);

        return matchesCategory && matchesSearch;
      });
    }, [items, categoryFilter, deferredSearch]);

    const selectedItem = useMemo(
      () => items.find((item) => item.id === editingId) ?? null,
      [items, editingId]
    );

    async function fetchItems() {
      const response = await api.get(API_URL);
      return normalizeItems(response.data?.items);
    }

    function resetEditor(message) {
      setEditingId(null);
      setDraft({ nev: "", kategoria: "" });
      if (message) {
        setFeedback(message);
      }
    }

    function handleDraftChange(field, value) {
      setDraft((current) => ({ ...current, [field]: value }));
    }

    async function handleReload() {
      setIsBusy(true);

      try {
        const nextItems = await fetchItems();
        setItems(nextItems);
        setFeedback("Az Axios kliens frissítette a szerveroldali listát.");
      } catch (error) {
        console.error(error);
        setFeedback(getErrorMessage(error));
      } finally {
        setIsBusy(false);
      }
    }

    async function handleSubmit(event) {
      event.preventDefault();

      const name = draft.nev.trim();
      const category = draft.kategoria.trim();

      if (!name || !category) {
        setFeedback("Az Axios űrlapon is kötelező a név és a kategória megadása.");
        return;
      }

      setIsBusy(true);

      try {
        if (editingId === null) {
          const response = await api.post(API_URL, {
            nev: name,
            kategoria: category,
          });

          const createdItem = normalizeItems([response.data?.item])[0];
          setItems((current) => normalizeItems([createdItem, ...current]));
          resetEditor(`Új rekord mentve Axioson keresztül: ${createdItem.nev}.`);
        } else {
          const response = await api.patch(`${API_URL}/${editingId}`, {
            nev: name,
            kategoria: category,
          });

          const updatedItem = normalizeItems([response.data?.item])[0];
          setItems((current) =>
            normalizeItems(current.map((item) => (item.id === editingId ? updatedItem : item)))
          );
          resetEditor(`A rekord Axioson keresztül frissült: ${updatedItem.nev}.`);
        }
      } catch (error) {
        console.error(error);
        setFeedback(getErrorMessage(error));
      } finally {
        setIsBusy(false);
      }
    }

    function handleEdit(item) {
      setEditingId(item.id);
      setDraft({ nev: item.nev, kategoria: item.kategoria });
      setFeedback(`Szerkesztés alatt: ${item.nev}.`);
    }

    async function handleDelete(item) {
      const confirmed = window.confirm(`Biztosan törlöd ezt a rekordot: ${item.nev}?`);
      if (!confirmed) {
        return;
      }

      setIsBusy(true);

      try {
        await api.delete(`${API_URL}/${item.id}`);
        setItems((current) => current.filter((entry) => entry.id !== item.id));

        if (editingId === item.id) {
          resetEditor(`A rekord törölve lett: ${item.nev}.`);
        } else {
          setFeedback(`A rekord törölve lett: ${item.nev}.`);
        }
      } catch (error) {
        console.error(error);
        setFeedback(getErrorMessage(error));
      } finally {
        setIsBusy(false);
      }
    }

    if (isLoading) {
      return html`
        <section className="panel">
          <p className="eyebrow">Axios CRUD</p>
          <h1>Betöltés folyamatban</h1>
          <p className="lead">Az Axios kliens most kapcsolódik a PHP backendhez.</p>
        </section>
      `;
    }

    if (errorMessage) {
      return html`
        <header className="page-header">
          <a className="back-link" href="./index.html">Vissza a főmenübe</a>
          <span className="status">Axios hiba</span>
        </header>
        <section className="panel">
          <p className="eyebrow">Axios + React</p>
          <h1>Kapcsolódási hiba</h1>
          <p className="lead">${errorMessage}</p>
        </section>
      `;
    }

    const summaryCards = [
      {
        label: "Látható elemek",
        value: filteredItems.length,
        detail: isPending ? "A React kereső állapota most frissül." : "A jelenlegi keresés és kategóriaszűrés alapján.",
      },
      {
        label: "Backend rekordok",
        value: items.length,
        detail: "Axioson keresztül betöltve a PHP CRUD API-ról.",
      },
      {
        label: "Kategóriák",
        value: categories.length,
        detail: "A szerveroldali lista alapján számolva.",
      },
      {
        label: "Szerkesztés alatt",
        value: selectedItem ? selectedItem.nev : "nincs",
        detail: selectedItem ? selectedItem.kategoria : "Új rekord felvétele mód.",
      },
    ];

    return html`
      <header className="page-header">
        <a className="back-link" href="./index.html">Vissza a főmenübe</a>
        <span className="status">Axios CRUD aktív</span>
      </header>

      <section className="hero">
        <p className="eyebrow">React komponensek + Axios kliens</p>
        <h1>Axios CRUD</h1>
        <p className="lead">
          Ez az oldal ugyanarra a PHP backend API-ra kapcsolódik, mint a Fetch változat, de itt az adatlekérés,
          létrehozás, módosítás és törlés már Axios kliensen keresztül történik, React állapotkezeléssel.
        </p>
        <div className="button-row">
          <a className="button" href="./fetchapi.html">Fetch API nézet</a>
          <button className="button primary" type="button" onClick=${handleReload} disabled=${isBusy}>
            Lista frissítése
          </button>
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
            <label className="field-label" htmlFor="axiosSearchInput">Keresés névre vagy kategóriára</label>
            <input
              id="axiosSearchInput"
              className="text-input"
              type="search"
              value=${searchTerm}
              placeholder="Pl. fejlesztői eszköz vagy Microsoft"
              onChange=${(event) =>
                startTransition(() => {
                  setSearchTerm(event.target.value);
                })}
            />
          </div>
          <div className="react-insight">
            <p className="summary-label">Axios állapot</p>
            <strong>${isBusy ? "Kérés folyamatban..." : "API kapcsolat rendben"}</strong>
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
                          <div className="empty-state-box">
                            ${isBusy ? "Szerverválaszra várunk..." : "Nincs találat a jelenlegi Axios-szűrésre."}
                          </div>
                        </td>
                      </tr>
                    `
                  : filteredItems.map(
                      (item) => html`
                        <tr key=${item.id} className=${item.id === editingId ? "is-selected" : ""}>
                          <td>${item.id}</td>
                          <td><strong>${item.nev}</strong></td>
                          <td><span className="table-badge">${item.kategoria}</span></td>
                          <td>
                            <div className="row-actions">
                              <button className="mini-button" type="button" onClick=${() => handleEdit(item)} disabled=${isBusy}>
                                Szerkesztés
                              </button>
                              <button
                                className="mini-button danger"
                                type="button"
                                onClick=${() => handleDelete(item)}
                                disabled=${isBusy}
                              >
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
            ${filteredItems.length} rekord látható, ${items.length} rekord van jelenleg a szerveren.
          </p>
        </section>

        <aside className="panel react-side-panel">
          <p className="eyebrow">Űrlap</p>
          <h2>${editingId === null ? "Új szoftver felvétele" : "Szoftver szerkesztése"}</h2>
          <form className="stack-form" onSubmit=${handleSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="axiosNameInput">Szoftver neve</label>
              <input
                id="axiosNameInput"
                className="text-input"
                type="text"
                maxLength="255"
                value=${draft.nev}
                onChange=${(event) => handleDraftChange("nev", event.target.value)}
                required
                disabled=${isBusy}
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="axiosCategoryInput">Kategória</label>
              <input
                id="axiosCategoryInput"
                className="text-input"
                type="text"
                maxLength="255"
                value=${draft.kategoria}
                onChange=${(event) => handleDraftChange("kategoria", event.target.value)}
                required
                disabled=${isBusy}
              />
            </div>
            <div className="form-actions">
              <button className="button primary" type="submit" disabled=${isBusy}>
                ${editingId === null ? "Mentés" : "Módosítás mentése"}
              </button>
              <button className="button" type="button" onClick=${() => resetEditor("Az Axios űrlap alaphelyzetbe állt.")} disabled=${isBusy}>
                Szerkesztés megszakítása
              </button>
            </div>
          </form>
          <div className="react-note">
            <p className="summary-label">Mi a különbség?</p>
            <p>
              A Fetch oldallal azonos backendet használ, de itt az API-hívásokat és a hibakezelést az Axios kliens
              egyszerűsíti.
            </p>
          </div>
        </aside>
      </section>
    `;
  }

  function getErrorMessage(error) {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.message || error.message || "Az Axios kérés nem sikerült.";
    }

    return "Váratlan hiba történt az Axios kliensben.";
  }

  const root = document.querySelector("#axios-root");
  createRoot(root).render(html`<${AxiosCrudApp} />`);
})();
