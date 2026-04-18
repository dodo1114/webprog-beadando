const DATA_URL = "./data/software.json";
const STORAGE_KEY = "web1-oojs-workbench";

class BaseComponent {
  constructor(tagName = "div", className = "") {
    this.element = document.createElement(tagName);
    if (className) {
      this.element.className = className;
    }
  }

  mount(parent) {
    parent.appendChild(this.element);
    return this;
  }

  clear() {
    this.element.replaceChildren();
  }

  append(...children) {
    this.element.append(...children.filter(Boolean));
    return this;
  }
}

class CardComponent extends BaseComponent {
  constructor(className = "") {
    super("article", `card ${className}`.trim());
  }
}

class SummaryCard extends CardComponent {
  constructor({ label, value, detail }) {
    super("summary-card");
    this.element.innerHTML = `
      <p class="summary-label">${label}</p>
      <strong class="summary-value">${value}</strong>
      <p>${detail}</p>
    `;
  }
}

class SoftwareCard extends CardComponent {
  constructor(item, isSelected, onToggle) {
    super("oojs-software-card");
    this.item = item;
    this.isSelected = isSelected;
    this.onToggle = onToggle;
    this.render();
  }

  render() {
    this.element.classList.toggle("is-selected", this.isSelected);
    this.element.replaceChildren();

    const label = document.createElement("p");
    label.className = "summary-label";
    label.textContent = `#${this.item.id}`;

    const title = document.createElement("h3");
    title.textContent = this.item.nev;

    const categoryWrap = document.createElement("p");
    const badge = document.createElement("span");
    badge.className = "table-badge";
    badge.textContent = this.item.kategoria;
    categoryWrap.appendChild(badge);

    const button = document.createElement("button");
    button.className = `button ${this.isSelected ? "" : "primary"}`.trim();
    button.type = "button";
    button.textContent = this.isSelected ? "Eltávolítás a profilból" : "Hozzáadás a profilhoz";
    button.addEventListener("click", () => this.onToggle(this.item.id));

    this.append(label, title, categoryWrap, button);
  }
}

class ActivityLogEntry extends BaseComponent {
  constructor(entry) {
    super("article", "oojs-log-entry");
    this.element.innerHTML = `
      <strong>${entry.title}</strong>
      <p>${entry.description}</p>
    `;
  }
}

class WorkbenchApp {
  constructor(root) {
    this.root = root;
    this.state = {
      items: [],
      searchTerm: "",
      selectedCategory: "összes",
      selectedIds: [],
      deploymentMode: "standard",
      stationName: "",
      notes: "",
      feedback: "Az OOJS műhely betöltötte az alapnézetet.",
      isLoading: true,
      activityLog: [
        {
          title: "OOJS indulás",
          description: "A felület class alapú DOM-építéssel készül, React nélkül.",
        },
      ],
    };

    this.modeDefinitions = {
      standard: {
        label: "Standard csomag",
        detail: "Általános felhasználói géphez kiegyensúlyozott szoftverkészlet.",
      },
      office: {
        label: "Irodai gép",
        detail: "Dokumentumkezelésre és kommunikációra optimalizált profil.",
      },
      developer: {
        label: "Fejlesztői gép",
        detail: "Fejlesztőeszközöket előtérbe helyező telepítési profil.",
      },
    };
  }

  async init() {
    this.renderShell();
    await this.loadItems();
    this.render();
  }

  renderShell() {
    this.root.replaceChildren();

    this.pageHeader = new BaseComponent("header", "page-header");
    const backLink = document.createElement("a");
    backLink.className = "back-link";
    backLink.href = "./index.html";
    backLink.textContent = "Vissza a főmenübe";

    this.statusPill = document.createElement("span");
    this.statusPill.className = "status";
    this.statusPill.textContent = "OOJS műhely aktív";
    this.pageHeader.append(backLink, this.statusPill);

    this.hero = new BaseComponent("section", "hero");
    this.hero.element.innerHTML = `
      <p class="eyebrow">Objektumorientált JavaScript műhely</p>
      <h1>OOJS telepítési profil</h1>
      <p class="lead">
        Ez a nézet tisztán class alapú JavaScriptből épül fel. A szoftverleltár elemeiből
        összeállíthatsz egy telepítési profilt, közben a DOM-elemeket objektumok és öröklődő komponensek kezelik.
      </p>
    `;

    this.summaryGrid = new BaseComponent("section", "section card-grid");
    this.layout = new BaseComponent("section", "oojs-layout");
    this.mainColumn = new BaseComponent("section", "oojs-main");
    this.sidePanel = new BaseComponent("aside", "panel oojs-side-panel");
    this.layout.append(this.mainColumn.element, this.sidePanel.element);

    this.root.append(
      this.pageHeader.element,
      this.hero.element,
      this.summaryGrid.element,
      this.layout.element
    );
  }

  async loadItems() {
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Nem sikerült betölteni az OOJS adatforrást.");
      }

      const data = await response.json();
      this.state.items = Array.isArray(data)
        ? data
            .map((item) => ({
              id: Number(item.id),
              nev: String(item.nev ?? "").trim(),
              kategoria: String(item.kategoria ?? "").trim(),
            }))
            .filter((item) => Number.isFinite(item.id) && item.nev && item.kategoria)
            .sort((left, right) => left.nev.localeCompare(right.nev, "hu"))
        : [];

      this.restoreState();
      this.state.feedback = "Az OOJS felület betöltötte a szoftverleltárat.";
    } catch (error) {
      console.error(error);
      this.state.feedback = "Hiba történt az OOJS adatok betöltésekor.";
      this.state.activityLog.unshift({
        title: "Betöltési hiba",
        description: "Az adatforrás jelenleg nem elérhető.",
      });
    } finally {
      this.state.isLoading = false;
    }
  }

  restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      this.state.selectedIds = Array.isArray(parsed.selectedIds)
        ? parsed.selectedIds.map(Number).filter(Number.isFinite)
        : [];
      this.state.deploymentMode = this.modeDefinitions[parsed.deploymentMode] ? parsed.deploymentMode : "standard";
      this.state.stationName = String(parsed.stationName ?? "").trim();
      this.state.notes = String(parsed.notes ?? "").trim();
      this.state.searchTerm = String(parsed.searchTerm ?? "").trim();
      this.state.selectedCategory = String(parsed.selectedCategory ?? "összes").trim() || "összes";
    } catch (error) {
      console.error("Nem sikerült visszatölteni az OOJS állapotát.", error);
    }
  }

  persistState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedIds: this.state.selectedIds,
        deploymentMode: this.state.deploymentMode,
        stationName: this.state.stationName,
        notes: this.state.notes,
        searchTerm: this.state.searchTerm,
        selectedCategory: this.state.selectedCategory,
      })
    );
  }

  get categories() {
    return ["összes", ...new Set(this.state.items.map((item) => item.kategoria))];
  }

  get filteredItems() {
    const needle = this.state.searchTerm.trim().toLowerCase();

    return this.state.items.filter((item) => {
      const matchesCategory =
        this.state.selectedCategory === "összes" || item.kategoria === this.state.selectedCategory;
      const matchesSearch =
        needle === "" || `${item.nev} ${item.kategoria}`.toLowerCase().includes(needle);

      return matchesCategory && matchesSearch;
    });
  }

  get selectedItems() {
    const selectedSet = new Set(this.state.selectedIds);
    return this.state.items.filter((item) => selectedSet.has(item.id));
  }

  get deploymentPreview() {
    const mode = this.modeDefinitions[this.state.deploymentMode];
    const selectedNames = this.selectedItems.map((item) => `- ${item.nev} (${item.kategoria})`).join("\n");

    return [
      `ÁLLOMÁS: ${this.state.stationName || "Nincs megadva"}`,
      `MÓD: ${mode.label}`,
      "",
      "KIVÁLASZTOTT PROGRAMOK:",
      selectedNames || "- Még nincs kiválasztott program",
      "",
      "MEGJEGYZÉS:",
      this.state.notes || "Nincs külön megjegyzés.",
    ].join("\n");
  }

  setFeedback(message, title = "Művelet") {
    this.state.feedback = message;
    this.state.activityLog.unshift({
      title,
      description: message,
    });
    this.state.activityLog = this.state.activityLog.slice(0, 6);
  }

  toggleSelection(id) {
    const isSelected = this.state.selectedIds.includes(id);
    this.state.selectedIds = isSelected
      ? this.state.selectedIds.filter((value) => value !== id)
      : [...this.state.selectedIds, id];

    const item = this.state.items.find((entry) => entry.id === id);
    if (item) {
      this.setFeedback(
        isSelected
          ? `${item.nev} kikerült a telepítési profilból.`
          : `${item.nev} bekerült a telepítési profilba.`,
        isSelected ? "Eltávolítás" : "Kiválasztás"
      );
    }

    this.persistState();
    this.render();
  }

  setMode(mode) {
    this.state.deploymentMode = mode;
    this.setFeedback(`${this.modeDefinitions[mode].label} profil aktiválva.`, "Profilváltás");
    this.persistState();
    this.render();
  }

  updateSearch(value) {
    this.state.searchTerm = value;
    this.persistState();
    this.render();
  }

  updateCategory(value) {
    this.state.selectedCategory = value;
    this.persistState();
    this.render();
  }

  updateStationName(value) {
    this.state.stationName = value;
    this.persistState();
    this.renderSidePanel();
  }

  updateNotes(value) {
    this.state.notes = value;
    this.persistState();
    this.renderSidePanel();
  }

  resetAll() {
    this.state.selectedIds = [];
    this.state.deploymentMode = "standard";
    this.state.stationName = "";
    this.state.notes = "";
    this.state.searchTerm = "";
    this.state.selectedCategory = "összes";
    this.setFeedback("Az OOJS munkafelület visszaállt alaphelyzetbe.", "Alaphelyzet");
    this.persistState();
    this.render();
  }

  render() {
    this.renderSummary();
    this.renderMain();
    this.renderSidePanel();
  }

  renderSummary() {
    this.summaryGrid.clear();

    const cards = [
      {
        label: "Látható elemek",
        value: this.filteredItems.length,
        detail: "Az aktuális szűrés alapján az OOJS nézetben.",
      },
      {
        label: "Kiválasztott csomag",
        value: this.selectedItems.length,
        detail: "Ennyi program került be a telepítési profilba.",
      },
      {
        label: "Kategóriák",
        value: this.categories.length - 1,
        detail: "A szoftverleltár különböző kategóriáinak száma.",
      },
      {
        label: "Aktív profil",
        value: this.modeDefinitions[this.state.deploymentMode].label,
        detail: "Az OOJS műhely jelenlegi telepítési módja.",
      },
    ];

    cards.forEach((card) => new SummaryCard(card).mount(this.summaryGrid.element));
  }

  renderMain() {
    this.mainColumn.clear();

    const toolbarPanel = new BaseComponent("section", "panel");
    const toolbar = new BaseComponent("div", "oojs-toolbar");

    const searchGroup = new BaseComponent("div", "field-group");
    const searchLabel = document.createElement("label");
    searchLabel.className = "field-label";
    searchLabel.htmlFor = "oojsSearchInput";
    searchLabel.textContent = "Keresés névre vagy kategóriára";

    const searchInput = document.createElement("input");
    searchInput.id = "oojsSearchInput";
    searchInput.className = "text-input";
    searchInput.type = "search";
    searchInput.placeholder = "Pl. böngésző vagy fejlesztői eszköz";
    searchInput.value = this.state.searchTerm;
    searchInput.addEventListener("input", (event) => this.updateSearch(event.target.value));
    searchGroup.append(searchLabel, searchInput);

    const categoryGroup = new BaseComponent("div", "field-group");
    const categoryLabel = document.createElement("label");
    categoryLabel.className = "field-label";
    categoryLabel.htmlFor = "oojsCategorySelect";
    categoryLabel.textContent = "Kategória";

    const select = document.createElement("select");
    select.id = "oojsCategorySelect";
    select.className = "text-input";
    this.categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category === "összes" ? "Összes kategória" : category;
      option.selected = category === this.state.selectedCategory;
      select.appendChild(option);
    });
    select.addEventListener("change", (event) => this.updateCategory(event.target.value));
    categoryGroup.append(categoryLabel, select);

    const statusBox = new BaseComponent("div", "react-insight");
    statusBox.element.innerHTML = `
      <p class="summary-label">OOJS állapot</p>
      <strong>${this.state.isLoading ? "Betöltés..." : "Class alapú DOM-réteg aktív"}</strong>
      <p>${this.state.feedback}</p>
    `;

    toolbar.append(searchGroup.element, categoryGroup.element, statusBox.element);
    toolbarPanel.append(toolbar.element);

    const catalogPanel = new BaseComponent("section", "panel");
    const heading = new BaseComponent("div", "oojs-section-heading");
    heading.element.innerHTML = `
      <div>
        <p class="summary-label">Szoftverkártyák</p>
        <h2>Telepítési profil építése</h2>
      </div>
      <button class="button" type="button" id="oojsResetButton">Műhely alaphelyzet</button>
    `;

    heading.element
      .querySelector("#oojsResetButton")
      .addEventListener("click", () => this.resetAll());

    const cardGrid = new BaseComponent("div", "oojs-card-grid");
    if (this.filteredItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state-box";
      empty.textContent = "Nincs találat a jelenlegi OOJS szűrésre.";
      cardGrid.append(empty);
    } else {
      this.filteredItems.forEach((item) => {
        new SoftwareCard(item, this.state.selectedIds.includes(item.id), (id) => this.toggleSelection(id)).mount(
          cardGrid.element
        );
      });
    }

    catalogPanel.append(heading.element, cardGrid.element);

    const logPanel = new BaseComponent("section", "panel");
    logPanel.element.innerHTML = `
      <p class="eyebrow">Műveleti napló</p>
      <h2>OOJS aktivitás</h2>
    `;

    const logList = new BaseComponent("div", "oojs-log-list");
    this.state.activityLog.forEach((entry) => new ActivityLogEntry(entry).mount(logList.element));
    logPanel.append(logList.element);

    this.mainColumn.append(toolbarPanel.element, catalogPanel.element, logPanel.element);
  }

  renderSidePanel() {
    this.sidePanel.clear();

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Profil szerkesztő";

    const heading = document.createElement("h2");
    heading.textContent = "OOJS vezérlőpanel";

    const intro = document.createElement("p");
    intro.className = "muted-line";
    intro.textContent =
      "Itt látszik, hogyan dolgozik együtt több osztály: a kártyák, az összesítők és a naplóbejegyzések mind külön komponensek.";

    const modeGroup = new BaseComponent("div", "oojs-mode-grid");
    Object.entries(this.modeDefinitions).forEach(([key, mode]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `button oojs-mode-button ${this.state.deploymentMode === key ? "is-active" : ""}`.trim();
      button.innerHTML = `<span><strong>${mode.label}</strong>${mode.detail}</span>`;
      button.addEventListener("click", () => this.setMode(key));
      modeGroup.append(button);
    });

    const stationGroup = new BaseComponent("div", "field-group");
    const stationLabel = document.createElement("label");
    stationLabel.className = "field-label";
    stationLabel.htmlFor = "oojsStationInput";
    stationLabel.textContent = "Állomás neve";

    const stationInput = document.createElement("input");
    stationInput.id = "oojsStationInput";
    stationInput.className = "text-input";
    stationInput.type = "text";
    stationInput.placeholder = "Pl. Iroda-03 vagy Dev-Laptop";
    stationInput.value = this.state.stationName;
    stationInput.addEventListener("input", (event) => this.updateStationName(event.target.value));
    stationGroup.append(stationLabel, stationInput);

    const notesGroup = new BaseComponent("div", "field-group");
    const notesLabel = document.createElement("label");
    notesLabel.className = "field-label";
    notesLabel.htmlFor = "oojsNotesInput";
    notesLabel.textContent = "Megjegyzés";

    const notesInput = document.createElement("textarea");
    notesInput.id = "oojsNotesInput";
    notesInput.className = "text-input spa-textarea";
    notesInput.placeholder = "Pl. fejlesztői géphez PDF-kezelő és böngésző kötelező.";
    notesInput.value = this.state.notes;
    notesInput.addEventListener("input", (event) => this.updateNotes(event.target.value));
    notesGroup.append(notesLabel, notesInput);

    const selectionHeading = document.createElement("p");
    selectionHeading.className = "summary-label";
    selectionHeading.textContent = "Kiválasztott elemek";

    const selectionList = new BaseComponent("div", "oojs-selection-list");
    if (this.selectedItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state-box";
      empty.textContent = "Még nincs kiválasztott program a telepítési profilban.";
      selectionList.append(empty);
    } else {
      this.selectedItems.forEach((item) => {
        const row = new BaseComponent("div", "oojs-selection-item");
        row.element.innerHTML = `
          <div>
            <strong>${item.nev}</strong>
            <p>${item.kategoria}</p>
          </div>
        `;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "mini-button danger";
        removeButton.textContent = "Kivétel";
        removeButton.addEventListener("click", () => this.toggleSelection(item.id));
        row.append(removeButton);
        selectionList.append(row.element);
      });
    }

    const previewHeading = document.createElement("p");
    previewHeading.className = "summary-label";
    previewHeading.textContent = "Generált telepítési profil";

    const preview = document.createElement("pre");
    preview.className = "oojs-preview";
    preview.textContent = this.deploymentPreview;

    this.sidePanel.append(
      eyebrow,
      heading,
      intro,
      modeGroup.element,
      stationGroup.element,
      notesGroup.element,
      selectionHeading,
      selectionList.element,
      previewHeading,
      preview
    );
  }
}

const root = document.querySelector("#oojs-root");
const app = new WorkbenchApp(root);
app.init().catch((error) => {
  console.error(error);
  root.innerHTML = `
    <section class="panel">
      <p class="eyebrow">OOJS hiba</p>
      <h1>Betöltési probléma</h1>
      <p class="lead">Az OOJS műhely nem tudott elindulni. Ellenőrizd a JSON adatforrást.</p>
    </section>
  `;
});
