class FacebookGallery {
  static id = "facebook-gallery";

  static isMatch() {
    const u = location.href;
    return u.includes("facebook.com/") && (u.includes("/posts/") || u.includes("/pfbid"));
  }

  static init() { return {}; }

  async *run(ctx) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = (msg) => console.log("[facebook-gallery]", msg);

    const waitFor = async (predicate, timeout = 10000, interval = 300) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const result = predicate();
        if (result) return result;
        await sleep(interval);
      }
      return null;
    };

    const dismissOverlays = async () => {
      const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
      const buttons = Array.from(document.querySelectorAll("button,[role='button']"));
      for (const b of buttons) {
        const t = norm(b.textContent);
        if (t.includes("accept") || t.includes("allow") || t.includes("agree") ||
            t.includes("not now") || t.includes("close") || t.includes("ok") ||
            t.includes("decline") || t.includes("dismiss")) {
          try { b.click(); log("Dismissed overlay: " + t); } catch {}
          await sleep(1500);
          return true;
        }
      }
      return false;
    };

    const getCurrentImageSrc = () => {
      const dialog = document.querySelector("div[role='dialog']");
      if (!dialog) return null;
      const imgs = [...dialog.querySelectorAll("img")].filter(
        (i) => i.naturalWidth > 200 && i.naturalHeight > 200
      );
      return imgs.length > 0 ? imgs[0].src : null;
    };

    const findNextButton = () => {
      // Try aria-labels in multiple languages
      const labels = [
        "Next photo", "Next", "Next image", "Next item",
        "Foto siguiente", "Siguiente", "Photo suivante", "Suivant",
        "Nächstes Foto", "Weiter", "الصورة التالية", "التالي",
      ];
      for (const label of labels) {
        const btn = document.querySelector(
          `[aria-label='${label}'][role='button'], a[aria-label='${label}']`
        );
        if (btn) return btn;
      }

      // Fallback: find right-side navigation button by position in the dialog
      const dialog = document.querySelector("div[role='dialog']");
      if (!dialog) return null;
      const buttons = [...dialog.querySelectorAll("div[role='button'], a[role='button']")];
      const midX = window.innerWidth / 2;
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        // Right-side button, vertically centered, narrow (nav arrow shape)
        if (rect.left > midX && rect.width < 200 && rect.height > 30 &&
            rect.top > window.innerHeight * 0.2 && rect.bottom < window.innerHeight * 0.8) {
          // Confirm it contains an SVG or small icon, not a text button
          if (btn.querySelector("svg, i, img") || btn.textContent.trim().length === 0) {
            return btn;
          }
        }
      }
      return null;
    };

    // --- Main flow ---

    // 1. Wait for main content
    log("Waiting for main content...");
    const main = await waitFor(() => document.querySelector("div[role='main']"), 15000);
    if (!main) { log("No main content found, aborting"); return; }
    yield;

    // 2. Dismiss overlays (stop early if nothing found)
    for (let i = 0; i < 3; i++) {
      const dismissed = await dismissOverlays();
      yield;
      if (!dismissed) break;
    }

    // 3. Find a gallery image (filter out tiny icons/avatars)
    const imgs = [...main.querySelectorAll("img")].filter(
      (i) => i.naturalWidth > 150 && i.naturalHeight > 150
    );
    if (imgs.length === 0) { log("No gallery-sized image found in post"); return; }

    const img = imgs[0];
    img.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(800);

    // 4. Click to open viewer
    const clickable =
      img.closest("a[href]") ||
      img.closest("div[role='link']") ||
      img.closest("div[role='button']") ||
      img.parentElement;

    if (!clickable) { log("No clickable ancestor for image"); return; }

    clickable.click();
    log("Clicked image to open viewer");
    yield;

    // 5. Wait for lightbox dialog to appear
    const dialog = await waitFor(
      () => document.querySelector("div[role='dialog']"),
      8000
    );
    if (!dialog) { log("Lightbox dialog never appeared"); return; }
    log("Lightbox opened");
    yield;

    // 6. Cycle through gallery
    const seen = new Set();
    const initialSrc = getCurrentImageSrc();
    if (initialSrc) seen.add(initialSrc);

    for (let i = 0; i < 50; i++) {
      await sleep(500);

      const nextBtn = findNextButton();
      if (!nextBtn) { log("No next button found; end of gallery at step " + i); break; }

      const prevSrc = getCurrentImageSrc();
      nextBtn.click();
      log("Clicked next: " + (i + 1));

      // Wait for image to actually change
      const changed = await waitFor(() => {
        const curr = getCurrentImageSrc();
        return curr && curr !== prevSrc ? curr : null;
      }, 6000);

      if (!changed) { log("Image did not change after click; stopping"); break; }

      // Detect wrap-around
      if (seen.has(changed)) { log("Carousel wrapped at step " + (i + 1)); break; }
      seen.add(changed);

      // If it's a video slide, give extra time for buffering
      if (dialog.querySelector("video")) {
        log("Video detected, waiting for buffer...");
        await sleep(4000);
      }

      yield;
    }

    log("Done — captured " + seen.size + " unique items");
  }
}
