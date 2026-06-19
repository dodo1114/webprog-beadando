import { useState } from "react";
import { createRoot } from "react-dom/client";

function Calculator() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [operator, setOperator] = useState("+");
  const [result, setResult] = useState(null);

  function calculate(event) {
    event.preventDefault();
    const a = Number(left);
    const b = Number(right);
    if (!Number.isFinite(a) || !Number.isFinite(b) || (operator === "/" && b === 0)) {
      setResult("Érvénytelen művelet");
      return;
    }
    const operations = { "+": a + b, "-": a - b, "*": a * b, "/": a / b };
    setResult(operations[operator]);
  }

  return <section>
    <h2>React számológép</h2>
    <form className="form-container" onSubmit={calculate}>
      <div className="form-row">
        <input aria-label="Első szám" type="number" value={left} onChange={event => setLeft(event.target.value)} />
        <select aria-label="Művelet" value={operator} onChange={event => setOperator(event.target.value)}>
          <option>+</option><option>-</option><option>*</option><option>/</option>
        </select>
        <input aria-label="Második szám" type="number" value={right} onChange={event => setRight(event.target.value)} />
      </div>
      <button type="submit">Számítás</button>
    </form>
    <p className="result" aria-live="polite">Eredmény: {result ?? "–"}</p>
  </section>;
}

const winningLines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winner(board) {
  for (const [a,b,c] of winningLines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return null;
}

function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xNext, setXNext] = useState(true);
  const won = winner(board);

  function play(index) {
    if (board[index] || won) return;
    const next = [...board];
    next[index] = xNext ? "X" : "O";
    setBoard(next);
    setXNext(!xNext);
  }

  function reset() {
    setBoard(Array(9).fill(null));
    setXNext(true);
  }

  const status = won ? `Győztes: ${won}` : board.every(Boolean) ? "Döntetlen" : `Következő: ${xNext ? "X" : "O"}`;
  return <section>
    <h2>React amőba</h2>
    <p aria-live="polite">{status}</p>
    <div className="tic-grid">{board.map((value, index) =>
      <button key={index} onClick={() => play(index)} aria-label={`${index + 1}. mező`}>{value}</button>
    )}</div>
    <button onClick={reset}>Új játék</button>
  </section>;
}

function SpaApp() {
  const [active, setActive] = useState("calculator");
  return <>
    <div className="spa-tabs" role="tablist">
      <button className={active === "calculator" ? "active" : ""} onClick={() => setActive("calculator")}>Számológép</button>
      <button className={active === "game" ? "active" : ""} onClick={() => setActive("game")}>Amőba</button>
    </div>
    {active === "calculator" ? <Calculator /> : <TicTacToe />}
  </>;
}

createRoot(document.getElementById("spa-app")).render(<SpaApp />);
