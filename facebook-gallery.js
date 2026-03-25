class FacebookGallery {
  static id = "facebook-gallery";

  static isMatch() {
    return window.location.href.includes("facebook.com");
  }

  // per docs, init should return an object (often empty)
  static init() {
    return {};
  }

  async *run(ctx) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = (msg) => console.log("[facebook-gallery]", msg);

    // give FB time to render post content
    await sleep(5000);

    // Try to click something that actually opens the viewer:
    // clicking <img> often does nothing; click nearest link-like ancestor
    const img = document.querySelector("div[role='main'] img");
    const clickable = img?.closest("a, div[role='link'], div[role='button']");

    if (clickable) {
      clickable.click();
      log("Opened gallery/lightbox");
      await sleep(3000);
    } else {
      log("No clickable image found");
      return;
    }

    // Advance through images in the lightbox
    for (let i = 0; i < 50; i++) {
      const next =
        document.querySelector("[aria-label='Next photo']") ||
        document.querySelector("[aria-label='Next']");

      if (!next) {
        log("No more images at step: " + i);
        break;
      }

      next.click();
      log("Clicked next: " + (i + 1));
      yield;
      await sleep(2500);
    }

    log("Gallery done");
  }
}
