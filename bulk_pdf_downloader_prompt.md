# Bulk PDF Downloader — Instructions for Claude

## What to do

Your task is to bulk-download all PDFs from a website by injecting a JavaScript downloader into the browser. Follow the steps below exactly.

---

## The websites to download from

> [USER: LIST YOUR TARGET WEBSITES HERE]
> e.g. https://www.someagency.org/publications

For each website, you need to know (or find):
1. The URL pattern for paginated listing pages (e.g. `/publications?page=0`, `/publications?page=1`, etc.)
2. The URL pattern for individual publication pages (e.g. `/publications/some-report-title`)
3. Where the PDF link appears on each publication page (inspect the download button)

---

## Step-by-step process

### Step 1 — Open the browser tab
Navigate to the website's publications listing page.

### Step 2 — Inspect the site structure
Before running anything, check:
- How many pages of listings are there? (look at the pagination at the bottom)
- What does a link to an individual publication look like? (right-click a title → Inspect)
- What does the PDF download link look like? (right-click the download button → Inspect, look for an `href` ending in `.pdf`)

### Step 3 — Set Chrome's download folder
Go to Chrome Settings → Downloads → change Location to the folder where you want the PDFs saved. Turn OFF "Ask where to save each file before downloading."

### Step 4 — Inject and run the downloader
Open the browser Developer Console (`Cmd+Option+J` on Mac, `F12` on Windows → Console tab), then paste and run the code below after updating the 3 customisable lines.

---

## The downloader code

Paste this into the browser console on the target website. Update the three lines marked `// ← CHANGE THIS`.

```javascript
(async () => {
  // ── CONFIGURATION — update these three things ──────────────────

  // 1. How many listing pages are there? (check the pagination on the site)
  const TOTAL_PAGES = 58; // ← CHANGE THIS

  // 2. Function to get the URL for each listing page
  const listingPageURL = (n) =>
    `https://www.unfpa.org/publications?page=${n}`; // ← CHANGE THIS

  // 3. Base URL of the site (no trailing slash)
  const BASE_URL = 'https://www.unfpa.org'; // ← CHANGE THIS

  // ── END CONFIGURATION ───────────────────────────────────────────

  const delay = ms => new Promise(r => setTimeout(r, ms));
  let done = 0, skipped = 0, errors = 0;

  // ── Inject a status panel ──────────────────────────────────────
  const old = document.getElementById('_dl_panel');
  if (old) old.remove();
  const panel = document.createElement('div');
  panel.id = '_dl_panel';
  panel.style.cssText = 'position:fixed;top:10px;right:10px;width:360px;background:#1a1a1a;color:#fff;border-radius:10px;padding:16px;z-index:999999;font-family:Arial,sans-serif;font-size:13px;border:2px solid #e35205;';
  panel.innerHTML = `
    <b style="color:#e35205">📥 PDF Downloader</b>
    <div id="_dl_status" style="margin-top:8px;line-height:1.8">Starting...</div>
    <div style="background:#333;border-radius:4px;height:8px;margin:8px 0">
      <div id="_dl_bar" style="background:#e35205;height:8px;border-radius:4px;width:0%;transition:width 0.3s"></div>
    </div>
    <div id="_dl_log" style="background:#000;border-radius:4px;padding:8px;height:150px;overflow-y:auto;font-size:11px;margin-top:8px"></div>
  `;
  document.body.appendChild(panel);

  const log = (msg, color) => {
    const el = document.getElementById('_dl_log');
    const d = document.createElement('div');
    d.style.color = color || '#0f0';
    d.textContent = msg;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  };
  const setStatus = (msg) => {
    document.getElementById('_dl_status').textContent = msg;
  };
  const setBar = (pct) => {
    document.getElementById('_dl_bar').style.width = pct + '%';
  };

  // ── Step 1: Collect all publication page URLs ──────────────────
  log('Fetching listing pages...');
  const fetchListing = async (n) => {
    try {
      const html = await fetch(listingPageURL(n)).then(r => r.text());
      // Finds all internal links that look like individual publication pages.
      // If your site uses a different URL pattern, update this regex.
      const matches = [...html.matchAll(/href="(\/[a-z][^"?#]{5,})"/g)];
      return [...new Set(matches.map(m => BASE_URL + m[1]))];
    } catch { return []; }
  };

  const allListingResults = await Promise.all(
    Array.from({ length: TOTAL_PAGES }, (_, i) => fetchListing(i))
  );
  const pubPages = [...new Set(allListingResults.flat())];
  log(`✅ Found ${pubPages.length} publication pages.`, '#0ff');

  // ── Step 2: Visit each page, find the PDF, download it ─────────
  for (let i = 0; i < pubPages.length; i++) {
    setStatus(`Downloading... ${i + 1} / ${pubPages.length} | ✅${done} ⚠️${skipped} ❌${errors}`);
    setBar(Math.round((i + 1) / pubPages.length * 100));

    const url = pubPages[i];
    const slug = url.split('/').pop().substring(0, 50);

    try {
      const html = await fetch(url).then(r => r.text());

      // Finds a .pdf link anywhere in the page HTML.
      // If the PDF link on your site has a different path, update this regex.
      const m = html.match(/href="([^"]+\.pdf)"/);

      if (m) {
        let pdfURL = m[1];
        // Handle relative URLs
        if (pdfURL.startsWith('/')) pdfURL = BASE_URL + pdfURL;

        const a = document.createElement('a');
        a.href = pdfURL;
        a.download = decodeURIComponent(pdfURL.split('/').pop());
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        done++;
        log(`[${i + 1}/${pubPages.length}] ✅ ${slug}`);
      } else {
        skipped++;
        log(`[${i + 1}/${pubPages.length}] ⚠ no PDF found: ${slug}`, '#ff0');
      }
    } catch (e) {
      errors++;
      log(`[${i + 1}/${pubPages.length}] ❌ error: ${slug}`, '#f55');
    }

    await delay(600); // 0.6s pause between downloads — increase if the site is slow
  }

  setStatus(`🎉 Done! ✅ ${done} downloaded  ⚠️ ${skipped} skipped  ❌ ${errors} errors`);
  log(`Complete: ${done} PDFs downloaded.`, '#0ff');
})();
```

---

## How to adapt the regex for a different site

The two regex lines in the code above are the main things to change for a new site.

**Finding publication page links (Step 1):**
The default regex `/href="(\/[a-z][^"?#]{5,})"/g` matches any internal link like `/publications/some-title`. If the site uses a different pattern (e.g. `/resources/documents/report-name`), update it to match.

**Finding PDF links (Step 2):**
The default `href="([^"]+\.pdf)"` finds any link ending in `.pdf`. This works on most sites. If PDFs are loaded dynamically or behind JavaScript, you may need to look at the page source more carefully (right-click the download button on the site → Inspect Element → look for the `.pdf` href).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Downloads not appearing | Check Chrome Settings → Downloads → make sure "Ask where to save" is OFF |
| `0` PDFs found | The PDF links may be rendered by JavaScript — try visiting one publication page manually, right-click the download button, and check the `href` |
| Script stops mid-way | Reload the page, paste the script again — it will restart from the beginning |
| Site returns errors | Increase the `delay(600)` value to `delay(1500)` to slow down requests |
| Links don't match | Open one listing page → right-click a publication title → Inspect → copy the `href` pattern and update the regex |
