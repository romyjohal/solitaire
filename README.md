# Solitaire

Klondike solitaire built with React + Vite, deployed to GitHub Pages.

**Play:** https://romyjohal.github.io/solitaire/

## Features

Styled after the Windows 95 original: teal desktop, grey bevelled window with a
Game/Help menu bar and status bar, green felt and the classic 71×96 cards.

- Draw One or Draw Three, chosen under **Game → Options...**
- Windows "Standard" scoring with a time penalty and a time bonus when you win
- Six card backs under **Game → Deck...**
- The bouncing-cards cascade when you win, then "Deal again?"
- Drag and drop (mouse and touch), or click a card to send it to the best spot
- Right-click the table to play every available card to the foundations
- Undo (Ctrl/Cmd+Z), deal a new game with F2
- The game is saved in the browser, so a reload picks up where you left off

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
