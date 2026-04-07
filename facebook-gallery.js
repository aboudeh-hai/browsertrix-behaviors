class FacebookGallery {
  static id = "Facebook";

  static isMatch() {
    const u = location.href;
    return u.includes("facebook.com/") && (u.includes("/posts/") || u.includes("/pfbid"));
  }

  static init() { return {}; }

  async *run(ctx) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = (msg) => {
      console.log("[facebook-gallery]", msg);
      if (window.__bx_log) window.__bx_log("[facebook-gallery] " + msg);
    };

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
        (i) => (i.width > 100 || i.naturalWidth > 100) &&
               (i.height > 100 || i.naturalHeight > 100)
      );
      return imgs.length > 0 ? imgs[0].src : null;
    };

    const findNextButton = () => {
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

      const dialog = document.querySelector("div[role='dialog']");
      if (!dialog) return null;
      const buttons = [...dialog.querySelectorAll("div[role='button'], a[role='button']")];
      const midX = window.innerWidth / 2;
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        if (rect.left > midX && rect.width < 200 && rect.height > 30 &&
            rect.top > window.innerHeight * 0.2 && rect.bottom < window.innerHeight * 0.8) {
          if (btn.querySelector("svg, i, img") || btn.textContent.trim().length === 0) {
            return btn;
          }
        }
      }
      return null;
    };

    // --- Main flow ---

    log("Starting facebook-gallery behavior");

    // 1. Wait for main content
    log("Waiting for main content...");
    const main = await waitFor(() => document.querySelector("div[role='main']"), 15000);
    if (!main) { log("No main content found, aborting"); return; }
    log("Main content found");
    yield;

    // 2. Dismiss overlays
    for (let i = 0; i < 3; i++) {
      const dismissed = await dismissOverlays();
      yield;
      if (!dismissed) break;
    }

    // 3. Find a gallery image — use rendered width/height, not naturalWidth
    log("Looking for images in post...");
    await sleep(2000); // give images time to render

    let imgs = [...main.querySelectorAll("img")].filter((i) => {
      const w = i.width || i.offsetWidth || i.naturalWidth || 0;
      const h = i.height || i.offsetHeight || i.naturalHeight || 0;
      const src = i.src || "";
      return w > 100 && h > 100 &&
        !src.includes("emoji") &&
        !src.includes("rsrc.php") &&
        !i.closest("[aria-label*='rofile']");
    });

    log("Found " + imgs.length + " candidate images");

    if (imgs.length === 0) {
      // Fallback: try any img with a scontent URL (Facebook CDN)
      log("Trying fallback: scontent images...");
      imgs = [...main.querySelectorAll("img")].filter(
        (i) => (i.src || "").includes("scontent")
      );
      log("Fallback found " + imgs.length + " scontent images");
    }

    if (imgs.length === 0) {
      log("No gallery images found, dumping all img srcs for debug:");
      [...main.querySelectorAll("img")].forEach((i, idx) => {
        log(`  img[${idx}]: ${i.width}x${i.height} nat=${i.naturalWidth}x${i.naturalHeight} src=${(i.src || "").substring(0, 80)}`);
      });
      return;
    }

    const img = imgs[0];
    log("Selected image: " + (img.src || "").substring(0, 80));
    img.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(800);

    // 4. Click to open viewer
    const clickable =
      img.closest("a[href]") ||
      img.closest("div[role='link']") ||
      img.closest("div[role='button']") ||
      img.parentElement;

    if (!clickable) { log("No clickable ancestor for image"); return; }

    log("Clicking image to open viewer...");
    clickable.click();
    yield;

    // 5. Wait for lightbox dialog
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
    log("Initial image src: " + (initialSrc || "none").substring(0, 80));

    for (let i = 0; i < 50; i++) {
      await sleep(500);

      const nextBtn = findNextButton();
      if (!nextBtn) { log("No next button found; end of gallery at step " + i); break; }

      const prevSrc = getCurrentImageSrc();
      nextBtn.click();
      log("Clicked next: " + (i + 1));

      const changed = await waitFor(() => {
        const curr = getCurrentImageSrc();
        return curr && curr !== prevSrc ? curr : null;
      }, 6000);

      if (!changed) { log("Image did not change after click; stopping"); break; }

      if (seen.has(changed)) { log("Carousel wrapped at step " + (i + 1)); break; }
      seen.add(changed);
      log("New image loaded: " + changed.substring(0, 80));

      if (dialog.querySelector("video")) {
        log("Video detected, waiting for buffer...");
        await sleep(4000);
      }

      yield;
    }

    log("Done — captured " + seen.size + " unique items");
  }
}
