/* ===== Nova calculator engine =====
 * Pure math utilities: tokenizer, recursive-descent parser, formatting.
 * No DOM dependencies, so it can be tested in Node.
 *
 * Conventions:
 *  - Percent is contextual: `200+10%` is 220, `200-10%` is 180,
 *    `100x10%` is 10, and a lone `50%` is 0.5.
 *  - Scientific notation: `1e3` is 1000, `1.5e-2` is 0.015.
 *  - The `e` key still inserts Euler's number, so `2e` is 2 x e.
 *  - Functions accept parentheses or a bare argument: `sin(30)` and `sin30`.
 */
(function (root) {
  "use strict";

  var DEG_TO_RAD = Math.PI / 180;
  var RAD_TO_DEG = 180 / Math.PI;
  var FUNCTION_NAMES = [
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "ln",
    "log",
    "sqrt",
    "abs",
    "exp",
    "round",
    "floor",
    "ceil"
  ];

  function cleanTrig(value) {
    if (Math.abs(value) < 1e-12) return 0;
    if (Math.abs(value - 1) < 1e-12) return 1;
    if (Math.abs(value + 1) < 1e-12) return -1;
    return value;
  }

  function factorial(value) {
    if (!Number.isFinite(value)) throw new Error("Factorial needs a finite number");
    if (value < 0 || !Number.isInteger(value)) {
      throw new Error("Factorial needs a whole number of 0 or more");
    }
    if (value > 170) throw new Error("Factorial is too large to display");
    var result = 1;
    for (var i = 2; i <= value; i += 1) result *= i;
    return result;
  }

  function applyFunction(name, arg, angle) {
    switch (name) {
      case "sin":
        return cleanTrig(Math.sin(angle === "DEG" ? arg * DEG_TO_RAD : arg));
      case "cos":
        return cleanTrig(Math.cos(angle === "DEG" ? arg * DEG_TO_RAD : arg));
      case "tan": {
        if (angle === "DEG") {
          var mod = ((arg % 180) + 180) % 180;
          if (Math.abs(mod - 90) < 1e-9) return NaN;
          return cleanTrig(Math.tan(arg * DEG_TO_RAD));
        }
        return cleanTrig(Math.tan(arg));
      }
      case "asin":
      case "acos":
      case "atan": {
        var radians =
          name === "asin" ? Math.asin(arg) : name === "acos" ? Math.acos(arg) : Math.atan(arg);
        if (Number.isNaN(radians)) return NaN;
        return angle === "DEG" ? radians * RAD_TO_DEG : radians;
      }
      case "ln":
        return Math.log(arg);
      case "log":
        return Math.log10(arg);
      case "sqrt":
        return Math.sqrt(arg);
      case "abs":
        return Math.abs(arg);
      case "exp":
        return Math.exp(arg);
      case "round":
        return Math.round(arg);
      case "floor":
        return Math.floor(arg);
      case "ceil":
        return Math.ceil(arg);
      default:
        throw new Error("Unknown function: " + name);
    }
  }

  function isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }

  function isLetter(ch) {
    return ch >= "a" && ch <= "z";
  }

  function tokenize(input) {
    var source = input.replace(/\s+/g, "");
    var tokens = [];
    var i = 0;

    while (i < source.length) {
      var ch = source[i];

      if (isDigit(ch) || ch === ".") {
        var start = i;
        var dots = 0;
        while (i < source.length && (isDigit(source[i]) || source[i] === ".")) {
          if (source[i] === ".") dots += 1;
          i += 1;
        }
        var rawNumber = source.slice(start, i);
        if (dots > 1 || rawNumber === ".") throw new Error("Malformed number");

        // Scientific notation: 1e3, 1.5E-2 (only when digits follow the sign).
        var exponentMatch = /^[eE]([+-]?\d+)/.exec(source.slice(i));
        if (exponentMatch) {
          rawNumber += exponentMatch[0];
          i += exponentMatch[0].length;
        }

        tokens.push({ type: "number", value: parseFloat(rawNumber) });
      } else if (ch === "π") {
        tokens.push({ type: "number", value: Math.PI, constant: true });
        i += 1;
      } else if (ch === "√") {
        tokens.push({ type: "func", value: "sqrt" });
        i += 1;
      } else if ("+-×÷*/^%()!".indexOf(ch) !== -1) {
        tokens.push({ type: "op", value: ch });
        i += 1;
      } else if (isLetter(ch)) {
        var nameStart = i;
        while (i < source.length && isLetter(source[i])) i += 1;
        var name = source.slice(nameStart, i);
        if (name === "e") {
          tokens.push({ type: "number", value: Math.E, constant: true });
        } else if (FUNCTION_NAMES.indexOf(name) !== -1) {
          tokens.push({ type: "func", value: name });
        } else {
          throw new Error("Unknown function: " + name);
        }
      } else {
        throw new Error("Unexpected character: " + ch);
      }
    }

    return tokens;
  }

  /* Parser nodes carry a little context:
   *   literal   - the value is a bare number or constant (percent is contextual)
   *   isPercent - the value came from a `%` suffix and still knows its raw value
   */
  function node(value, flags) {
    var options = flags || {};
    return {
      value: value,
      literal: !!options.literal,
      isPercent: !!options.isPercent,
      raw: typeof options.raw === "number" ? options.raw : value
    };
  }

  function Parser(tokens, angle) {
    this.tokens = tokens;
    this.pos = 0;
    this.angle = angle;
  }

  Parser.prototype.peek = function () {
    return this.tokens[this.pos];
  };

  Parser.prototype.next = function () {
    return this.tokens[this.pos++];
  };

  Parser.prototype.parse = function () {
    var value = this.parseExpression();
    if (this.pos !== this.tokens.length) throw new Error("Unexpected symbol at the end");
    return value.value;
  };

  Parser.prototype.startsValue = function (token) {
    if (!token) return false;
    if (token.type === "number" || token.type === "func") return true;
    return token.type === "op" && token.value === "(";
  };

  Parser.prototype.parseExpression = function () {
    var left = this.parseTerm();
    while (true) {
      var token = this.peek();
      if (!token || token.type !== "op" || (token.value !== "+" && token.value !== "-")) break;
      this.next();
      var right = this.parseTerm();

      if (right.isPercent) {
        // Contextual percent: 10% of the value on the left.
        var amount = left.value * right.value;
        left = node(
          token.value === "+" ? left.value + amount : left.value - amount,
          {}
        );
      } else {
        left = node(
          token.value === "+" ? left.value + right.value : left.value - right.value,
          {}
        );
      }
    }
    return left;
  };

  Parser.prototype.parseTerm = function () {
    var left = this.parseUnary();
    while (true) {
      var token = this.peek();
      if (token && token.type === "op" && "×÷*/".indexOf(token.value) !== -1) {
        this.next();
        var right = this.parseUnary();
        left = node(
          token.value === "×" || token.value === "*"
            ? left.value * right.value
            : left.value / right.value,
          {}
        );
      } else if (this.startsValue(token)) {
        var factor = this.parseUnary();
        left = node(left.value * factor.value, {});
      } else {
        break;
      }
    }
    return left;
  };

  Parser.prototype.parseUnary = function () {
    var token = this.peek();
    if (token && token.type === "op" && (token.value === "+" || token.value === "-")) {
      this.next();
      var value = this.parseUnary();
      return node(token.value === "-" ? -value.value : value.value, {});
    }
    return this.parsePower();
  };

  Parser.prototype.parsePower = function () {
    var base = this.parsePostfix();
    var token = this.peek();
    if (token && token.type === "op" && token.value === "^") {
      this.next();
      var exponent = this.parseUnary();
      return node(Math.pow(base.value, exponent.value), {});
    }
    return base;
  };

  Parser.prototype.parsePostfix = function () {
    var value = this.parsePrimary();
    while (true) {
      var token = this.peek();
      if (token && token.type === "op" && token.value === "%") {
        this.next();
        if (value.literal) {
          value = node(value.value / 100, { isPercent: true, raw: value.raw });
        } else {
          value = node(value.value / 100, {});
        }
      } else if (token && token.type === "op" && token.value === "!") {
        this.next();
        value = node(factorial(value.value), {});
      } else {
        break;
      }
    }
    return value;
  };

  Parser.prototype.parsePrimary = function () {
    var token = this.next();
    if (!token) throw new Error("Incomplete expression");

    if (token.type === "number") {
      return node(token.value, { literal: true });
    }

    if (token.type === "func") {
      var open = this.peek();
      if (open && open.type === "op" && open.value === "(") {
        this.next();
        var arg = this.parseExpression();
        var close = this.next();
        if (!close || close.value !== ")") throw new Error("Missing a closing bracket");
        return node(applyFunction(token.value, arg.value, this.angle), {});
      }
      // Bare argument form: sin30, √9.
      var bare = this.parseUnary();
      return node(applyFunction(token.value, bare.value, this.angle), {});
    }

    if (token.type === "op" && token.value === "(") {
      var value = this.parseExpression();
      var paren = this.next();
      if (!paren || paren.value !== ")") throw new Error("Missing a closing bracket");
      return node(value.value, {});
    }

    throw new Error("Unexpected symbol");
  };

  function evaluate(expression, options) {
    if (typeof expression !== "string" || expression.trim() === "") return null;
    var angle = options && options.angle === "RAD" ? "RAD" : "DEG";
    var tokens = tokenize(expression);
    if (!tokens.length) return null;
    var value = new Parser(tokens, angle).parse();
    if (Number.isNaN(value)) {
      throw new Error("Undefined result — the value is outside the function's domain");
    }
    return value;
  }

  /**
   * Close any brackets the user left open, so the live preview and the
   * final answer always agree.
   */
  function balanceParens(text) {
    var opens = 0;
    for (var i = 0; i < text.length; i += 1) {
      if (text[i] === "(") opens += 1;
      else if (text[i] === ")") opens = Math.max(0, opens - 1);
    }
    return text + new Array(opens + 1).join(")");
  }

  function formatNumber(value) {
    if (Number.isNaN(value)) return "Error";
    if (value === Infinity) return "∞";
    if (value === -Infinity) return "−∞";

    var rounded = parseFloat(value.toPrecision(12));
    if (Object.is(rounded, -0)) rounded = 0;
    var abs = Math.abs(rounded);

    if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
      return rounded
        .toExponential(6)
        .replace(/\.?0+e/, "e")
        .replace("e+", "e")
        .replace(/^-/, "−");
    }

    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 10 })
      .format(rounded)
      .replace(/^-/, "−");
  }

  function expandExponential(text) {
    var parts = text.split("e");
    var mantissa = parts[0];
    var exponent = parseInt(parts[1], 10);
    var sign = "";

    if (mantissa[0] === "-") {
      sign = "-";
      mantissa = mantissa.slice(1);
    }

    var digits = mantissa.replace(".", "");
    var dotPos = mantissa.indexOf(".") === -1 ? mantissa.length : mantissa.indexOf(".");
    var newDot = dotPos + exponent;

    if (newDot <= 0) {
      return sign + "0." + new Array(-newDot + 1).join("0") + digits;
    }
    if (newDot >= digits.length) {
      return sign + digits + new Array(newDot - digits.length + 1).join("0");
    }
    return sign + digits.slice(0, newDot) + "." + digits.slice(newDot);
  }

  function plainNumber(value) {
    if (!Number.isFinite(value)) return "";
    var text = String(parseFloat(value.toPrecision(12)));
    if (text.indexOf("e") !== -1) text = expandExponential(text);
    return text;
  }

  function prettyExpr(raw) {
    if (!raw) return "";

    var out = "";
    var i = 0;

    while (i < raw.length) {
      var ch = raw[i];

      // Numbers (including scientific notation) stay in one piece.
      if (isDigit(ch) || (ch === "." && isDigit(raw[i + 1] || ""))) {
        var num = "";
        while (i < raw.length && (isDigit(raw[i]) || raw[i] === ".")) {
          num += raw[i];
          i += 1;
        }
        if (raw[i] === "e" || raw[i] === "E") {
          var j = i + 1;
          var exp = "";
          if (raw[j] === "+" || raw[j] === "-") {
            exp = raw[j];
            j += 1;
          }
          if (isDigit(raw[j] || "")) {
            exp += raw[j];
            j += 1;
            while (j < raw.length && isDigit(raw[j])) {
              exp += raw[j];
              j += 1;
            }
            num += "e" + exp;
            i = j;
          }
        }
        out += num;
        continue;
      }

      var prev = raw[i - 1] || "";
      var isBinary =
        ch === "+" ||
        ch === "×" ||
        ch === "÷" ||
        ch === "^" ||
        (ch === "-" && /[0-9)πe%]/.test(prev));

      if (isBinary) {
        out = out.replace(/\s+$/, "");
        out += " " + ch + " ";
      } else {
        out += ch;
      }
      i += 1;
    }

    return out
      .replace(/\s+/g, " ")
      .replace(/\( /g, "(")
      .replace(/ \)/g, ")")
      .replace(/-/g, "−")
      .trim();
  }

  var api = {
    evaluate: evaluate,
    tokenize: tokenize,
    balanceParens: balanceParens,
    formatNumber: formatNumber,
    plainNumber: plainNumber,
    prettyExpr: prettyExpr
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CalcEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
