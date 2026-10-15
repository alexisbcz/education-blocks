package site

import (
	"strings"
	"unicode"

	h "github.com/alexisbcz/libhtml"
)

// A token is a run of source text and its syntax class ("" for plain text).
type token struct {
	class string
	text  string
}

var pyKeywords = set("and", "as", "assert", "async", "await", "break", "class", "continue",
	"def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
	"import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
	"try", "while", "with", "yield", "match", "case")

var pyConstants = set("True", "False", "None", "self", "cls")

var pyBuiltins = set("abs", "all", "any", "enumerate", "float", "int", "len", "list",
	"map", "max", "min", "print", "range", "round", "sum", "tuple", "zip", "isinstance",
	"sorted", "reversed", "str", "dict", "set", "np", "math")

func set(words ...string) map[string]bool {
	m := make(map[string]bool, len(words))
	for _, w := range words {
		m[w] = true
	}
	return m
}

// tokenizePython splits one line of Python into tokens. It is a small
// lexer, not a parser: enough for lesson code (keywords, strings,
// numbers, comments, calls, decorators). site/static/js/highlight.js
// implements the same rules for the editor, so server and client agree.
func tokenizePython(line string) []token {
	var out []token
	rs := []rune(line)
	emit := func(class string, s []rune) {
		if len(s) == 0 {
			return
		}
		if n := len(out); n > 0 && out[n-1].class == class {
			out[n-1].text += string(s)
			return
		}
		out = append(out, token{class, string(s)})
	}
	for i := 0; i < len(rs); {
		c := rs[i]
		switch {
		case c == '#':
			emit("comment", rs[i:])
			return out
		case c == '"' || c == '\'':
			j := i + 1
			for j < len(rs) && rs[j] != c {
				if rs[j] == '\\' {
					j++
				}
				j++
			}
			j = min(j+1, len(rs))
			emit("string", rs[i:j])
			i = j
		case c == '@' && strings.TrimSpace(string(rs[:i])) == "":
			j := i + 1
			for j < len(rs) && (isIdent(rs[j]) || rs[j] == '.') {
				j++
			}
			emit("decorator", rs[i:j])
			i = j
		case unicode.IsDigit(c) || (c == '.' && i+1 < len(rs) && unicode.IsDigit(rs[i+1])):
			j := i
			for j < len(rs) && (unicode.IsDigit(rs[j]) || rs[j] == '.' || rs[j] == '_' || rs[j] == 'e' || rs[j] == 'j') {
				j++
			}
			emit("number", rs[i:j])
			i = j
		case isIdent(c):
			j := i
			for j < len(rs) && (isIdent(rs[j]) || unicode.IsDigit(rs[j])) {
				j++
			}
			w := string(rs[i:j])
			k := j
			for k < len(rs) && rs[k] == ' ' {
				k++
			}
			prev := lastWord(out)
			switch {
			case pyKeywords[w]:
				emit("keyword", rs[i:j])
			case pyConstants[w]:
				emit("constant", rs[i:j])
			case prev == "def" || prev == "class":
				emit("function", rs[i:j])
			case k < len(rs) && rs[k] == '(':
				if pyBuiltins[w] {
					emit("builtin", rs[i:j])
				} else {
					emit("function", rs[i:j])
				}
			case pyBuiltins[w]:
				emit("builtin", rs[i:j])
			default:
				emit("", rs[i:j])
			}
			i = j
		case strings.ContainsRune("+-*/%=<>!&|^~@", c):
			j := i
			for j < len(rs) && strings.ContainsRune("+-*/%=<>!&|^~@", rs[j]) {
				j++
			}
			emit("operator", rs[i:j])
			i = j
		case strings.ContainsRune("()[]{},:.", c):
			emit("punct", rs[i:i+1])
			i++
		default:
			emit("", rs[i:i+1])
			i++
		}
	}
	return out
}

func isIdent(r rune) bool { return r == '_' || unicode.IsLetter(r) }

// lastWord is the text of the last non-blank token, to tell a function
// name after "def" from a variable.
func lastWord(ts []token) string {
	for i := len(ts) - 1; i >= 0; i-- {
		if t := strings.TrimSpace(ts[i].text); t != "" {
			return t
		}
	}
	return ""
}

// highlightLine renders one line of Python as token spans.
func highlightLine(line string) h.Node {
	ts := tokenizePython(line)
	nodes := make([]h.Node, 0, len(ts))
	for _, t := range ts {
		if t.class == "" {
			nodes = append(nodes, h.Text(t.text))
			continue
		}
		nodes = append(nodes, h.Span(h.Class("tok-"+t.class), t.text))
	}
	return h.Group(nodes)
}
