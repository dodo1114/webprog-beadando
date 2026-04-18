(function bootstrapSpa() {
  const { useDeferredValue, useEffect, useMemo, useState, useTransition } = React;
  const { createRoot } = ReactDOM;
  const html = htm.bind(React.createElement);

  const STORAGE_KEY = "web1-spa-suite";
  const DATA_URL = "./data/software.json";
  const DEFAULT_ROUTE = "catalog";

  function SummaryCard({ label, value, detail }) {
    return html`
      <article className="card summary-card">
        <p className="summary-label">${label}</p>
        <strong className="summary-value">${value}</strong>
        <p>${detail}</p>
      </article>
    `;
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
      .filter((item) => Number.isFinite(item.id) && item.nev && item.kategoria)
      .sort((left, right) => left.nev.localeCompare(right.nev, "hu"));
  }

  function readStoredSuite() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      return {
        selectedIds: Array.isArray(parsed.selectedIds) ? parsed.selectedIds.map(Number).filter(Number.isFinite) : [],
        stationName: String(parsed.stationName ?? "").trim(),
        packageName: String(parsed.packageName ?? "").trim(),
        notes: String(parsed.notes ?? "").trim(),
      };
    } catch (error) {
      console.error("Nem sikerült visszatölteni az SPA állapotát.", error);
      return null;
    }
  }

  function getRouteFromHash() {
    const hash = window.location.hash.replace(/^#/, "").trim().toLowerCase();
    return hash === "planner" ? "planner" : DEFAULT_ROUTE;
  }

  function RouteButton({ route, activeRoute, label, onNavigate }) {
    return html`
      <button
        className=${`chip-button ${route === activeRoute ? "is-active" : ""}`}
        type="button"
        onClick=${() => onNavigate(route)}
      >
        ${label}
      </button>
    `;
  }

  function InventoryCard({ item, isSelected, onToggle }) {
    return html`
      <article className=${`card spa-software-card ${isSelected ? "is-selected" : ""}`}>
        <p className="summary-label">#${item.id}</p>
        <h3>${item.nev}</h3>
        <p><span className="table-badge">${item.kategoria}</span></p>
        <button
          className=${`button ${isSelected ? "" : "primary"}`}
          type="button"
          onClick=${() => onToggle(item.id)}
        >
          ${isSelected ? "Kivétel a csomagból" : "Hozzáadás a csomaghoz"}
        </button>
      </article>
    `;
  }

  function CatalogView({
    filteredItems,
    categories,
    activeCategory,
    onCategoryChange,
    searchTerm,
    onSearchChange,
    selectedIds,
    onToggleSelection,
    selectedItems,
    onNavigate,
    isPending,
  }) {
    return html`
      <section className="panel">
        <div className="react-toolbar">
          <div className="field-group">
            <label className="field-label" htmlFor="spaSearchInput">Keresés névre vagy kategóriára</label>
            <input
              id="spaSearchInput"
              className="text-input"
              type="search"
              value=${searchTerm}
              placeholder="Pl. böngésző vagy PDF-kezelő"
              onChange=${onSearchChange}
            />
          </div>
          <div className="react-insight">
            <p className="summary-label">Aktív miniapp</p>
            <strong>${isPending ? "Szűrés frissül..." : "Leltár áttekintő"}</strong>
            <p>
              A katalógus miniappban kijelölheted, mely programok kerüljenek a telepítési csomagba, majd egy
              kattintással továbbléphetsz a tervező nézetre.
            </p>
          </div>
        </div>
        <div className="stack-form">
          <div className="field-group">
            <span className="field-label">Kategória szűrő</span>
            <div className="chip-list">
              <button
                className=${`chip-button ${activeCategory === "osszes" ? "is-active" : ""}`}
                type="button"
                onClick=${() => onCategoryChange("osszes")}
              >
                Minden kategória
              </button>
              ${categories.map(
                (category) => html`
                  <button
                    key=${category}
                    className=${`chip-button ${activeCategory === category ? "is-active" : ""}`}
                    type="button"
                    onClick=${() => onCategoryChange(category)}
                  >
                    ${category}
                  </button>
                `
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="spa-layout">
        <section className="spa-main">
          <div className="spa-card-grid">
            ${filteredItems.length === 0
              ? html`
                  <section className="panel">
                    <div className="empty-state-box">Nincs találat a jelenlegi SPA-szűrésre.</div>
                  </section>
                `
              : filteredItems.map(
                  (item) => html`
                    <${InventoryCard}
                      key=${item.id}
                      item=${item}
                      isSelected=${selectedIds.includes(item.id)}
                      onToggle=${onToggleSelection}
                    />
                  `
                )}
          </div>
        </section>

        <aside className="panel spa-side-panel">
          <p className="eyebrow">Gyors csomagkép</p>
          <h2>Kijelölt szoftverek</h2>
          <p className="lead">
            A kiválasztott elemek automatikusan átkerülnek a tervező miniappba, így az egész felület egyetlen SPA-ként
            működik közös állapottal.
          </p>
          <div className="spa-selected-list">
            ${selectedItems.length === 0
              ? html`<p className="muted-line">Még nincs kijelölt szoftver a csomagban.</p>`
              : selectedItems.map(
                  (item) => html`
                    <div key=${item.id} className="spa-selected-item">
                      <div>
                        <strong>${item.nev}</strong>
                        <p>${item.kategoria}</p>
                      </div>
                      <button className="mini-button danger" type="button" onClick=${() => onToggleSelection(item.id)}>
                        Eltávolítás
                      </button>
                    </div>
                  `
                )}
          </div>
          <button className="button primary" type="button" onClick=${() => onNavigate("planner")}>
            Tovább a telepítési tervhez
          </button>
        </aside>
      </section>
    `;
  }

  function PlannerView({
    selectedItems,
    packageName,
    stationName,
    notes,
    onFieldChange,
    groupedItems,
    onToggleSelection,
    onClearSelection,
    onNavigate,
  }) {
    const planPreview =
      selectedItems.length === 0
        ? "Nincs még kiválasztott program, ezért a telepítési terv még üres."
        : [
            `Telepítési csomag: ${packageName || "Névtelen csomag"}`,
            `Célállomás: ${stationName || "Nincs megadva"}`,
            `Összes kiválasztott szoftver: ${selectedItems.length}`,
            "",
            ...Object.entries(groupedItems).flatMap(([category, items]) => [
              `${category}:`,
              ...items.map((item) => `- ${item.nev}`),
              "",
            ]),
            notes ? `Megjegyzés: ${notes}` : "",
          ]
            .filter(Boolean)
            .join("\n");

    return html`
      <section className="spa-layout">
        <section className="spa-main">
          <section className="panel">
            <p className="eyebrow">Miniapp 2</p>
            <h2>Telepítési csomagtervező</h2>
            <p className="lead">
              Ez a nézet ugyanazt a kijelölt listát használja, mint a katalógus, de itt már célgépre és csomagnévre
              bontva állítható össze a végső szoftverkészlet.
            </p>
            <form className="stack-form spa-form">
              <div className="field-group">
                <label className="field-label" htmlFor="spaPackageName">Csomag neve</label>
                <input
                  id="spaPackageName"
                  className="text-input"
                  type="text"
                  value=${packageName}
                  onChange=${(event) => onFieldChange("packageName", event.target.value)}
                  placeholder="Pl. Tantermi gép alapcsomag"
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="spaStationName">Célállomás</label>
                <input
                  id="spaStationName"
                  className="text-input"
                  type="text"
                  value=${stationName}
                  onChange=${(event) => onFieldChange("stationName", event.target.value)}
                  placeholder="Pl. Labor 3 / Gép 12"
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="spaNotes">Megjegyzés</label>
                <textarea
                  id="spaNotes"
                  className="text-input spa-textarea"
                  onChange=${(event) => onFieldChange("notes", event.target.value)}
                >${notes}</textarea>
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="spa-section-heading">
              <div>
                <p className="eyebrow">Összeállított csomag</p>
                <h2>Kategóriák szerint csoportosítva</h2>
              </div>
              <button className="button" type="button" onClick=${onClearSelection}>
                Csomag ürítése
              </button>
            </div>

            ${selectedItems.length === 0
              ? html`<div className="empty-state-box">Válassz ki néhány szoftvert a katalógus miniappból.</div>`
              : Object.entries(groupedItems).map(
                  ([category, items]) => html`
                    <section key=${category} className="spa-group">
                      <div className="spa-group-header">
                        <h3>${category}</h3>
                        <span className="table-badge">${items.length} elem</span>
                      </div>
                      <div className="spa-selected-list">
                        ${items.map(
                          (item) => html`
                            <div key=${item.id} className="spa-selected-item">
                              <div>
                                <strong>${item.nev}</strong>
                                <p>#${item.id}</p>
                              </div>
                              <button
                                className="mini-button danger"
                                type="button"
                                onClick=${() => onToggleSelection(item.id)}
                              >
                                Kivétel
                              </button>
                            </div>
                          `
                        )}
                      </div>
                    </section>
                  `
                )}
          </section>
        </section>

        <aside className="panel spa-side-panel">
          <p className="eyebrow">Automatikus nézet</p>
          <h2>Telepítési előnézet</h2>
          <p className="muted-line">
            Ez a blokk a közös SPA-állapotból állít elő egy gyors telepítési jegyzéket.
          </p>
          <pre className="spa-preview">${planPreview}</pre>
          <div className="form-actions">
            <button className="button primary" type="button" onClick=${() => onNavigate("catalog")}>
              Vissza a katalógushoz
            </button>
          </div>
        </aside>
      </section>
    `;
  }

  function SpaApp() {
    const [items, setItems] = useState([]);
    const [activeRoute, setActiveRoute] = useState(getRouteFromHash());
    const [searchTerm, setSearchTerm] = useState("");
    const [activeCategory, setActiveCategory] = useState("osszes");
    const [selectedIds, setSelectedIds] = useState([]);
    const [packageName, setPackageName] = useState("");
    const [stationName, setStationName] = useState("");
    const [notes, setNotes] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [isPending, startTransition] = useTransition();
    const deferredSearch = useDeferredValue(searchTerm);

    useEffect(() => {
      const handleHashChange = () => {
        startTransition(() => {
          setActiveRoute(getRouteFromHash());
        });
      };

      window.addEventListener("hashchange", handleHashChange);
      return () => window.removeEventListener("hashchange", handleHashChange);
    }, []);

    useEffect(() => {
      let isMounted = true;

      async function loadData() {
        try {
          const response = await fetch(DATA_URL, { cache: "no-store" });
          if (!response.ok) {
            throw new Error("Nem sikerült betölteni az SPA alapadatait.");
          }

          const nextItems = normalizeItems(await response.json());
          const storedSuite = readStoredSuite();

          if (!isMounted) {
            return;
          }

          setItems(nextItems);

          if (storedSuite) {
            setSelectedIds(storedSuite.selectedIds);
            setPackageName(storedSuite.packageName);
            setStationName(storedSuite.stationName);
            setNotes(storedSuite.notes);
          }
        } catch (error) {
          console.error(error);
          if (isMounted) {
            setErrorMessage("Az SPA felület nem tudta betölteni az adatkészletet.");
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
      if (isLoading || errorMessage) {
        return;
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          selectedIds,
          packageName,
          stationName,
          notes,
        })
      );
    }, [selectedIds, packageName, stationName, notes, isLoading, errorMessage]);

    const categories = useMemo(
      () => [...new Set(items.map((item) => item.kategoria))].sort((left, right) => left.localeCompare(right, "hu")),
      [items]
    );

    const filteredItems = useMemo(() => {
      const searchValue = deferredSearch.trim().toLowerCase();

      return items.filter((item) => {
        const matchesCategory = activeCategory === "osszes" || item.kategoria === activeCategory;
        const matchesSearch = !searchValue || `${item.nev} ${item.kategoria}`.toLowerCase().includes(searchValue);

        return matchesCategory && matchesSearch;
      });
    }, [items, activeCategory, deferredSearch]);

    const selectedItems = useMemo(
      () => items.filter((item) => selectedIds.includes(item.id)),
      [items, selectedIds]
    );

    const groupedItems = useMemo(() => {
      return selectedItems.reduce((groups, item) => {
        if (!groups[item.kategoria]) {
          groups[item.kategoria] = [];
        }

        groups[item.kategoria].push(item);
        return groups;
      }, {});
    }, [selectedItems]);

    function navigate(route) {
      window.location.hash = route === DEFAULT_ROUTE ? "#catalog" : "#planner";
      startTransition(() => {
        setActiveRoute(route);
      });
    }

    function handleFieldChange(field, value) {
      if (field === "packageName") {
        setPackageName(value);
      }

      if (field === "stationName") {
        setStationName(value);
      }

      if (field === "notes") {
        setNotes(value);
      }
    }

    function toggleSelection(id) {
      setSelectedIds((current) => (current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]));
    }

    function clearSelection() {
      setSelectedIds([]);
    }

    if (isLoading) {
      return html`
        <section className="panel">
          <p className="eyebrow">SPA</p>
          <h1>Betöltés folyamatban</h1>
          <p className="lead">Az egyoldalas alkalmazás összeállítja a két miniapp közös állapotát.</p>
        </section>
      `;
    }

    if (errorMessage) {
      return html`
        <header className="page-header">
          <a className="back-link" href="./index.html">Vissza a főmenübe</a>
          <span className="status">SPA hiba</span>
        </header>
        <section className="panel">
          <p className="eyebrow">Egyoldalas alkalmazás</p>
          <h1>Adatbetöltési hiba</h1>
          <p className="lead">${errorMessage}</p>
        </section>
      `;
    }

    const summaryCards = [
      {
        label: "Miniappok",
        value: 2,
        detail: "Katalógus és telepítési csomagtervező egy közös SPA-n belül.",
      },
      {
        label: "Betöltött rekordok",
        value: items.length,
        detail: "A közös adatkészletet mindkét nézet ugyanabból az állapotból használja.",
      },
      {
        label: "Kijelölt csomag",
        value: selectedItems.length,
        detail: "Ennyi szoftver került át a közös telepítési listába.",
      },
      {
        label: "Aktív nézet",
        value: activeRoute === "catalog" ? "katalógus" : "tervező",
        detail: "Hash-alapú navigáció teljes oldalfrissítés nélkül.",
      },
    ];

    return html`
      <header className="page-header">
        <a className="back-link" href="./index.html">Vissza a főmenübe</a>
        <span className="status">SPA aktív</span>
      </header>

      <section className="hero">
        <p className="eyebrow">Egyoldalas alkalmazás közös állapottal</p>
        <h1>SPA Suite</h1>
        <p className="lead">
          Ez a rész két miniappot fog össze egyetlen React SPA-ban. A katalógus nézetben kijelölheted a releváns
          szoftvereket, a telepítési tervező nézetben pedig ugyanebből az állapotból összeállíthatod a célgépre szánt
          csomagot.
        </p>
        <div className="button-row">
          <a className="button" href="./react.html">React CRUD</a>
          <a className="button primary" href="./fetchapi.html">Fetch API CRUD</a>
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

      <section className="panel">
        <div className="spa-route-bar">
          <div>
            <p className="eyebrow">Navigáció</p>
            <h2>Két miniapp, egyetlen oldal</h2>
          </div>
          <div className="chip-list">
            <${RouteButton}
              route="catalog"
              activeRoute=${activeRoute}
              label="Katalógus miniapp"
              onNavigate=${navigate}
            />
            <${RouteButton}
              route="planner"
              activeRoute=${activeRoute}
              label="Telepítési tervező"
              onNavigate=${navigate}
            />
          </div>
        </div>
      </section>

      ${activeRoute === "catalog"
        ? html`
            <${CatalogView}
              filteredItems=${filteredItems}
              categories=${categories}
              activeCategory=${activeCategory}
              onCategoryChange=${setActiveCategory}
              searchTerm=${searchTerm}
              onSearchChange=${(event) =>
                startTransition(() => {
                  setSearchTerm(event.target.value);
                })}
              selectedIds=${selectedIds}
              onToggleSelection=${toggleSelection}
              selectedItems=${selectedItems}
              onNavigate=${navigate}
              isPending=${isPending}
            />
          `
        : html`
            <${PlannerView}
              selectedItems=${selectedItems}
              packageName=${packageName}
              stationName=${stationName}
              notes=${notes}
              onFieldChange=${handleFieldChange}
              groupedItems=${groupedItems}
              onToggleSelection=${toggleSelection}
              onClearSelection=${clearSelection}
              onNavigate=${navigate}
            />
          `}
    `;
  }

  const root = document.querySelector("#spa-root");
  createRoot(root).render(html`<${SpaApp} />`);
})();
