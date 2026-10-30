/* Discount Furniture availability inquiry. Presentation only; no stock/cart/API writes. */
(() => {
  "use strict";
  const KEY = "__dfAvailabilityInquiry";
  const VERSION = "2026-10-30.1";
  const ID = "df-availability-contact";
  const STYLE_ID = "df-availability-contact-style";
  const SIDEBAR = ".product-details__sidebar";
  const SOLD_OUT = ".details-product-purchase__sold-out";
  const OPTIONS = ".product-details__product-options";
  const EMAIL = "Sales@discountfurniture-homefurnishings.com";
  const PHONE = "tel:+14023751885";
  const CSS = `#df-availability-contact{box-sizing:border-box;border:1px solid #dce2ea;border-radius:8px;padding:16px;margin:16px 0;background:#fff;color:#001038;font:inherit}
#df-availability-contact .df-availability-contact__heading{font:inherit;font-size:16px;font-weight:600;line-height:1.4;margin:0 0 12px;color:#001038}
#df-availability-contact .df-availability-contact__email{box-sizing:border-box;display:block;border:1px solid #0052da;border-radius:5px;padding:12px;text-align:center;color:#0052da;background:#fff;text-decoration:none;font:inherit;font-weight:600;line-height:1.4}
#df-availability-contact .df-availability-contact__email:hover{background:#f4f8ff}
#df-availability-contact .df-availability-contact__phone{display:block;text-align:center;padding:12px 0 0;color:#001038;text-decoration:underline;text-underline-offset:2px;font:inherit;line-height:1.4}
#df-availability-contact a:focus-visible{outline:3px solid #73a8ff;outline-offset:3px}`;

  if (window[KEY]?.version === VERSION) {
    window[KEY].refresh();
    return;
  }
  window[KEY]?.destroy?.();
  let alive = true;
  let started = false;
  let timer = 0;
  let observer;
  let pageType = null;
  let pageHref = null;
  let renderCount = 0;
  let nativeSnapshot = null;
  let pendingSelection = null;
  const boundEvents = new Set();
  const subscriptions = [];
  const retries = [];
  const text = node => (node?.textContent || "").trim();
  const pathKey = path => path.replace(/\/+$/, "");
  const isProductPath = path => /^\/products\/[^/]+\/?$/.test(path);

  function removeOwned() {
    document.querySelectorAll(`#${ID},#${STYLE_ID}`).forEach(node => node.remove());
  }

  function visible(node) {
    for (let current = node; current instanceof Element; current = current.parentElement) {
      if (current.hidden || current.getAttribute("aria-hidden") === "true") return false;
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return Boolean(node?.isConnected);
  }

  function canonicalProductUrl(sidebar) {
    const candidates = [];
    // Native share URLs follow the currently rendered product during SPA navigation.
    sidebar.querySelectorAll('.details-product-share a[href]').forEach(link => {
      try {
        const share = new URL(link.href, location.href);
        const value = share.searchParams.get("u") || share.searchParams.get("url");
        if (value) candidates.push(value);
      } catch (_) { /* Ignore malformed optional share links. */ }
    });
    const canonical = document.querySelector('link[rel~="canonical"][href]');
    if (canonical) candidates.push(canonical.href);
    let foundNativeProductUrl = false;
    for (const candidate of candidates) {
      try {
        const url = new URL(candidate, location.href);
        if (!/^https?:$/.test(url.protocol) || !isProductPath(url.pathname)) continue;
        foundNativeProductUrl = true;
        // Never send the previous product's URL while a new product route renders.
        if (isProductPath(location.pathname) && pathKey(location.pathname) !== pathKey(url.pathname)) continue;
        url.search = "";
        url.hash = "";
        return url.href;
      } catch (_) { /* Wait for a valid native product URL. */ }
    }
    // A mismatched native URL means the prior product is still rendering. Do not
    // attach the new route to its old title/SKU. Location is only a last resort.
    if (!foundNativeProductUrl && isProductPath(location.pathname)) {
      const url = new URL(location.href);
      url.search = "";
      url.hash = "";
      return url.href;
    }
    return null;
  }

  function productRoute() {
    if (pageType && pageType !== "PRODUCT") return false;
    if (isProductPath(location.pathname)) return true;
    // Also support Ecwid product pages embedded on other paths after a real page event.
    return pageType === "PRODUCT" && pageHref === location.href;
  }

  function selectedOptions(sidebar) {
    const rows = [];
    const seen = new Set();
    const add = (control, value) => {
      if (!value) return;
      const group = control.closest(".details-product-option");
      const label = control.getAttribute("aria-label") || control.name ||
        text(group?.querySelector(".details-product-option__title"));
      if (!label) return;
      const line = `${label}: ${value}`;
      if (!seen.has(line)) { seen.add(line); rows.push(line); }
    };
    sidebar.querySelectorAll(`${OPTIONS} select`).forEach(select => {
      // Read live DOM properties, not stale selected attributes or translated labels.
      Array.from(select.selectedOptions).forEach(option => {
        if (option.hasAttribute("value")) add(select, option.value);
      });
    });
    sidebar.querySelectorAll(`${OPTIONS} input[type="radio"]:checked,${OPTIONS} input[type="checkbox"]:checked`)
      .forEach(input => add(input, input.value));
    return rows;
  }

  function context() {
    if (!productRoute()) return null;
    const sidebar = Array.from(document.querySelectorAll(SIDEBAR)).find(visible);
    if (!sidebar) return null;
    const availability = sidebar.querySelector('[itemprop="offers"] [itemprop="availability"]');
    const status = availability?.getAttribute("href") || availability?.getAttribute("content") || "";
    const soldOut = sidebar.querySelector(SOLD_OUT);
    const sku = text(sidebar.querySelector('[itemprop="sku"]'));
    const options = selectedOptions(sidebar);
    const optionKey = JSON.stringify(options);
    const snapshot = { sku, status, optionKey, sidebar };
    if (pendingSelection) {
      // A select property can change before Ecwid updates its variant SKU/stock.
      // Fail closed until an authoritative native field (or sidebar) has changed.
      const previous = pendingSelection;
      if (optionKey === previous.optionKey || sku !== previous.sku || status !== previous.status || sidebar !== previous.sidebar) {
        pendingSelection = null;
      } else {
        return null;
      }
    }
    nativeSnapshot = snapshot;
    // Both native signals are required. Labels, product names and option text do not imply stock.
    if (!/^https?:\/\/schema\.org\/OutOfStock\/?$/i.test(status) || !soldOut || !visible(soldOut)) return null;
    const name = text(sidebar.querySelector(".product-details__product-title"));
    const url = canonicalProductUrl(sidebar);
    if (!name || !sku || !url) return null;
    return { sidebar, soldOut, name, sku, url, options };
  }

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      (document.head || document.documentElement).append(style);
    }
  }

  function createBlock() {
    const box = document.createElement("section");
    box.id = ID;
    box.setAttribute("aria-labelledby", `${ID}-heading`);
    const heading = document.createElement("h2");
    heading.id = `${ID}-heading`;
    heading.className = "df-availability-contact__heading";
    heading.textContent = "Questions about this item?";
    const email = document.createElement("a");
    email.className = "df-availability-contact__email";
    email.textContent = "Ask about availability";
    const phone = document.createElement("a");
    phone.className = "df-availability-contact__phone";
    phone.textContent = "Call (402) 375-1885";
    phone.href = PHONE;
    box.append(heading, email, phone);
    return box;
  }

  function render() {
    timer = 0;
    if (!alive) return;
    renderCount += 1;
    bindApi();
    const current = context();
    if (!current) { removeOwned(); return; }
    let box = document.getElementById(ID);
    if (box && !current.sidebar.contains(box)) { box.remove(); box = null; }
    if (!box) box = createBlock();
    const body = [current.name, `SKU: ${current.sku}`, ...current.options, current.url, "", "My question: "].join("\n");
    const href = `mailto:${EMAIL}?subject=${encodeURIComponent(`Question about ${current.name}`)}&body=${encodeURIComponent(body)}`;
    const email = box.querySelector(".df-availability-contact__email");
    if (email.getAttribute("href") !== href) email.setAttribute("href", href);
    const favorite = current.sidebar.querySelector(".product-details__product-like");
    if (favorite && favorite.parentElement === current.soldOut.parentElement &&
        (current.soldOut.compareDocumentPosition(favorite) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      if (box.parentElement !== favorite.parentElement || box.nextElementSibling !== favorite) favorite.before(box);
    } else if (current.soldOut.nextElementSibling !== box) {
      current.soldOut.after(box);
    }
    ensureStyle();
  }

  function schedule(delay = 40) {
    if (!alive) return;
    clearTimeout(timer);
    timer = setTimeout(render, delay);
  }

  function optionsChanged() {
    if (!alive) return;
    // Remove stale mailto context immediately; re-read native SKU/availability after rendering settles.
    if (!pendingSelection && nativeSnapshot) pendingSelection = nativeSnapshot;
    removeOwned();
    schedule(100);
  }

  function pageLoaded(page) {
    if (!alive) return;
    pageType = typeof page?.type === "string" ? page.type.toUpperCase() : null;
    pageHref = location.href;
    nativeSnapshot = null;
    pendingSelection = null;
    removeOwned();
    schedule();
  }

  function subscribe(event, callback) {
    if (!event || typeof event.add !== "function" || boundEvents.has(event)) return;
    boundEvents.add(event);
    subscriptions.push([event, callback]);
    event.add(callback);
  }

  function bindApi() {
    const ecwid = window.Ecwid;
    if (!ecwid) return;
    subscribe(ecwid.OnAPILoaded, apiReady);
    subscribe(ecwid.OnPageLoaded, pageLoaded);
    subscribe(ecwid.OnProductSelectedOptionsChanged, optionsChanged);
  }

  function apiReady() { if (alive) { bindApi(); schedule(); } }
  function navigation() { if (!alive) return; pageType = null; pageHref = null; nativeSnapshot = null; pendingSelection = null; removeOwned(); schedule(); }
  function nativeChange(event) {
    if (event.target instanceof Element && event.target.closest(`${SIDEBAR} ${OPTIONS}`)) optionsChanged();
  }
  function owned(node) {
    const element = node instanceof Element ? node : node.parentElement;
    return Boolean(element?.closest(`#${ID},#${STYLE_ID}`));
  }
  function relevant(record) {
    if (owned(record.target)) return false;
    if (record.type === "childList") {
      const changed = [...record.addedNodes, ...record.removedNodes];
      if (changed.length && changed.every(owned)) return false;
      if (changed.some(node => node instanceof Element && (node.matches(SIDEBAR) || node.querySelector(SIDEBAR)))) return true;
    }
    const element = record.target instanceof Element ? record.target : record.target.parentElement;
    return Boolean(element?.closest(SIDEBAR));
  }
  function start() {
    if (!alive || started) return;
    started = true;
    observer = new MutationObserver(records => { if (records.some(relevant)) schedule(); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["href", "content", "value", "selected", "checked", "class", "hidden", "style", "aria-hidden"] });
    document.addEventListener("change", nativeChange, true);
    window.addEventListener("popstate", navigation);
    window.addEventListener("hashchange", navigation);
    window.addEventListener("load", apiReady);
    bindApi();
    schedule(0);
    // Bounded late-API registration; no permanent polling or network requests.
    [100, 500, 1500, 5000].forEach(delay => retries.push(setTimeout(apiReady, delay)));
  }

  window[KEY] = {
    version: VERSION,
    refresh: () => schedule(0),
    inspect: () => ({ version: VERSION, renderCount, blockCount: document.querySelectorAll(`#${ID}`).length,
      styleCount: document.querySelectorAll(`#${STYLE_ID}`).length, pageType }),
    destroy() {
      alive = false;
      clearTimeout(timer);
      retries.forEach(clearTimeout);
      observer?.disconnect();
      document.removeEventListener("DOMContentLoaded", start);
      document.removeEventListener("change", nativeChange, true);
      window.removeEventListener("popstate", navigation);
      window.removeEventListener("hashchange", navigation);
      window.removeEventListener("load", apiReady);
      subscriptions.forEach(([event, callback]) => { if (typeof event.remove === "function") event.remove(callback); });
      removeOwned();
      if (window[KEY]?.version === VERSION) delete window[KEY];
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
