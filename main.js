/*
 * Folder Reader — Obsidian plugin.
 *
 * Folder context menu (right-click a folder):
 *   - "Read notes together" — opens a tab rendering every direct .md child
 *     of the folder one after another, in name order, as one continuous page.
 *
 * Command palette:
 *   - "Read current note's folder together" — same view for the active
 *     note's parent folder.
 *
 * Notes render in batches as you scroll (IntersectionObserver), so large
 * folders (e.g. Telegram archives) stay fast. Each note's title is a link
 * that opens the original file. Internal wikilinks inside rendered notes
 * navigate normally.
 *
 * No network calls, no settings, no data file.
 */

const {
  Plugin,
  ItemView,
  TFile,
  TFolder,
  Notice,
  MarkdownRenderer,
} = require("obsidian");

const VIEW_TYPE = "folder-reader-view";
const BATCH_SIZE = 15;
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

function stripFrontmatter(markdown) {
  return markdown.startsWith("---")
    ? markdown.replace(FRONTMATTER_RE, "")
    : markdown;
}

function sortByName(files) {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

class FolderReaderView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.folderPath = "";
    this.queue = [];
    this.generation = 0;
    this.isRenderingBatch = false;
    this.observer = null;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    if (!this.folderPath) return "Folder reader";
    const name = this.folderPath.split("/").pop();
    return `Reading: ${name}`;
  }

  getIcon() {
    return "book-open";
  }

  getState() {
    return { folderPath: this.folderPath };
  }

  async setState(state, result) {
    this.folderPath = (state && state.folderPath) || "";
    await super.setState(state, result);
    await this.renderFolder();
  }

  async onOpen() {
    this.addAction("refresh-cw", "Refresh", () => this.renderFolder());
  }

  async onClose() {
    this.disconnectObserver();
  }

  disconnectObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  async renderFolder() {
    const generation = ++this.generation;
    this.disconnectObserver();
    this.isRenderingBatch = false;

    const container = this.contentEl;
    container.empty();
    container.addClass("folder-reader");

    if (!this.folderPath) {
      container.createEl("p", { text: "No folder selected." });
      return;
    }

    const folder = this.app.vault.getAbstractFileByPath(this.folderPath);
    if (!(folder instanceof TFolder)) {
      container.createEl("p", { text: `Folder not found: ${this.folderPath}` });
      return;
    }

    const files = sortByName(
      folder.children.filter(
        (c) => c instanceof TFile && c.extension === "md",
      ),
    );

    const header = container.createDiv({ cls: "folder-reader-header" });
    header.createEl("h1", { text: folder.name });
    header.createEl("div", {
      cls: "folder-reader-count",
      text:
        files.length === 1 ? "1 note" : `${files.length} notes`,
    });

    if (files.length === 0) {
      container.createEl("p", {
        text: "No notes directly in this folder. (Subfolders are not included.)",
      });
      return;
    }

    this.queue = files;
    const list = container.createDiv({ cls: "folder-reader-list" });
    const sentinel = container.createDiv({ cls: "folder-reader-sentinel" });
    sentinel.createEl("span", { text: "…" });

    await this.renderBatch(list, sentinel, generation);

    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        this.renderBatch(list, sentinel, generation);
      }
    });
    this.observer.observe(sentinel);
  }

  async renderBatch(list, sentinel, generation) {
    if (this.isRenderingBatch || generation !== this.generation) return;
    this.isRenderingBatch = true;
    try {
      const batch = this.queue.slice(0, BATCH_SIZE);
      this.queue = this.queue.slice(BATCH_SIZE);
      for (const file of batch) {
        if (generation !== this.generation) return;
        await this.renderNote(list, file);
      }
      if (this.queue.length === 0) {
        sentinel.empty();
        this.disconnectObserver();
      }
    } finally {
      this.isRenderingBatch = false;
    }
  }

  async renderNote(list, file) {
    const section = list.createDiv({ cls: "folder-reader-note" });

    const title = section.createEl("h2", {
      cls: "folder-reader-title",
      text: file.basename,
    });
    title.setAttribute("title", "Open note");
    title.addEventListener("click", (evt) => {
      const inNewTab = evt.ctrlKey || evt.metaKey;
      this.app.workspace.getLeaf(inNewTab ? "tab" : false).openFile(file);
    });

    const body = section.createDiv({ cls: "folder-reader-body" });
    let markdown;
    try {
      markdown = await this.app.vault.cachedRead(file);
    } catch (err) {
      body.createEl("p", { text: `Could not read ${file.path}: ${err}` });
      return;
    }

    await MarkdownRenderer.render(
      this.app,
      stripFrontmatter(markdown),
      body,
      file.path,
      this,
    );

    // Make internal wikilinks navigate.
    body.addEventListener("click", (evt) => {
      const link = evt.target.closest("a.internal-link");
      if (!link) return;
      evt.preventDefault();
      const href = link.getAttribute("data-href") || link.getAttribute("href");
      if (href) {
        this.app.workspace.openLinkText(
          href,
          file.path,
          evt.ctrlKey || evt.metaKey,
        );
      }
    });
  }
}

class FolderReader extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new FolderReaderView(leaf, this));

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, target) => {
        if (!(target instanceof TFolder)) return;
        menu.addItem((item) => {
          item
            .setTitle("Read notes together")
            .setIcon("book-open")
            .onClick(() => this.openReader(target));
        });
      }),
    );

    this.addCommand({
      id: "read-current-folder",
      name: "Read current note's folder together",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const folder = file ? file.parent : null;
        if (!(folder instanceof TFolder)) return false;
        if (!checking) this.openReader(folder);
        return true;
      },
    });
  }

  onunload() {
    // Obsidian detaches registered views automatically on unload.
  }

  async openReader(folder) {
    const mdCount = folder.children.filter(
      (c) => c instanceof TFile && c.extension === "md",
    ).length;
    if (mdCount === 0) {
      new Notice(`No notes directly in "${folder.name}".`);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: VIEW_TYPE,
      active: true,
      state: { folderPath: folder.path },
    });
    this.app.workspace.revealLeaf(leaf);
  }
}

module.exports = FolderReader;
