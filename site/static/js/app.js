// Deprecated: pages no longer load this file. site/layout.go imports every
// module in static/js on its own (moduleLoader), so a missing or broken
// module cannot stop the others. The lines below are kept for reference.
// Entry module of the gallery. It is loaded with the request's CSP nonce;
// 'strict-dynamic' lets it import the block modules below. Each module
// finds its own blocks with a data attribute and does nothing otherwise.

import "./chrome.js";
import "./matrix.js";
import "./editor.js";
import "./transform.js";
import "./dot.js";
import "./elimination.js";
import "./exercises.js";
import "./anatomy-loader.js";
import "./shell.js";
import "./neuro.js";
import "./ml.js";
import "./ml-fit.js";
import "./history.js";
import "./quantum.js";
import "./physics.js";
import "./thermo.js";
import "./sociology.js";
import "./geology.js";
import "./chemistry.js";
import "./stats.js";
import "./calculus.js";
import "./probability.js";
import "./crypto.js";
import "./logic.js";
import "./biology.js";
import "./epidemiology.js";
import "./paleo.js";
import "./geometry.js";
import "./physiology.js";
import "./economics.js";
import "./geography.js";
import "./discrete.js";
import "./algorithms.js";
import "./linguistics.js";
import "./music.js";
import "./psychology.js";
import "./philosophy.js";
import "./astronomy.js";
import "./climate.js";
import "./em.js";
import "./arch.js";
