# Nova · Calculator

A polished, glassmorphic calculator web app built with plain HTML, CSS, and JavaScript. No build step, no dependencies.

![Dark and light themes, scientific mode, and history](https://img.shields.io/badge/stack-vanilla%20JS-7c5cff)

## Run it

Just open `index.html` in a browser:

```bash
xdg-open index.html
```

Or serve the folder locally:

```bash
cd nova-calc
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Features

- **Live preview** — the result updates as you type, with a separate expression line
- **Correct precedence** — `2 + 3 × 4` is `14`; supports parentheses, powers, and implicit multiplication (`2π`, `2(3+4)`)
- **Scientific mode** — `sin`, `cos`, `tan`, `ln`, `log`, `√`, `x²`, `xʸ`, `π`, `e`, and parentheses
- **DEG / RAD** angle toggle
- **History** — last 40 calculations, click any entry to reuse its result; saved in `localStorage`
- **Dark & light themes** — follows your system preference by default
- **Full keyboard support**
- **Responsive** — history becomes a slide-out drawer on small screens
- **Accessible** — focus states, ARIA labels, reduced-motion support

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `0–9`, `.` | Numbers |
| `+` `-` `*` `/` `^` | Operators |
| `%` | Percent |
| `(` `)` | Parentheses |
| `Enter` or `=` | Evaluate |
| `Backspace` | Delete last input |
| `Esc` or `Delete` | Clear |
| `P` | Insert π |

## Notes

- `%` is a postfix divide-by-100 operator (`50%` → `0.5`).
- Calculations are stored locally only; nothing leaves your browser.
- The display rounds to 12 significant digits to keep floating-point noise out of results.

## Files

```
nova-calc/
├── index.html   # markup
├── styles.css   # theme tokens, layout, animations
├── engine.js    # tokenizer, parser, formatting (DOM-free, Node-testable)
└── app.js       # UI state, input handling, history, events
```
