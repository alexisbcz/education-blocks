// Command build exports the gallery as a static site for GitHub Pages
// (default ./dist):
//
//	go run ./cmd/build [-o dist] [-base /education-blocks/]
//
// Every page (the catalog and each subject) is rendered through the real
// handler, the static files and the components' runtime are copied, and
// absolute paths are rewritten under -base, since a project site lives in
// a subdirectory. Each subject is written as <slug>/index.html, so
// /education-blocks/ml/ serves without a server.
package main

import (
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"education/site"

	"github.com/alexisbcz/components/ui/runtime"
)

func main() {
	out := flag.String("o", "dist", "output directory")
	base := flag.String("base", "/education-blocks/", "URL path the site is served under")
	flag.Parse()
	if !strings.HasSuffix(*base, "/") {
		*base += "/"
	}
	start := time.Now()
	must(os.RemoveAll(*out))
	must(os.MkdirAll(*out, 0o755))

	// Static files, with the stylesheets' absolute URLs rebased.
	must(filepath.WalkDir("site/static", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		b, err := os.ReadFile(p)
		must(err)
		if strings.HasSuffix(p, ".css") {
			b = []byte(strings.ReplaceAll(string(b), `url("/static/`, `url("`+*base+`static/`))
		}
		write(filepath.Join(*out, "static", strings.TrimPrefix(p, "site/static/")), b)
		return nil
	}))

	// The components' runtime, following its relative imports.
	handler := site.Handler()
	importRe := regexp.MustCompile(`(?:from|import)\s*\(?\s*"(\./[^"]+\.js)"`)
	seen := map[string]bool{}
	var visit func(name string)
	visit = func(name string) {
		if seen[name] {
			return
		}
		seen[name] = true
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest("GET", runtime.Prefix+name, nil))
		if rec.Code != 200 {
			log.Fatalf("runtime %s: %d", name, rec.Code)
		}
		body := rec.Body.Bytes()
		write(filepath.Join(*out, strings.TrimPrefix(runtime.Prefix, "/"), name), body)
		for _, m := range importRe.FindAllSubmatch(body, -1) {
			visit(strings.TrimPrefix(string(m[1]), "./"))
		}
	}
	visit("index.js")
	for _, n := range runtime.Names() {
		visit(n + ".js")
	}

	// Pages.
	attrRe := regexp.MustCompile(`((?:href|src|action|poster)=")/([^/"]?)`)
	rebase := func(html string) string {
		html = attrRe.ReplaceAllString(html, "${1}"+*base+"${2}")
		// The module loader's list of paths.
		return strings.ReplaceAll(html, `"/static/js/`, `"`+*base+`static/js/`)
	}
	pages := []string{"/", "/subjects"}
	for _, c := range site.Collections() {
		pages = append(pages, c.Path)
	}
	for _, p := range pages {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		if rec.Code != 200 {
			log.Fatalf("page %s: %d", p, rec.Code)
		}
		dst := filepath.Join(*out, strings.Trim(p, "/"), "index.html")
		write(dst, []byte(rebase(rec.Body.String())))
	}
	write(filepath.Join(*out, ".nojekyll"), nil) // keep _shadcn/: Jekyll drops _ directories
	fmt.Printf("%s: %d pages, %d runtime modules in %s\n", *out, len(pages), len(seen), time.Since(start).Round(time.Millisecond))
}

func write(path string, b []byte) {
	must(os.MkdirAll(filepath.Dir(path), 0o755))
	must(os.WriteFile(path, b, 0o644))
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
