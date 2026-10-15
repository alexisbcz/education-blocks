// The Web Worker behind the parallel computing "Real threads" block: it
// computes Mandelbrot escape counts for the rows it is sent. The page's
// module loader also imports every parallel-*.js file, so outside a
// worker this file does nothing.

if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  self.onmessage = (e) => {
    const { rows, cx, cy, scale, width, height, iter } = e.data;
    const t0 = performance.now();
    const data = new Uint16Array(rows.length * width);
    rows.forEach((y, r) => {
      const ci = cy + (y - height / 2) * scale;
      for (let x = 0; x < width; x++) {
        const cr = cx + (x - width / 2) * scale;
        let zr = 0, zi = 0, n = 0;
        while (n < iter && zr * zr + zi * zi <= 4) {
          const t = zr * zr - zi * zi + cr;
          zi = 2 * zr * zi + ci;
          zr = t;
          n++;
        }
        data[r * width + x] = n;
      }
    });
    self.postMessage({ rows, data, ms: performance.now() - t0 }, [data.buffer]);
  };
}
