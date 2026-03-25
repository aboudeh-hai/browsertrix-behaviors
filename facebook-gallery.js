export class FacebookGallery {
  static id = "facebook-gallery";

  static isMatch() {
    return location.href.includes("facebook.com");
  }

  static init() {
    return new FacebookGallery();
  }

  async *run(ctx) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const log = msg => console.log("[facebook-gallery]", msg);

    await sleep(5000);

    const firstImg = document.querySelector("div[role='main'] img");

    if (firstImg) {
      firstImg.click();
      log("Opened gallery");
      await sleep(3000);
    } else {
      log("No image found");
    }

    for (let i = 0; i < 50; i++) {
      const next = document.querySelector(
        "[aria-label='Next photo'], [aria-label='Next']"
      );

      if (!next) {
        log("No more images at: " + i);
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
