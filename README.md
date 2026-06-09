# Folder Reader

Read all notes in a folder together — one continuous, scrolling view.

Right-click any folder and choose **Read notes together**: every Markdown note
directly inside that folder is rendered one after another in a single tab, in
name order, like one long document. Perfect for journals, chat archives,
meeting notes, book chapters, or any folder you want to *read* rather than
click through file by file.

## Features

- **Folder context menu** — right-click a folder → **Read notes together**.
- **Command palette** — *Read current note's folder together* opens the view
  for the active note's parent folder.
- **One continuous page** — notes are rendered sequentially with their titles
  as section headers, sorted by file name (numeric-aware, so
  `2024-01-02` < `2024-01-10` < `2024-02-01` reads chronologically).
- **Fast on huge folders** — notes render lazily in batches of 15 as you
  scroll (via `IntersectionObserver`), so a folder with hundreds of notes
  opens instantly.
- **Fully interactive** — each note title is clickable and opens the original
  file (Ctrl/Cmd-click for a new tab). Wikilinks, embeds, images, and tags
  inside rendered notes work normally.
- **Refresh button** in the tab header re-reads the folder.
- **Zero overhead** — no network calls, no settings, no data files. Plain
  JavaScript, no build step, works on desktop and mobile.

## Usage

1. Right-click a folder in the file explorer.
2. Choose **Read notes together**.
3. Scroll. That's it.

Notes:

- Only `.md` files **directly inside** the folder are included. Subfolders are
  not recursed — open them separately.
- Frontmatter is hidden from the rendered output.
- The view restores itself across app restarts (the folder path is saved in
  the workspace layout).

## Installation

### Community plugins (recommended)

Search for **Folder Reader** in *Settings → Community plugins → Browse* and
install it. *(Pending directory approval.)*

### BRAT

Add `jagajaga/obsidian-folder-reader` in
[BRAT](https://github.com/TfTHacker/obsidian42-brat).

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the
   [latest release](https://github.com/jagajaga/obsidian-folder-reader/releases/latest).
2. Copy them to `<your-vault>/.obsidian/plugins/folder-reader/`.
3. Reload Obsidian and enable **Folder Reader** in
   *Settings → Community plugins*.

## How it works

The plugin registers a custom view type. When you open it for a folder, it
lists the folder's direct Markdown children, sorts them by name, and renders
each with Obsidian's built-in `MarkdownRenderer` — the same engine used by
reading view, so themes and CSS snippets apply automatically. Rendering is
chunked behind an `IntersectionObserver` sentinel so only what you scroll to
is processed.

There are no network requests, no telemetry, and nothing is written anywhere.

## Development

The plugin is intentionally dependency-free: `main.js` is plain JavaScript
loaded directly by Obsidian — there is no bundler and no build step.

```bash
git clone https://github.com/jagajaga/obsidian-folder-reader
cd obsidian-folder-reader
# edit main.js / styles.css
cp main.js manifest.json styles.css <your-vault>/.obsidian/plugins/folder-reader/
# reload Obsidian
```

Releases are automated: pushing a tag that matches the version in
`manifest.json` (e.g. `1.0.1`, no `v` prefix) builds a GitHub release with
`main.js`, `manifest.json`, and `styles.css` attached.

## Related

If you also want to *publish* folders of notes to the web with private,
unguessable URLs, see
[Private Quartz Publish](https://github.com/jagajaga/private-quartz-publish).

## License

[MIT](LICENSE) © Arseniy Seroka
