# education

The block gallery for the platform rework: 32 subjects (mathematics,
computing, physical, earth and life sciences, society and humanities), each a
collection of server-rendered blocks built with
github.com/alexisbcz/{libhtml,components,icons,tailwind}. `/subjects` lists
them all; the header menu groups them by area (site/areas.go).

```sh
go generate ./...          # rebuild site/static/app.css (Tailwind in Go)
go run . -addr :8080       # http://localhost:8080
node figures/matvec/build.mjs   # rebuild the isometric figure (anatomy kit)
```

| Path | What it is |
| --- | --- |
| `site/blocks_*.go` | Linear algebra blocks, one function each |
| `site/<subject>*.go` | Each subject's blocks; collections are listed in `Collections()` in `site/site.go` |
| `site/areas.go` | Areas for the subject menu and the `/subjects` catalog |
| `site/highlight.go`, `static/js/highlight.js` | One Python lexer, in Go (first paint) and JS (editor) |
| `site/math.go` | MathML Core helpers |
| `site/styles/app.css` | Theme: shadcn neutral, Pierre code colors, Emil Kowalski easings |
| `site/static/js/` | Vanilla ES modules under a strict nonce CSP. Every file is imported on its own by the page (`moduleLoader` in `site/layout.go`), so one failing module cannot stop the others. Prefix block root attributes with the subject (`data-thermo-phase`), since every module scans the whole page |
| `figures/*/` | Build scripts of the isometric figures (anatomy skill): y = Ax, seismograph, Stirling engine |
| `cmd/gen/` | Stylesheet generator: scans site, JS, the components module and the rendered gallery |
