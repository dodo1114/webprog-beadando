import { useState } from "react";
import { createRoot } from "react-dom/client";

const seed = [
  { id: 12, nev: "Acrobat Reader", kategoria: "pdf-olvasás" },
  { id: 28, nev: "Notepad++", kategoria: "editor" },
  { id: 57, nev: "LibreOffice", kategoria: "irodai programcsomag" },
  { id: 63, nev: "Mozilla Firefox", kategoria: "böngészés" },
  { id: 65, nev: "Dev-C++", kategoria: "fejlesztő környezet" }
];

function ReactCrud() {
  const [items, setItems] = useState(seed);
  const [editingId, setEditingId] = useState(null);
  const [nev, setNev] = useState("");
  const [kategoria, setKategoria] = useState("");

  function reset() {
    setEditingId(null);
    setNev("");
    setKategoria("");
  }

  function save(event) {
    event.preventDefault();
    const name = nev.trim();
    const category = kategoria.trim();
    if (!name || !category) {
      alert("Kérjük, töltsön ki minden mezőt!");
      return;
    }
    if (editingId === null) {
      const id = items.length ? Math.max(...items.map(item => item.id)) + 1 : 1;
      setItems(current => [...current, { id, nev: name, kategoria: category }]);
    } else {
      setItems(current => current.map(item =>
        item.id === editingId ? { ...item, nev: name, kategoria: category } : item
      ));
    }
    reset();
  }

  function edit(item) {
    setEditingId(item.id);
    setNev(item.nev);
    setKategoria(item.kategoria);
  }

  function remove(id) {
    if (!confirm("Biztosan törölni szeretné ezt a szoftvert?")) return;
    setItems(current => current.filter(item => item.id !== id));
    if (editingId === id) reset();
  }

  return <section className="crud-box">
    <h2>Szoftverek kezelése React komponenssel</h2>
    <p>A CRUD műveleteket React-komponens és useState állapotváltozók kezelik.</p>
    <form className="form-container" onSubmit={save}>
      <h3>{editingId === null ? "Új szoftver" : `Szoftver módosítása (ID: ${editingId})`}</h3>
      <div className="form-row">
        <input aria-label="Szoftver neve" value={nev} onChange={event => setNev(event.target.value)} placeholder="Szoftver neve" />
        <input aria-label="Kategória" value={kategoria} onChange={event => setKategoria(event.target.value)} placeholder="Kategória" />
      </div>
      <button type="submit">{editingId === null ? "Mentés" : "Módosítás mentése"}</button>
      {editingId !== null && <button type="button" className="btn-secondary" onClick={reset}>Mégse</button>}
    </form>
    <div className="table-responsive"><table>
      <thead><tr><th>ID</th><th>Szoftver neve</th><th>Kategória</th><th>Műveletek</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>
        <td>{item.id}</td><td>{item.nev}</td><td>{item.kategoria}</td>
        <td className="actions"><button onClick={() => edit(item)}>Szerkeszt</button><button className="btn-danger" onClick={() => remove(item.id)}>Töröl</button></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

createRoot(document.getElementById("react-app")).render(<ReactCrud />);
