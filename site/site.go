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

// Collection is one subject's set of blocks, served at its own path.
type Collection struct {
	Slug, Name, Path string
	Title, Lede      string
	Blocks           func() []Block
}

// Collections lists the subjects, in header order.
func Collections() []Collection {
	return []Collection{
		{Slug: "linalg", Name: "Linear Algebra", Path: "/",
			Title:  "The blocks of an interactive linear algebra course",
			Lede:   "Every block is a Go function rendered on the server with libhtml and the shadcn/ui components for Go. A few kilobytes of vanilla JavaScript make the interactive ones move. No Node.js, no bundler.",
			Blocks: Blocks},
		{Slug: "neuro", Name: "Neuroscience", Path: "/neuro",
			Title:  "The blocks of an interactive neuroscience course",
			Lede:   "Science taught with live models, not pictures of them: the action potential is the Hodgkin–Huxley equations integrated in your browser, membrane potentials come from Nernst and Goldman, spike trains from a Poisson process.",
			Blocks: NeuroBlocks},
	}
}

// Blocks lists the linear algebra gallery in display order.
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
	for _, c := range Collections() {
		mux.HandleFunc("GET "+c.Path+h.Ternary(c.Path == "/", "{$}", ""), func(w http.ResponseWriter, r *http.Request) {
			_ = h.WriteHTTP(w, http.StatusOK, gallery(r, c))
		})
	}
	return secure.Headers(secure.Config{})(mux)
}

// RenderGallery renders every collection outside a request, for the
// stylesheet generator.
func RenderGallery() (string, error) {
	out := ""
	for _, c := range Collections() {
		r, _ := http.NewRequest("GET", c.Path, nil)
		s, err := h.RenderString(gallery(r, c))
		if err != nil {
			return "", err
		}
		out += s
	}
	return out, nil
}
