import axios from "axios";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const API_URL = "api.php";

function AxiosCrud() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ gepid: "", szoftverid: "", verzio: "", datum: "" });
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await axios.get(API_URL);
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch {
      setMessage("Az adatok betöltése sikertelen.");
    }
  }

  useEffect(() => { load(); }, []);
  function change(field, value) { setForm(current => ({ ...current, [field]: value })); }
  function reset() { setForm({ gepid: "", szoftverid: "", verzio: "", datum: "" }); setEditing(false); }

  async function save(event) {
    event.preventDefault();
    const payload = { ...form, gepid: Number(form.gepid), szoftverid: Number(form.szoftverid) };
    try {
      const response = editing ? await axios.put(API_URL, payload) : await axios.post(API_URL, payload);
      setMessage(response.data.message || "Sikeres művelet.");
      if (response.data.success) { reset(); await load(); }
    } catch { setMessage("A mentés sikertelen."); }
  }

  function edit(item) {
    setForm({ gepid: item.gepid, szoftverid: item.szoftverid, verzio: item.verzio, datum: item.datum });
    setEditing(true);
  }

  async function remove(item) {
    if (!confirm("Biztosan törlöd a telepítést?")) return;
    const response = await axios.delete(API_URL, { data: { gepid: item.gepid, szoftverid: item.szoftverid } });
    setMessage(response.data.message || "Törlés befejezve.");
    if (response.data.success) await load();
  }

  return <section>
    <h2>Szoftvertelepítések kezelése React + Axios használatával</h2>
    {message && <p className="status-message" aria-live="polite">{message}</p>}
    <form className="form-container" onSubmit={save}>
      <h3>{editing ? "Telepítés módosítása" : "Új telepítés"}</h3>
      <div className="form-row">
        <input type="number" required disabled={editing} value={form.gepid} onChange={e => change("gepid", e.target.value)} placeholder="Gép ID" />
        <input type="number" required disabled={editing} value={form.szoftverid} onChange={e => change("szoftverid", e.target.value)} placeholder="Szoftver ID" />
        <input required value={form.verzio} onChange={e => change("verzio", e.target.value)} placeholder="Verzió" />
        <input required value={form.datum} onChange={e => change("datum", e.target.value)} placeholder="Dátum" />
      </div>
      <button type="submit">{editing ? "Módosítás mentése" : "Telepítés mentése"}</button>
      {editing && <button type="button" className="btn-secondary" onClick={reset}>Mégse</button>}
    </form>
    <div className="table-responsive"><table>
      <thead><tr><th>Helyiség</th><th>Gép</th><th>Szoftver</th><th>Verzió</th><th>Dátum</th><th>Műveletek</th></tr></thead>
      <tbody>{items.map(item => <tr key={`${item.gepid}-${item.szoftverid}`}>
        <td>{item.hely}</td><td>{item.tipus}</td><td>{item.szoftver_neve}</td><td>{item.verzio}</td><td>{item.datum}</td>
        <td className="actions"><button onClick={() => edit(item)}>Szerkeszt</button><button className="btn-danger" onClick={() => remove(item)}>Töröl</button></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

createRoot(document.getElementById("axios-app")).render(<AxiosCrud />);
