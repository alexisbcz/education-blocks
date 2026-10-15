# education

The block gallery for the linear algebra platform rework: 15 server-rendered
blocks built with github.com/alexisbcz/{libhtml,components,icons,tailwind}.

```sh
go generate ./...          # rebuild site/static/app.css (Tailwind in Go)
go run . -addr :8080       # http://localhost:8080
node figures/matvec/build.mjs   # rebuild the isometric figure (anatomy kit)
```

| Path | What it is |
| --- | --- |
| `site/blocks_*.go` | The blocks, one function each, listed in `site/site.go` |
| `site/highlight.go`, `static/js/highlight.js` | One Python lexer, in Go (first paint) and JS (editor) |
| `site/math.go` | MathML Core helpers |
| `site/styles/app.css` | Theme: shadcn neutral, Pierre code colors, Emil Kowalski easings |
| `site/static/js/` | Vanilla ES modules, loaded under a strict nonce CSP |
| `figures/matvec/` | Build script of the y = Ax mechanism figure |
| `cmd/gen/` | Stylesheet generator: scans site, JS, the components module and the rendered gallery |
