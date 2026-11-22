(() => {
  const rail = document.querySelector(".section-index");
  if (!rail) return;
  const list = rail.querySelector("ol"), toggle = rail.querySelector("button");
  const links = Array.from(list.querySelectorAll("a"));
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  let frame = 0, current = -1;

  function sync() {
    frame = 0;
    let index = 0;
    const readingLine = innerHeight * .32;
    for (let i = 1; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top > readingLine) break;
      index = i;
    }
    const last = sections[sections.length-1].getBoundingClientRect();
    if (last.top < innerHeight && last.bottom <= innerHeight + Math.min(80, last.height * .15)) index = links.length - 1;
    if (current === index) return;
    if (current >= 0) links[current].removeAttribute("aria-current");
    links[index].setAttribute("aria-current", "location");
    list.style.setProperty("--step", index);
    current = index;
  }
  const queue = () => { if (!frame) frame = requestAnimationFrame(sync); };
  window.addEventListener("scroll", queue, {passive:true});
  window.addEventListener("resize", queue);
  window.addEventListener("pageshow", queue);
  const watcher = new ResizeObserver(queue);
  sections.forEach(section => watcher.observe(section));

  const close = () => toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => toggle.setAttribute("aria-expanded", String(toggle.getAttribute("aria-expanded") !== "true")));
  links.forEach(link => link.addEventListener("click", close));
  document.addEventListener("pointerdown", event => { if (!rail.contains(event.target)) close(); });
  rail.addEventListener("keydown", event => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      close(); toggle.focus();
    }
  });
  sync();
})();
