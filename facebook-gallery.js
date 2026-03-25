class FacebookGallery {
  static id = "facebook-gallery";

  static isMatch() {
    const u = location.href;
    return u.includes("facebook.com/") && (u.includes("/posts/") || u.includes("/pfbid"));
  }

  static init() {
    return {};
  }

  async *run(ctx) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = (msg) => console.log("[facebook-gallery]", msg);

    // Helper: click first element that exists
    const clickFirst = (...selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.click();
          return true;
        }
      }
      return false;
    };

    // Helper: try to close common overlays (best-effort)
    const dismissOverlays = async () => {
      // Cookie/login/“not now” style dialogs vary; try common buttons by text
      const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
      const buttons = Array.from(document.querySelectorAll("button,[role='button']"));
      for (const b of buttons) {
        const t = norm(b.textContent);
        if (
          t.includes("accept") ||
          t.includes("allow") ||
          t.includes("agree") ||
          t.includes("not now") ||
          t.includes("close") ||
          t.includes("ok")
        ) {
          try { b.click(); log("Clicked overlay button: " + t); } catch {}
          await sleep(1500);
          return;
        }
      }
    };

    // Wait for main content to render
    for (let i = 0; i < 20; i++) {
      if (document.querySelector("div[role='main']")) break;
      yield; await sleep(500);
    }

    // Try dismiss overlays a couple times (if present)
    for (let i = 0; i < 3; i++) {
      await dismissOverlays();
      yield; await sleep(800);
    }

    // Find a likely post image within the main area
    // Strategy:
    // 1) find an img
    // 2) click a clickable ancestor (a / role=link / role=button)
    const main = document.querySelector("div[role='main']");
    if (!main) {
      log("No main content found");
      return;
    }

    const img = main.querySelector("img");
    if (!img) {
      log("No image found in post");
      return;
    }

    const clickable =
      img.closest("a") ||
      img.closest("div[role='link']") ||
      img.closest("div[role='button']");

    if (!clickable) {
      log("Found img but no clickable ancestor");
      return;
    }

    clickable.click();
    log("Clicked post image to open viewer");
    await sleep(3000);

    // Now we should be in the viewer/lightbox. Click next up to N times.
    // FB uses different aria-labels; try several.
    const nextSelectors = [
      "[aria-label='Next photo']",
      "[aria-label='Next']",
      "[aria-label='Next image']",
      "[aria-label='Next item']",
      "div[role='button'][aria-label='Next photo']",
    ];

    for (let i = 0; i < 30; i++) {
      // Give viewer time to load
      yield; await sleep(1200);

      const next = nextSelectors.map((s) => document.querySelector(s)).find(Boolean);
      if (!next) {
        log("No next button found; stopping at step " + i);
        break;
      }
      next.click();
      log("Clicked next: " + (i + 1));
      yield; await sleep(2000);
    }

    log("Done");
  }
}
