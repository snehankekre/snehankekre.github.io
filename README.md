# snehankekre.com

My personal site — about, experience, portfolio, résumé, and diving.
Astro + Tailwind, deployed to GitHub Pages, live at https://snehankekre.com.

## Develop

Needs Node ≥ 22.12 (`.nvmrc`).

```bash
nvm use
npm install
npm run dev      # localhost:4321
npm run build    # static output -> dist/
```

Content lives in `src/pages/index.astro`. Push to `main` to deploy.

## Résumé

Generated from `Snehan_Kekre_CV.yaml` and served from `public/`:

```bash
pipx install "rendercv[full]"
rendercv render Snehan_Kekre_CV.yaml
cp rendercv_output/Snehan_Kekre_CV.pdf public/Snehan_Kekre_CV.pdf
```

---

Built on [AstroWind](https://github.com/onwidget/astrowind) (MIT, © onWidget) — see `LICENSE.md`.
