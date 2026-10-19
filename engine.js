/* ===== Nova calculator engine =====
 * Pure math utilities: tokenizer, recursive-descent parser, formatting.
 * No DOM dependencies, so it can be tested in Node.
 */
(function (root) {
  "use strict";

  var DEG_TO_RAD = Math.PI / 180;
  var FUNCTION_NAMES = ["sin", "cos", "tan", "ln", "log", "sqrt"];

  function cleanTrig(value) {
    if (Math.abs(value) < 1e-12) return 0;
    if (Math.abs(value - 1) < 1e-12) return 1;
    if (Math.abs(value + 1) < 1e-12) return -1;
    return value;
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
      case "ln":
        return Math.log(arg);
      case "log":
        return Math.log10(arg);
      case "sqrt":
        return Math.sqrt(arg);
      default:
        throw new Error("Unknown function");
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
        tokens.push({ type: "number", value: parseFloat(rawNumber) });
      } else if (ch === "π") {
        tokens.push({ type: "number", value: Math.PI });
        i += 1;
      } else if (ch === "√") {
        tokens.push({ type: "func", value: "sqrt" });
        i += 1;
      } else if ("+-×÷*/^%()".indexOf(ch) !== -1) {
        tokens.push({ type: "op", value: ch });
        i += 1;
      } else if (isLetter(ch)) {
        var nameStart = i;
        while (i < source.length && isLetter(source[i])) i += 1;
        var name = source.slice(nameStart, i);
        if (name === "e") {
          tokens.push({ type: "number", value: Math.E });
        } else if (FUNCTION_NAMES.indexOf(name) !== -1) {
          tokens.push({ type: "func", value: name });
        } else {
          throw new Error("Unknown token");
        }
      } else {
        throw new Error("Invalid character");
      }
    }

    return tokens;
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
    if (this.pos !== this.tokens.length) throw new Error("Unexpected token");
    return value;
  };

  Parser.prototype.startsValue = function (token) {
    if (!token) return false;
    if (token.type === "number" || token.type === "func") return true;
    return token.type === "op" && token.value === "(";
  };

  Parser.prototype.parseExpression = function () {
    var value = this.parseTerm();
    while (true) {
      var token = this.peek();
      if (!token || token.type !== "op" || (token.value !== "+" && token.value !== "-")) break;
      this.next();
      var right = this.parseTerm();
      value = token.value === "+" ? value + right : value - right;
    }
    return value;
  };

  Parser.prototype.parseTerm = function () {
    var value = this.parseUnary();
    while (true) {
      var token = this.peek();
      if (token && token.type === "op" && "×÷*/".indexOf(token.value) !== -1) {
        this.next();
        var right = this.parseUnary();
        value = token.value === "×" || token.value === "*" ? value * right : value / right;
      } else if (this.startsValue(token)) {
        value *= this.parseUnary();
      } else {
        break;
      }
    }
    return value;
  };

  Parser.prototype.parseUnary = function () {
    var token = this.peek();
    if (token && token.type === "op" && (token.value === "+" || token.value === "-")) {
      this.next();
      var value = this.parseUnary();
      return token.value === "-" ? -value : value;
    }
    return this.parsePower();
  };

  Parser.prototype.parsePower = function () {
    var base = this.parsePostfix();
    var token = this.peek();
    if (token && token.type === "op" && token.value === "^") {
      this.next();
      var exponent = this.parseUnary();
      return Math.pow(base, exponent);
    }
    return base;
  };

  Parser.prototype.parsePostfix = function () {
    var value = this.parsePrimary();
    while (true) {
      var token = this.peek();
      if (token && token.type === "op" && token.value === "%") {
        this.next();
        value /= 100;
      } else {
        break;
      }
    }
    return value;
  };

  Parser.prototype.parsePrimary = function () {
    var token = this.next();
    if (!token) throw new Error("Incomplete expression");

    if (token.type === "number") return token.value;

    if (token.type === "func") {
      var open = this.next();
      if (!open || open.value !== "(") throw new Error("Expected (");
      var arg = this.parseExpression();
      var close = this.next();
      if (!close || close.value !== ")") throw new Error("Missing )");
      return applyFunction(token.value, arg, this.angle);
    }

    if (token.type === "op" && token.value === "(") {
      var value = this.parseExpression();
      var paren = this.next();
      if (!paren || paren.value !== ")") throw new Error("Missing )");
      return value;
    }

    throw new Error("Unexpected token");
  };

  function evaluate(expression, options) {
    if (typeof expression !== "string" || expression.trim() === "") return null;
    var angle = options && options.angle === "RAD" ? "RAD" : "DEG";
    var tokens = tokenize(expression);
    if (!tokens.length) return null;
    var value = new Parser(tokens, angle).parse();
    if (Number.isNaN(value)) throw new Error("Undefined result");
    return value;
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

    for (var i = 0; i < raw.length; i += 1) {
      var ch = raw[i];
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
