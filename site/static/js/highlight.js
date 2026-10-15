// The Python lexer of site/highlight.go, in JavaScript, for the editor.
// Keep the two in step: the server renders the first paint, this file
// re-renders as the learner types.

const words = (s) => new Set(s.split(" "));
const KEYWORDS = words("and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case");
const CONSTANTS = words("True False None self cls");
const BUILTINS = words("abs all any enumerate float int len list map max min print range round sum tuple zip isinstance sorted reversed str dict set np math");
const OPS = "+-*/%=<>!&|^~@";
const PUNCT = "()[]{},:.";
const isIdent = (c) => c === "_" || /\p{L}/u.test(c);
const isDigit = (c) => c >= "0" && c <= "9";

export function tokenize(line) {
  const out = [];
  const emit = (cls, text) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.cls === cls) last.text += text;
    else out.push({ cls, text });
  };
  const lastWord = () => {
    for (let k = out.length - 1; k >= 0; k--) {
      const t = out[k].text.trim();
      if (t) return t;
    }
    return "";
  };
  const rs = [...line];
  let i = 0;
  while (i < rs.length) {
    const c = rs[i];
    if (c === "#") {
      emit("comment", rs.slice(i).join(""));
      break;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < rs.length && rs[j] !== c) {
        if (rs[j] === "\\") j++;
        j++;
      }
      j = Math.min(j + 1, rs.length);
      emit("string", rs.slice(i, j).join(""));
      i = j;
    } else if (c === "@" && rs.slice(0, i).join("").trim() === "") {
      let j = i + 1;
      while (j < rs.length && (isIdent(rs[j]) || rs[j] === ".")) j++;
      emit("decorator", rs.slice(i, j).join(""));
      i = j;
    } else if (isDigit(c) || (c === "." && isDigit(rs[i + 1] ?? ""))) {
      let j = i;
      while (j < rs.length && (isDigit(rs[j]) || ".e_j".includes(rs[j]))) j++;
      emit("number", rs.slice(i, j).join(""));
      i = j;
    } else if (isIdent(c)) {
      let j = i;
      while (j < rs.length && (isIdent(rs[j]) || isDigit(rs[j]))) j++;
      const w = rs.slice(i, j).join("");
      let k = j;
      while (k < rs.length && rs[k] === " ") k++;
      const prev = lastWord();
      if (KEYWORDS.has(w)) emit("keyword", w);
      else if (CONSTANTS.has(w)) emit("constant", w);
      else if (prev === "def" || prev === "class") emit("function", w);
      else if (rs[k] === "(") emit(BUILTINS.has(w) ? "builtin" : "function", w);
      else if (BUILTINS.has(w)) emit("builtin", w);
      else emit("", w);
      i = j;
    } else if (OPS.includes(c)) {
      let j = i;
      while (j < rs.length && OPS.includes(rs[j])) j++;
      emit("operator", rs.slice(i, j).join(""));
      i = j;
    } else if (PUNCT.includes(c)) {
      emit("punct", c);
      i++;
    } else {
      emit("", c);
      i++;
    }
  }
  return out;
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Renders one line as escaped HTML spans. */
export function lineHTML(line) {
  return tokenize(line).map((t) => (t.cls ? `<span class="tok-${t.cls}">${esc(t.text)}</span>` : esc(t.text))).join("");
}
