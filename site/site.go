// Package site is the block gallery of the linear algebra platform: each
// block is a Go function that renders one piece of a lesson (a matrix, a
// code editor, a transformation playground, ...), shown in a framed preview.
package site

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/alexisbcz/components/ui/runtime"
	h "github.com/alexisbcz/libhtml"
	"github.com/alexisbcz/libhtml/secure"
)

//go:embed static
var static embed.FS

// Block is one entry of the gallery.
type Block struct {
	Slug        string
	Title       string
	Description string
	Tags        []string
	Render      func() h.Node
	// Wide blocks take the full width of the preview instead of being
	// centered at a reading width.
	Wide bool
}

// Blocks lists the gallery in display order.
func Blocks() []Block {
	return []Block{
		courseShellBlock(),
		lessonHeaderBlock(),
		courseOutlineBlock(),
		theoremBlock(),
		matrixBlock(),
		codeBlockBlock(),
		editorBlock(),
		testResultsBlock(),
		diffBlock(),
		transformBlock(),
		dotProductBlock(),
		eliminationBlock(),
		quizBlock(),
		matrixInputBlock(),
		hintsBlock(),
		anatomyBlock(),
	}
}

// Handler serves the gallery, its static files and the components'
// client runtime, behind the security headers (strict CSP with a nonce).
func Handler() http.Handler {
	assets, _ := fs.Sub(static, "static")
	mux := http.NewServeMux()
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServerFS(assets)))
	mux.Handle(runtime.Prefix, runtime.Handler())
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		_ = h.WriteHTTP(w, http.StatusOK, gallery(r))
	})
	return secure.Headers(secure.Config{})(mux)
}

// RenderGallery renders the gallery outside a request, for the stylesheet
// generator.
func RenderGallery() (string, error) {
	r, _ := http.NewRequest("GET", "/", nil)
	return h.RenderString(gallery(r))
}
