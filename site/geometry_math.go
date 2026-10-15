package site

import "math"

// Degree-based trigonometry for the geometry figures drawn in Go.
func cosd(a float64) float64      { return math.Cos(a * math.Pi / 180) }
func sind(a float64) float64      { return math.Sin(a * math.Pi / 180) }
func atan2d(y, x float64) float64 { return math.Atan2(y, x) * 180 / math.Pi }
