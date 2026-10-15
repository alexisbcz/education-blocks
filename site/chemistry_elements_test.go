package site

import "testing"

func TestElements(t *testing.T) {
	if len(elements) != 118 {
		t.Fatalf("got %d elements", len(elements))
	}
	for i, e := range elements {
		if e.Z != i+1 {
			t.Errorf("row %d has Z=%d", i, e.Z)
		}
		if e.Mass <= 0 {
			t.Errorf("%s: no mass", e.Symbol)
		}
	}
	check := func(z int, sym, w string, period, group int, cfg string) {
		e := elements[z-1]
		if e.Symbol != sym || e.Weight != w || e.Period != period || e.Group != group || e.Config != cfg {
			t.Errorf("%d: got %s %s p%d g%d %q", z, e.Symbol, e.Weight, e.Period, e.Group, e.Config)
		}
	}
	check(1, "H", "1.008", 1, 1, "1s¹")
	check(5, "B", "10.81", 2, 13, "[He] 2s² 2p¹")
	check(24, "Cr", "51.996", 4, 6, "[Ar] 3d⁵ 4s¹")
	check(26, "Fe", "55.845", 4, 8, "[Ar] 3d⁶ 4s²")
	check(29, "Cu", "63.546", 4, 11, "[Ar] 3d¹⁰ 4s¹")
	check(46, "Pd", "106.42", 5, 10, "[Kr] 4d¹⁰")
	check(72, "Hf", "178.49", 6, 4, "[Xe] 4f¹⁴ 5d² 6s²")
	check(79, "Au", "196.97", 6, 11, "[Xe] 4f¹⁴ 5d¹⁰ 6s¹")
	check(86, "Rn", "[222]", 6, 18, "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶")
	check(64, "Gd", "157.25", 6, 0, "[Xe] 4f⁷ 5d¹ 6s²")
	check(92, "U", "238.03", 7, 0, "[Rn] 5f³ 6d¹ 7s²")
	check(103, "Lr", "[266]", 7, 0, "[Rn] 5f¹⁴ 7s² 7p¹")
	check(118, "Og", "[294]", 7, 18, "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶")
	if e := elements[56]; e.Row != 9 || e.Col != 3 {
		t.Errorf("La at %d,%d", e.Row, e.Col)
	}
	if e := elements[102]; e.Row != 10 || e.Col != 17 {
		t.Errorf("Lr at %d,%d", e.Row, e.Col)
	}
	seen := map[[2]int]string{}
	for _, e := range elements {
		k := [2]int{e.Row, e.Col}
		if s, ok := seen[k]; ok {
			t.Errorf("%s and %s share a cell", s, e.Symbol)
		}
		seen[k] = e.Symbol
	}
}
