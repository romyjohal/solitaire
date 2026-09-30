# Solitaire

Klondike solitaire built with React + Vite, deployed to GitHub Pages.

**Play:** https://romyjohal.github.io/solitaire/

## Features

- Draw 1 or Draw 3
- Drag and drop (mouse and touch), or tap a card to send it to the best spot
- Unlimited undo (Ctrl/Cmd+Z), move counter and timer
- Auto-complete once every card is revealed
- Game is saved in the browser, so a reload picks up where you left off

## Development

```sh
npm install
npm run dev     # local dev server
npm test        # rules unit tests
npm run build   # production build in dist/
```

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.
One-time setup: in the repo go to **Settings → Pages** and set **Source** to **GitHub Actions**.
