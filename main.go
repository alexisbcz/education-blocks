// Command education serves the component gallery of the linear algebra
// platform: the blocks lessons are built from, rendered on the server with
// libhtml and the shadcn/ui components for Go.
//
//	go generate ./...   # rebuild site/static/app.css after changing classes
//	go run .            # http://localhost:8080
package main

import (
	"flag"
	"log"
	"net/http"
	"time"

	"education/site"
)

//go:generate go run ./cmd/gen

func main() {
	addr := flag.String("addr", "localhost:8080", "listen address")
	flag.Parse()
	srv := &http.Server{
		Addr:              *addr,
		Handler:           site.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
	}
	log.Printf("listening on http://%s", *addr)
	log.Fatal(srv.ListenAndServe())
}
