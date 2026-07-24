// Lag-alignment widget: two real depth profiles (Garmin Descent Mk3i and
// Shearwater Perdix 2 recording the same 101.5 m dive), a lag slider, and the
// normalized cross-correlation computed live, same 10 s grid as bottomtime's
// matcher (match/correlate.py).
//
// Astro's ClientRouter swaps the DOM without reliably re-running content
// scripts (same issue as the homepage widgets, see commit d11ca96), so all
// wiring lives in init(), which re-runs on astro:page-load with fresh element
// lookups and a data-wired guard against double-binding.
(function () {
  const GRID = 10;
  const LAG_MIN = -120;
  const LAG_MAX = 120;
  const LAG_STEP = 5;

  const css = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };

  // Linear interpolation of (t, depth) points onto the common grid,
  // port of correlate.resample.
  function resample(points, t0, t1) {
    const out = [];
    let i = 0;
    for (let t = t0; t <= t1; t += GRID) {
      while (i + 1 < points.length && points[i + 1][0] < t) i++;
      if (t <= points[0][0]) out.push(points[0][1]);
      else if (t >= points[points.length - 1][0]) out.push(points[points.length - 1][1]);
      else {
        const [ta, da] = points[i];
        const [tb, db] = points[i + 1];
        out.push(tb === ta ? da : da + ((db - da) * (t - ta)) / (tb - ta));
      }
    }
    return out;
  }

  function ncc(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 6) return 0;
    let ma = 0;
    let mb = 0;
    for (let i = 0; i < n; i++) {
      ma += a[i];
      mb += b[i];
    }
    ma /= n;
    mb /= n;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < n; i++) {
      num += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) * (a[i] - ma);
      db += (b[i] - mb) * (b[i] - mb);
    }
    if (da === 0 || db === 0) return 0;
    return num / (Math.sqrt(da) * Math.sqrt(db));
  }

  function init() {
    const root = document.getElementById('lag-widget');
    if (!root || root.dataset.wired) return;
    root.dataset.wired = '1';

    const profCanvas = document.getElementById('lag-profiles');
    const nccCanvas = document.getElementById('lag-ncc');
    const slider = document.getElementById('lag-slider');
    const lagOut = document.getElementById('lag-value');
    const nccOut = document.getElementById('ncc-value');

    let g = [];
    let s = [];
    let curve = [];

    function nccAtLag(lag) {
      const shifted = s.map((p) => [p[0] + lag, p[1]]);
      const t0 = Math.max(g[0][0], shifted[0][0]);
      const t1 = Math.min(g[g.length - 1][0], shifted[shifted.length - 1][0]);
      if (t1 - t0 < 3 * GRID) return 0;
      return ncc(resample(g, t0, t1), resample(shifted, t0, t1));
    }

    function sizeCanvas(canvas, cssHeight) {
      const dpr = window.devicePixelRatio || 1;
      // Canvas must fit the content box: clientWidth still includes the div's
      // horizontal padding, so subtract it or the canvas overflows to the right.
      const cs = getComputedStyle(root);
      const w = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      canvas.style.width = w + 'px';
      canvas.style.height = cssHeight + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    }

    function drawProfiles(lag) {
      const ctx = sizeCanvas(profCanvas, 240);
      const W = profCanvas.clientWidth;
      const H = 240;
      const ink = css('--ink', '#18120c');
      const accent = css('--accent', '#cc3a1d');
      const faint = 'color-mix(in srgb, ' + ink + ' 25%, transparent)';

      const mL = 40;
      const mR = 8;
      const mT = 8;
      const mB = 26;
      const t0 = Math.min(g[0][0], s[0][0]) - 60;
      const t1 = Math.max(g[g.length - 1][0], s[s.length - 1][0]) + 60;
      const dMax = 110;
      const x = (t) => mL + ((t - t0) / (t1 - t0)) * (W - mL - mR);
      const y = (d) => mT + (d / dMax) * (H - mT - mB);

      ctx.clearRect(0, 0, W, H);
      ctx.font = '10px monospace';
      ctx.strokeStyle = faint;
      ctx.fillStyle = faint;
      ctx.lineWidth = 1;

      for (let d = 0; d <= 100; d += 25) {
        ctx.beginPath();
        ctx.moveTo(mL, y(d));
        ctx.lineTo(W - mR, y(d));
        ctx.stroke();
        ctx.fillText(d + 'm', 4, y(d) + 3);
      }
      for (let t = 0; t <= t1; t += 1200) {
        if (t < t0) continue;
        // Anchor the end ticks inward so their labels stay inside the plot.
        ctx.textAlign = t + 1200 > t1 ? 'right' : t === 0 ? 'left' : 'center';
        const px = t + 1200 > t1 ? Math.min(x(t), W - mR) : t === 0 ? Math.max(x(t), mL) : x(t);
        ctx.fillText(Math.round(t / 60) + 'min', px, H - 8);
      }
      ctx.textAlign = 'left';

      const line = (pts, dt, color, width) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        pts.forEach((p, i) => {
          const px = x(p[0] + dt);
          const py = y(p[1]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      };
      line(g, 0, ink, 1.2);
      line(s, lag, accent, 1.2);

      ctx.fillStyle = ink;
      ctx.fillText('garmin (UTC)', W - mR - 150, 14);
      ctx.fillStyle = accent;
      ctx.fillText('shearwater (+lag)', W - mR - 150, 26);
    }

    function drawCurve(lag) {
      const ctx = sizeCanvas(nccCanvas, 110);
      const W = nccCanvas.clientWidth;
      const H = 110;
      const ink = css('--ink', '#18120c');
      const accent = css('--accent', '#cc3a1d');
      const faint = 'color-mix(in srgb, ' + ink + ' 25%, transparent)';

      const mL = 40;
      const mR = 8;
      const mT = 8;
      const mB = 22;
      let lo = 1;
      curve.forEach((p) => {
        if (p[1] < lo) lo = p[1];
      });
      lo = Math.min(lo, 0.94);
      const x = (l) => mL + ((l - LAG_MIN) / (LAG_MAX - LAG_MIN)) * (W - mL - mR);
      const y = (v) => mT + ((1 - v) / (1 - lo)) * (H - mT - mB);

      ctx.clearRect(0, 0, W, H);
      ctx.font = '10px monospace';
      ctx.strokeStyle = faint;
      ctx.fillStyle = faint;
      ctx.lineWidth = 1;

      [1, 0.95].forEach((v) => {
        ctx.beginPath();
        ctx.moveTo(mL, y(v));
        ctx.lineTo(W - mR, y(v));
        ctx.stroke();
        ctx.fillText(v.toFixed(2), 4, y(v) + 3);
      });
      [-120, -60, 0, 60, 120].forEach((l) => {
        ctx.textAlign = l === LAG_MAX ? 'right' : l === LAG_MIN ? 'left' : 'center';
        const px = l === LAG_MAX ? W - mR : l === LAG_MIN ? mL : x(l);
        ctx.fillText((l > 0 ? '+' : '') + l + 's', px, H - 6);
      });
      ctx.textAlign = 'left';

      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      curve.forEach((p, i) => {
        if (i === 0) ctx.moveTo(x(p[0]), y(p[1]));
        else ctx.lineTo(x(p[0]), y(p[1]));
      });
      ctx.stroke();

      const v = nccAtLag(lag);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x(lag), y(v), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText('NCC', W - mR - 30, 14);
    }

    function update() {
      if (!document.body.contains(root)) {
        // This widget's DOM was swapped away by a navigation; unhook.
        window.removeEventListener('resize', update);
        return;
      }
      const lag = Number(slider.value);
      const v = nccAtLag(lag);
      lagOut.textContent = (lag > 0 ? '+' : '') + lag + ' s';
      nccOut.textContent = v.toFixed(5);
      drawProfiles(lag);
      drawCurve(lag);
    }

    fetch('/posts/matching-two-dive-computers/pair.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((data) => {
        g = data.garmin;
        s = data.shearwater;
        for (let l = LAG_MIN; l <= LAG_MAX; l += LAG_STEP) curve.push([l, nccAtLag(l)]);
        root.hidden = false;
        slider.addEventListener('input', update);
        window.addEventListener('resize', update);
        update();
      })
      .catch(() => {
        root.hidden = true;
      });
  }

  init();
  document.addEventListener('astro:page-load', init);
})();
