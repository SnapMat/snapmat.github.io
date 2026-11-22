(function () {
  "use strict";
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function viewRect(iw, ih, width, height, zoom, center) {
    const scale = zoom === "fit" ? Math.min(width / iw, height / ih) : Number(zoom);
    const x = iw * scale <= width ? (width - iw * scale) / 2 : clamp(width / 2 - center.x * iw * scale, width - iw * scale, 0);
    const y = ih * scale <= height ? (height - ih * scale) / 2 : clamp(height / 2 - center.y * ih * scale, height - ih * scale, 0);
    return { x, y, width: iw * scale, height: ih * scale, scale };
  }
  function clock(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function videoContract(items, clip) {
    const valid = items.filter(v => Number.isFinite(v.duration) && v.duration > 0);
    if (!valid.length) return { ok: false, duration: 0, message: "等待视频素材。" };
    if (valid.some(v => v.videoWidth !== clip.width || v.videoHeight !== clip.height))
      return { ok: false, duration: 0, message: "视频尺寸与 content.js 不一致，请统一尺寸后重试。" };
    const durations = valid.map(v => v.duration);
    if (Math.max(...durations) - Math.min(...durations) > 1 / clip.fps + 0.005)
      return { ok: false, duration: 0, message: "视频时长不一致，已暂停同步播放。请使用同一帧范围与 FPS。" };
    return { ok: true, duration: Math.min(...durations), message: "" };
  }
  const core = { clamp, viewRect, clock, videoContract };
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  if (typeof document === "undefined") return;
  window.MattingCore = core;

  const $ = id => document.getElementById(id);
  const data = window.PROJECT_CONTENT;
  const icons = () => { if (window.lucide) window.lucide.createIcons(); };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const safeURL = value => {
    if (!value) return "";
    const url = new URL(value, document.baseURI);
    if (!["https:", "http:", "file:", "blob:"].includes(url.protocol)) throw new Error("Unsupported URL");
    return url.href;
  };
  $("project-title").querySelector("img").alt = data.title;
  document.title = `${data.title} · 项目展示`;
  $("project-subtitle").textContent = data.subtitle;
  $("authors").replaceChildren(...data.authors.split(" · ").map(author => {
    const marker = author.match(/[*†]+$/)?.[0] || "";
    const name = el("span", "author-name", marker ? author.slice(0, -marker.length) : author);
    if (marker) name.append(el("sup", "", marker));
    return name;
  }));
  $("author-notes").textContent = data.authorNotes;
  for (const [id, value] of [["affiliations", data.affiliations], ["venue", data.venue]]) {
    if ($(id) && value) $(id).textContent = value;
  }
  const abstractParts = data.abstract.split(/\b(SnapMat|DICE|SHARP|REALM|21\.76 frames per second \(FPS\)|2\.11 GB)(?!\w)/g);
  $("abstract-text").replaceChildren(...abstractParts.map((part, index) => index % 2 === 0
    ? document.createTextNode(part)
    : el("strong", part === "SnapMat" ? "abstract-brand" : "", part)));
  $("project-links").replaceChildren();
  for (const [key, label, icon] of [["github", "GitHub", "github"], ["arxiv", "arXiv", "file-text"], ["code", "Code", "code-xml"]]) {
    const href = safeURL(data.links[key]);
    const node = el(href ? "a" : "span", "resource-link");
    const glyph = el("i"); glyph.dataset.lucide = icon;
    node.append(glyph, document.createTextNode(label));
    if (!href) node.append(el("small", "", "Coming soon"));
    if (key === "github") { node.title = "Author's GitHub profile"; node.setAttribute("aria-label", node.title); }
    if (href) { node.href = href; if (!data.links[key].startsWith("#")) { node.target = "_blank"; node.rel = "noopener noreferrer"; } }
    else { node.setAttribute("role", "link"); node.setAttribute("aria-disabled", "true"); }
    $("project-links").append(node);
  }

  if (data.methodFigure) {
    const link = $("method-figure").querySelector("a");
    link.href = safeURL(data.methodFigure);
    link.querySelector("img").src = link.href;
  }
  const citation = $("citation-entry"), copy = $("citation-copy");
  if (citation && copy) {
    citation.textContent = data.citation;
    let reset;
    copy.addEventListener("click", async () => {
      let copied = false;
      try {
        await navigator.clipboard.writeText(citation.textContent);
        copied = true;
      } catch {
        const range = document.createRange(), selection = window.getSelection();
        range.selectNodeContents(citation);
        selection.removeAllRanges();
        selection.addRange(range);
        copied = document.execCommand("copy");
        if (copied) selection.removeAllRanges();
      }
      clearTimeout(reset);
      copy.textContent = copied ? "Copied" : "Selected";
      $("citation-status").textContent = copied ? "BibTeX copied." : "Citation selected. Use your device's copy command.";
      reset = setTimeout(() => { copy.textContent = "Copy"; $("citation-status").textContent = ""; }, 2200);
    });
  }
  icons();
})();
