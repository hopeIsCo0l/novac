/* ===== Nova calculator app ===== */
(function () {
  "use strict";

  var engine = window.CalcEngine;
  var evaluate = engine.evaluate;
  var formatNumber = engine.formatNumber;
  var plainNumber = engine.plainNumber;
  var prettyExpr = engine.prettyExpr;
  var balanceParens = engine.balanceParens;

  var STORAGE = {
    history: "nova-history",
    theme: "nova-theme",
    angle: "nova-angle",
    sci: "nova-sci"
  };

  function read(key, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      /* storage unavailable: ignore */
    }
  }

  var els = {
    app: document.getElementById("app"),
    display: document.querySelector(".display"),
    expression: document.getElementById("expression"),
    result: document.getElementById("result"),
    keypad: document.getElementById("keypad"),
    sciPad: document.getElementById("sci-pad"),
    angleBtn: document.getElementById("angle-toggle"),
    sciBtn: document.getElementById("sci-toggle"),
    historyBtn: document.getElementById("history-toggle"),
    themeBtn: document.getElementById("theme-toggle"),
    historyList: document.getElementById("history-list"),
    historyPanel: document.getElementById("history-panel"),
    historyEmpty: document.getElementById("history-empty"),
    historyClear: document.getElementById("history-clear"),
    copyBtn: document.getElementById("copy-btn"),
    announcer: document.getElementById("announcer"),
    scrim: document.getElementById("scrim")
  };

  function loadHistory() {
    try {
      var parsed = JSON.parse(read(STORAGE.history, "[]"));
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (item) {
          return (
            item &&
            typeof item.expression === "string" &&
            typeof item.value === "number" &&
            Number.isFinite(item.value)
          );
        })
        .slice(0, 40);
    } catch (err) {
      return [];
    }
  }

  var state = {
    expr: "",
    completed: null,
    error: null,
    angle: read(STORAGE.angle, "DEG") === "RAD" ? "RAD" : "DEG",
    sci: read(STORAGE.sci, "0") === "1",
    history: loadHistory(),
    theme:
      read(STORAGE.theme, "") ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark")
  };

  /* ===== Rendering ===== */

  function tryEvaluate(text) {
    try {
      var value = evaluate(text, { angle: state.angle });
      return value === null ? undefined : value;
    } catch (err) {
      return undefined;
    }
  }

  function previewValue(expr) {
    var value = tryEvaluate(balanceParens(expr));
    if (value !== undefined) return value;

    for (var cut = 1; cut <= expr.length; cut += 1) {
      var candidate = balanceParens(expr.slice(0, expr.length - cut)).replace(
        /[-+×÷^]+$/,
        ""
      );
      if (!candidate) return null;
      value = tryEvaluate(candidate);
      if (value !== undefined) return value;
    }
    return null;
  }

  function fitResult() {
    if (state.error) {
      els.result.style.fontSize = "1.15rem";
      return;
    }
    var length = els.result.textContent.length;
    var size = "3.4rem";
    if (length > 8) size = "2.9rem";
    if (length > 11) size = "2.45rem";
    if (length > 15) size = "2.05rem";
    if (length > 20) size = "1.75rem";
    els.result.style.fontSize = size;
  }

  function render(pop) {
    var expressionText = "";
    var resultText = "0";

    if (state.error) {
      expressionText = state.expr ? prettyExpr(state.expr) : "";
      resultText = state.error;
    } else if (state.completed) {
      expressionText = prettyExpr(state.completed.expression) + " =";
      resultText = state.completed.formatted;
    } else {
      expressionText = state.expr ? prettyExpr(state.expr) : "";
      if (state.expr) {
        var preview = previewValue(state.expr);
        resultText = preview === null ? "0" : formatNumber(preview);
      }
    }

    els.expression.textContent = expressionText;
    els.result.textContent = resultText;
    els.result.classList.toggle("error", !!state.error);
    els.result.title = state.error || "";

    fitResult();
    els.expression.scrollLeft = els.expression.scrollWidth;

    if (pop) {
      els.result.classList.remove("pop");
      void els.result.offsetWidth;
      els.result.classList.add("pop");
    }
  }

  /* ===== Feedback: announcements, toasts and copying ===== */

  function announce(message) {
    if (!els.announcer) return;
    els.announcer.textContent = "";
    window.setTimeout(function () {
      els.announcer.textContent = message;
    }, 30);
  }

  function showToast(message) {
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(function () {
      toast.classList.add("toast-out");
      window.setTimeout(function () {
        toast.remove();
      }, 260);
    }, 1400);
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (err) {
      copied = false;
    }
    showToast(copied ? "Copied " + text : "Copy failed");
    area.remove();
  }

  function currentValueText() {
    if (state.error) return state.error;
    if (state.completed) return state.completed.formatted;
    if (!state.expr) return "";
    var preview = previewValue(state.expr);
    return preview === null ? "" : formatNumber(preview);
  }

  function copyResult() {
    var text = currentValueText();
    if (!text) return;

    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      fallbackCopy(text);
      return;
    }

    // The clipboard promise can hang in some browsers, so always resolve
    // to visible feedback within 600ms.
    var settled = false;
    var timer = window.setTimeout(function () {
      if (settled) return;
      settled = true;
      fallbackCopy(text);
    }, 600);

    navigator.clipboard.writeText(text).then(
      function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        showToast("Copied " + text);
      },
      function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        fallbackCopy(text);
      }
    );
  }

  /* ===== History ===== */

  function saveHistory() {
    write(STORAGE.history, JSON.stringify(state.history));
  }

  function renderHistory() {
    els.historyList.textContent = "";
    els.historyEmpty.hidden = state.history.length > 0;
    els.historyClear.disabled = state.history.length === 0;

    state.history.forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      button.title = "Use this result";

      var expressionSpan = document.createElement("span");
      expressionSpan.className = "history-expression";
      expressionSpan.textContent = prettyExpr(item.expression);

      var resultSpan = document.createElement("span");
      resultSpan.className = "history-result";
      resultSpan.textContent = formatNumber(item.value);

      button.appendChild(expressionSpan);
      button.appendChild(resultSpan);
      button.addEventListener("click", function () {
        useHistory(item);
      });

      els.historyList.appendChild(button);
    });
  }

  function addHistory(expression, value) {
    if (!Number.isFinite(value)) return;
    state.history.unshift({ expression: expression, value: value });
    if (state.history.length > 40) state.history.length = 40;
    saveHistory();
    renderHistory();
  }

  function useHistory(item) {
    state.completed = {
      expression: item.expression,
      value: item.value,
      formatted: formatNumber(item.value)
    };
    state.expr = plainNumber(item.value);
    state.error = null;
    render(true);
    if (window.matchMedia("(max-width: 900px)").matches) setHistoryOpen(false);
  }

  /* ===== Settings ===== */

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    els.themeBtn.setAttribute(
      "aria-label",
      state.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
    write(STORAGE.theme, state.theme);
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
  }

  function applyAngle() {
    els.angleBtn.textContent = state.angle;
    els.angleBtn.setAttribute(
      "aria-label",
      "Angle unit: " + (state.angle === "DEG" ? "degrees" : "radians") + ". Click to switch."
    );
    write(STORAGE.angle, state.angle);
    render();
  }

  function toggleAngle() {
    state.angle = state.angle === "DEG" ? "RAD" : "DEG";
    applyAngle();
  }

  function applySci() {
    els.sciPad.classList.toggle("open", state.sci);
    els.sciBtn.classList.toggle("active", state.sci);
    els.sciBtn.setAttribute("aria-expanded", String(state.sci));
    els.sciPad.inert = !state.sci;
    write(STORAGE.sci, state.sci ? "1" : "0");
  }

  function toggleSci() {
    state.sci = !state.sci;
    applySci();
  }

  function setHistoryOpen(open) {
    els.app.classList.toggle("history-open", open);
    els.historyBtn.classList.toggle("active", open);
    els.historyBtn.setAttribute("aria-expanded", String(open));
    els.historyPanel.inert = !open;
  }

  function toggleHistory() {
    setHistoryOpen(!els.app.classList.contains("history-open"));
  }

  /* ===== Input ===== */

  function beginInput(mode) {
    if (state.error) {
      state.error = null;
      state.expr = "";
    }
    if (state.completed) {
      state.expr = mode === "fresh" ? "" : plainNumber(state.completed.value);
      state.completed = null;
    }
  }

  function inputDigit(digit) {
    beginInput("fresh");
    var trailing = state.expr.match(/(\d+(?:\.\d*)?)$/);
    if (trailing && trailing[0] === "0") {
      state.expr = state.expr.slice(0, -1) + digit;
    } else {
      state.expr += digit;
    }
    render();
  }

  function inputDot() {
    beginInput("fresh");
    var trailing = state.expr.match(/(\d+(?:\.\d*)?)$/);
    if (trailing) {
      if (trailing[0].indexOf(".") !== -1) return;
      state.expr += ".";
    } else if (state.expr === "" || /[+\-×÷^(]$/.test(state.expr)) {
      state.expr += "0.";
    } else {
      return;
    }
    render();
  }

  function inputOperator(op) {
    beginInput("continue");

    if (state.expr === "") {
      if (op === "-") {
        state.expr = "-";
        render();
      }
      return;
    }

    if (/[+\-×÷^]$/.test(state.expr)) {
      var trimmed = state.expr.replace(/[+\-×÷^]+$/, "");
      if (trimmed === "" || /\($/.test(trimmed)) {
        state.expr = op === "-" ? "-" : trimmed;
      } else {
        state.expr = trimmed + op;
      }
      render();
      return;
    }

    state.expr += op;
    render();
  }

  function inputPercent() {
    beginInput("continue");
    if (state.expr === "") return;
    if (/[+\-×÷^(]$/.test(state.expr)) return;
    if (state.expr.slice(-1) === "%") return;
    state.expr += "%";
    render();
  }

  function inputFunction(name) {
    beginInput("fresh");
    if (/[0-9)πe%]$/.test(state.expr)) state.expr += "×";
    state.expr += name === "sqrt" ? "√(" : name + "(";
    render();
  }

  function inputConstant(value) {
    beginInput("fresh");
    // "e" is left unseparated so that typing 1e3 reads as scientific
    // notation; the engine still multiplies it by Euler's number.
    if (value !== "e" && /[0-9)πe%]$/.test(state.expr)) state.expr += "×";
    state.expr += value;
    render();
  }

  function inputFactorial() {
    if (state.completed) {
      state.expr = plainNumber(state.completed.value);
      state.completed = null;
    }
    if (state.error) {
      state.error = null;
      state.expr = "";
    }
    if (state.expr === "" || !/[0-9)πe%]$/.test(state.expr)) return;
    state.expr += "!";
    render();
  }

  function inputPow10() {
    beginInput("continue");
    if (state.expr !== "" && /[0-9)πe%]$/.test(state.expr)) state.expr += "×";
    state.expr += "10^";
    render();
  }

  function inputExp() {
    beginInput("continue");
    if (state.expr !== "" && /[0-9)πe%]$/.test(state.expr)) state.expr += "×";
    state.expr += "e^";
    render();
  }

  function countChar(text, char) {
    return text.split(char).length - 1;
  }

  function inputParen(paren) {
    if (state.completed && paren === ")") return;

    if (paren === "(") {
      beginInput("fresh");
      if (/[0-9)πe%]$/.test(state.expr)) state.expr += "×";
      state.expr += "(";
    } else {
      beginInput("continue");
      var opens = countChar(state.expr, "(");
      var closes = countChar(state.expr, ")");
      if (opens > closes && /[0-9)πe%]$/.test(state.expr)) {
        state.expr += ")";
      }
    }
    render();
  }

  function inputSquare() {
    if (state.completed) {
      state.expr = plainNumber(state.completed.value);
      state.completed = null;
    }
    if (state.error) {
      state.error = null;
      state.expr = "";
    }
    if (state.expr === "" || !/[0-9)πe%]$/.test(state.expr)) return;
    state.expr += "^2";
    render();
  }

  function toggleSign() {
    beginInput("continue");
    var expr = state.expr;
    if (!expr) {
      state.expr = "-";
      render();
      return;
    }

    var match = expr.match(/(\d+(?:\.\d*)?)$/);
    if (!match) return;
    var start = expr.length - match[0].length;

    if (start > 0 && expr[start - 1] === "-") {
      var before = expr[start - 2] || "";
      if (before === "" || "+×÷^(".indexOf(before) !== -1) {
        state.expr = expr.slice(0, start - 1) + match[0];
        render();
        return;
      }
    }

    if (start === 0) {
      state.expr = "-" + expr;
    } else {
      state.expr = expr.slice(0, start) + "-" + match[0];
    }
    render();
  }

  function backspace() {
    if (state.error) state.error = null;
    if (state.completed) {
      clearAll();
      return;
    }
    if (!state.expr) {
      render();
      return;
    }

    var names = ["sin(", "cos(", "tan(", "ln(", "log(", "√("];
    var removed = false;
    for (var i = 0; i < names.length; i += 1) {
      if (state.expr.slice(-names[i].length) === names[i]) {
        state.expr = state.expr.slice(0, -names[i].length);
        removed = true;
        break;
      }
    }
    if (!removed) state.expr = state.expr.slice(0, -1);
    render();
  }

  function clearAll() {
    state.expr = "";
    state.completed = null;
    state.error = null;
    render();
  }

  function calculate() {
    if (state.completed || !state.expr) return;

    try {
      var value = evaluate(balanceParens(state.expr), { angle: state.angle });
      if (value === null) return;

      var expression = state.expr;
      state.completed = {
        expression: expression,
        value: value,
        formatted: formatNumber(value)
      };
      state.expr = plainNumber(value);
      state.error = null;
      addHistory(expression, value);
      announce(state.completed.formatted);
      render(true);
    } catch (err) {
      state.error =
        err && err.message ? err.message : "That expression could not be calculated";
      announce(state.error);
      render();
      els.display.classList.remove("shake");
      void els.display.offsetWidth;
      els.display.classList.add("shake");
    }
  }

  function handleAction(action, value) {
    switch (action) {
      case "digit": inputDigit(value); break;
      case "dot": inputDot(); break;
      case "op": inputOperator(value); break;
      case "percent": inputPercent(); break;
      case "func": inputFunction(value); break;
      case "const": inputConstant(value); break;
      case "paren": inputParen(value); break;
      case "square": inputSquare(); break;
      case "factorial": inputFactorial(); break;
      case "pow10": inputPow10(); break;
      case "exp": inputExp(); break;
      case "sign": toggleSign(); break;
      case "backspace": backspace(); break;
      case "clear": clearAll(); break;
      case "equals": calculate(); break;
    }
  }

  /* ===== Events ===== */

  function flashKey(selector) {
    var button = document.querySelector(selector);
    if (!button) return;
    button.classList.add("is-active");
    window.setTimeout(function () {
      button.classList.remove("is-active");
    }, 110);
  }

  /* Single-key shortcuts for the scientific functions and constants. */
  var SHORTCUTS = {
    s: { action: "func", value: "sin" },
    c: { action: "func", value: "cos" },
    t: { action: "func", value: "tan" },
    l: { action: "func", value: "ln" },
    g: { action: "func", value: "log" },
    r: { action: "func", value: "sqrt" },
    a: { action: "func", value: "abs" },
    e: { action: "const", value: "e" },
    p: { action: "const", value: "π" }
  };

  function handleKeydown(event) {
    var key = event.key;

    if ((event.metaKey || event.ctrlKey) && (key === "c" || key === "C")) {
      copyResult();
      event.preventDefault();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    var active = document.activeElement;

    if ((key === "Enter" || key === " ") && active && active.closest && active.closest("button")) {
      return;
    }

    if (/^[0-9]$/.test(key)) {
      inputDigit(key);
      flashKey('.key[data-action="digit"][data-value="' + key + '"]');
      event.preventDefault();
    } else if (key === "." || key === ",") {
      inputDot();
      flashKey('.key[data-action="dot"]');
      event.preventDefault();
    } else if (key === "+" || key === "-" || key === "*" || key === "/") {
      var op = key === "*" ? "×" : key === "/" ? "÷" : key;
      inputOperator(op);
      flashKey('.key[data-action="op"][data-value="' + op + '"]');
      event.preventDefault();
    } else if (key === "^") {
      inputOperator("^");
      flashKey('.key[data-action="op"][data-value="^"]');
      event.preventDefault();
    } else if (key === "%") {
      inputPercent();
      flashKey('.key[data-action="percent"]');
      event.preventDefault();
    } else if (key === "!") {
      inputFactorial();
      flashKey('.key[data-action="factorial"]');
      event.preventDefault();
    } else if (key === "(" || key === ")") {
      inputParen(key);
      flashKey('.key[data-action="paren"][data-value="' + key + '"]');
      event.preventDefault();
    } else if (key === "Enter" || key === "=") {
      calculate();
      flashKey(".key.equals");
      event.preventDefault();
    } else if (key === "Backspace") {
      backspace();
      event.preventDefault();
    } else if (key === "Escape" || key === "Delete") {
      if (
        els.app.classList.contains("history-open") &&
        window.matchMedia("(max-width: 900px)").matches
      ) {
        setHistoryOpen(false);
      } else {
        clearAll();
      }
      event.preventDefault();
    } else if (key.length === 1 && SHORTCUTS[key.toLowerCase()]) {
      var shortcut = SHORTCUTS[key.toLowerCase()];
      if (shortcut.action === "func") inputFunction(shortcut.value);
      else inputConstant(shortcut.value);
      flashKey(
        '.key[data-action="' +
          shortcut.action +
          '"][data-value="' +
          shortcut.value +
          '"]'
      );
      event.preventDefault();
    }
  }

  function initKeypads() {
    [els.keypad, els.sciPad].forEach(function (pad) {
      pad.addEventListener("click", function (event) {
        var button = event.target.closest(".key");
        if (!button) return;
        handleAction(button.dataset.action, button.dataset.value);
        if (event.detail > 0) button.blur();
      });

      pad.addEventListener("pointerdown", function (event) {
        var button = event.target.closest(".key");
        if (!button) return;

        var rect = button.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height);
        var ripple = document.createElement("span");
        ripple.className = "ripple";
        ripple.style.width = size + "px";
        ripple.style.height = size + "px";
        ripple.style.left = event.clientX - rect.left - size / 2 + "px";
        ripple.style.top = event.clientY - rect.top - size / 2 + "px";
        button.appendChild(ripple);

        window.setTimeout(function () {
          ripple.remove();
        }, 600);
      });
    });
  }

  function init() {
    applyTheme();
    applyAngle();
    applySci();
    renderHistory();
    render();
    setHistoryOpen(window.matchMedia("(min-width: 980px)").matches);

    initKeypads();

    els.themeBtn.addEventListener("click", toggleTheme);
    els.angleBtn.addEventListener("click", toggleAngle);
    els.sciBtn.addEventListener("click", toggleSci);
    els.historyBtn.addEventListener("click", toggleHistory);
    if (els.copyBtn) els.copyBtn.addEventListener("click", copyResult);
    els.scrim.addEventListener("click", function () {
      setHistoryOpen(false);
    });

    els.historyClear.addEventListener("click", function () {
      state.history = [];
      saveHistory();
      renderHistory();
    });

    document.addEventListener("keydown", handleKeydown);
  }

  init();
})();
