// Puppeteer's own downloaded Chrome for Testing is a desktop build dynamically linked against
// system libraries (libnspr4.so, libnss3.so, ...) that plain Node build images don't ship — it
// launches fine locally and on CI images with a full desktop lib set, but fails on Vercel's build
// machine with "error while loading shared libraries: libnspr4.so: cannot open shared object
// file". @sparticuz/chromium ships a statically-linked Chromium built specifically for
// serverless/build environments, so on Vercel we drive that through puppeteer-core instead;
// everywhere else the regular puppeteer launch (used for years, known to work) is unchanged.
export async function launchBrowser() {
  if (!process.env.VERCEL) {
    const {default: puppeteer} = await import("puppeteer");
    return puppeteer.launch({args: ["--no-sandbox", "--disable-setuid-sandbox"]});
  }
  const [{default: puppeteerCore}, {default: chromium}] = await Promise.all([
    import("puppeteer-core"),
    import("@sparticuz/chromium"),
  ]);
  return puppeteerCore.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}
