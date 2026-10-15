// Command gen builds site/static/app.css with Tailwind CSS v4 in Go. It
// scans the site's Go files, the components module wherever the module
// cache holds it, and the rendered gallery itself, so every class a block
// renders (including classes the components compute at render time) is in
// the stylesheet.
//
//	go generate ./...
package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"education/site"

	"github.com/alexisbcz/tailwind"
)

func main() {
	root, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	out, err := exec.Command("go", "list", "-m", "-f", "{{.Dir}}", "github.com/alexisbcz/components").Output()
	if err != nil {
		log.Fatalf("locating github.com/alexisbcz/components: %v", err)
	}
	components := strings.TrimSpace(string(out))

	// The rendered gallery, scanned like any other source file.
	tmp, err := os.MkdirTemp("", "education-gen")
	if err != nil {
		log.Fatal(err)
	}
	defer os.RemoveAll(tmp)
	html, err := site.RenderGallery()
	if err != nil {
		log.Fatal(err)
	}
	rendered := filepath.Join(tmp, "gallery.html")
	if err := os.WriteFile(rendered, []byte(html), 0o644); err != nil {
		log.Fatal(err)
	}

	theme, err := os.ReadFile(filepath.Join(root, "site", "styles", "app.css"))
	if err != nil {
		log.Fatal(err)
	}
	input := fmt.Sprintf("@import \"tailwindcss\" source(none);\n@import \"tw-animate-css\";\n@source %q;\n@source %q;\n@source %q;\n@source %q;\n%s",
		filepath.Join(root, "site", "*.go"),
		filepath.Join(root, "site", "static", "js", "*.js"),
		filepath.Join(components, "**", "*.go"),
		rendered,
		theme)
	res, err := tailwind.Build(tailwind.Options{CSS: input, Dir: root, Minify: true})
	if err != nil {
		log.Fatal(err)
	}
	dst := filepath.Join(root, "site", "static", "app.css")
	if err := os.WriteFile(dst, []byte(res.CSS), 0o644); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%s: %d bytes\n", dst, len(res.CSS))
}
