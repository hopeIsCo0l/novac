/* Nova engine tests — run with: npm test */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const engine = require(path.join(__dirname, "..", "engine.js"));

const DEG = { angle: "DEG" };
const RAD = { angle: "RAD" };

function value(expression, options) {
  return engine.evaluate(expression, options);
}

function close(actual, expected, tolerance = 1e-12) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`
  );
}

test("precedence and grouping", () => {
  assert.equal(value("2+3×4"), 14);
  assert.equal(value("(2+3)×4"), 20);
  assert.equal(value("2(3+4)"), 14);
  assert.equal(value("2π"), 2 * Math.PI);
  assert.equal(value("10-2-3"), 5);
  assert.equal(value("100÷5÷2"), 10);
});

test("powers", () => {
  assert.equal(value("2^3"), 8);
  assert.equal(value("2^3^2"), 512, "powers are right-associative");
  assert.equal(value("-2^2"), -4, "unary minus binds looser than power");
  assert.equal(value("2^-2"), 0.25);
  assert.equal(value("9^(1/2)"), 3);
});

test("percent is contextual", () => {
  assert.equal(value("50%"), 0.5);
  assert.equal(value("50%×2"), 1);
  assert.equal(value("200+10%"), 220);
  assert.equal(value("200-10%"), 180);
  assert.equal(value("5+10%"), 5.5);
  assert.equal(value("100×10%"), 10);
  assert.equal(value("100÷10%"), 1000);
  assert.equal(value("10%+5"), 5.1);
});

test("scientific notation", () => {
  assert.equal(value("1e3"), 1000);
  assert.equal(value("1.5e2"), 150);
  assert.equal(value("1e-3"), 0.001);
  assert.equal(value("2.5E4"), 25000);
  assert.ok(Math.abs(value("2e") - 2 * Math.E) < 1e-12, "a lone e is Euler's number");
});

test("trigonometry honours the angle mode", () => {
  close(value("sin(30)", DEG), 0.5);
  close(value("sin30", DEG), 0.5, 1e-12);
  close(value("sin(30)", RAD), Math.sin(30));
  close(value("cos(60)", DEG), 0.5);
  assert.throws(() => value("tan(90)", DEG), /Undefined result/);
});

test("inverse trigonometry returns the current angle unit", () => {
  close(value("asin(0.5)", DEG), 30);
  close(value("acos(0.5)", DEG), 60);
  close(value("atan(1)", DEG), 45);
  close(value("asin(0.5)", RAD), Math.PI / 6);
});

test("logarithms, roots and powers of ten", () => {
  assert.equal(value("ln(e)"), 1);
  assert.equal(value("log(1000)"), 3);
  assert.equal(value("sqrt(9)"), 3);
  assert.equal(value("√9"), 3, "square root without brackets");
  assert.equal(value("exp(0)"), 1);
});

test("rounding and absolute value", () => {
  assert.equal(value("abs(-5)"), 5);
  assert.equal(value("round(2.567)"), 3);
  assert.equal(value("floor(2.9)"), 2);
  assert.equal(value("ceil(2.1)"), 3);
});

test("factorial", () => {
  assert.equal(value("5!"), 120);
  assert.equal(value("0!"), 1);
  assert.equal(value("3!×2"), 12);
  assert.throws(() => value("3.5!"), /whole number/);
});

test("division by zero and undefined results", () => {
  assert.equal(value("1/0"), Infinity);
  assert.throws(() => value("0/0"), /Undefined result/);
  assert.throws(() => value("√(-1)"), /Undefined result/);
});

test("friendly error messages", () => {
  assert.throws(() => value("foo(2)"), /Unknown function: foo/);
  assert.throws(() => value("2 @ 3"), /Unexpected character/);
  assert.throws(() => value("sin(30"), /Missing a closing bracket/);
  assert.throws(() => value("2+"), /Incomplete expression/);
});

test("balanceParens closes open brackets", () => {
  assert.equal(engine.balanceParens("sin(30"), "sin(30)");
  assert.equal(engine.balanceParens("2×(3+4"), "2×(3+4)");
  assert.equal(engine.balanceParens("2×(3+4)"), "2×(3+4)");
  assert.equal(engine.balanceParens(""), "");
});

test("preview and final answer agree on unbalanced input", () => {
  const expression = "√(9";
  assert.equal(value(engine.balanceParens(expression)), 3);
});

test("formatting", () => {
  assert.equal(engine.formatNumber(0.1 + 0.2), "0.3");
  assert.equal(engine.formatNumber(1 / 3), "0.3333333333");
  assert.equal(engine.formatNumber(Infinity), "∞");
  assert.equal(engine.formatNumber(-Infinity), "−∞");
  assert.equal(engine.formatNumber(1e21), "1e21");
  assert.equal(engine.formatNumber(-0), "0");
  assert.equal(engine.formatNumber(1234567.891), "1,234,567.891");
});

test("expression pretty printing", () => {
  assert.equal(engine.prettyExpr("2+3×4"), "2 + 3 × 4");
  assert.equal(engine.prettyExpr("2-3"), "2 − 3");
  assert.equal(engine.prettyExpr("(2+3)×4"), "(2 + 3) × 4");
  assert.equal(engine.prettyExpr("1e-3"), "1e−3", "exponent signs are not binary operators");
  assert.equal(engine.prettyExpr("sin(30)"), "sin(30)");
});
