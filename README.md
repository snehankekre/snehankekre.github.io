# snehankekre.github.io

Personal site for Snehan Kekre — about, experience, portfolio, résumé, and diving.
Built with [Astro](https://astro.build) + [AstroWind](https://github.com/onwidget/astrowind),
deployed to GitHub Pages.

## Local development

Requires **Node ≥ 22.12** (see `.nvmrc`).

```bash
nvm use            # picks up Node 22 from .nvmrc
npm install
npm run dev        # http://localhost:4321
npm run build      # static output -> dist/
npm run preview    # serve the built site
```

## Editing content

Almost everything lives in **`src/pages/index.astro`** (single-page site with
anchored sections: About, Experience, Portfolio, Diving). Site name / SEO is in
`src/config.yaml`; header + footer links in `src/navigation.ts`.

### Swap in your own images
The hero/about/portfolio/diving images are Unsplash placeholders. Replace the
`src` URLs in `src/pages/index.astro`, or drop local files into
`src/assets/` and import them. The **diving gallery** is the grid in the
`#diving` section — replace those six `<img>` URLs with your own photos and
update the `alt` text. Swap the About image for a real headshot.

## Résumé

The résumé is generated from **`Snehan_Kekre_CV.yaml`** with
[rendercv](https://docs.rendercv.com), then served from `public/`:

```bash
pipx install "rendercv[full]"            # one-time
rendercv render Snehan_Kekre_CV.yaml      # writes rendercv_output/
cp rendercv_output/Snehan_Kekre_CV.pdf public/Snehan_Kekre_CV.pdf
```

`rendercv_output/` is git-ignored; only the PDF in `public/` is committed.

## Deploying to GitHub Pages

1. Create a GitHub repo named **`snehankekre.github.io`** (a user site, so it
   serves at the domain root).
2. Push this project to its `main` branch.
3. In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` builds with Astro (Node 22) and
   deploys on every push to `main`. Site goes live at
   `https://snehankekre.github.io`.

### Custom domain (optional)
Add a `public/CNAME` file containing your domain (e.g. `snehankekre.com`), set the
DNS records at your registrar, and update `site` in `src/config.yaml`.
