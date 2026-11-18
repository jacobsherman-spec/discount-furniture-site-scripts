/* Discount Furniture. Restore shared variation links using native product options and public catalog reads. */
(() => {
  "use strict";
  if (window.__dfVariantLinks) return;
  window.__dfVariantLinks = true;
  const store = "111250852", app = "custom-app-111250852-1", marker = "df-options";
  const sidebarSelector = ".product-details__sidebar", groupSelector = ".product-details__product-options .details-product-option";
  const purchaseSelector = ".details-product-purchase", guard = "data-df-variant-pending";
  const cleanPath = path => path.replace(/\/$/, "");
  const normalize = value => String(value ?? "").trim().replace(/\s+/g, " ");
  const positiveId = id => Number.isSafeInteger(id) && id > 0;
  const plain = input => { const u = new URL(input); for (const name of ["variation","options",marker]) u.searchParams.delete(name); return u; };
  let active, lastUrl, page, pageEvent, style;

  function visible(element) {
    if (!element?.isConnected) return false;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      if (node.hidden || node.getAttribute("aria-hidden") === "true" || getComputedStyle(node).display === "none") return false;
    }
    return true;
  }

  function controls(sidebar) {
    const result = [];
    for (const group of sidebar.querySelectorAll(groupSelector)) {
      if (!visible(group)) continue;
      const select = group.querySelector("select"), radios = [...group.querySelectorAll('input[type="radio"]')];
      if (group.querySelector('textarea,input[type="file"],input[type="checkbox"],input[type="date"],input[type="text"]:not([readonly])')) return null;
      if (Boolean(select) === Boolean(radios.length) || select?.multiple) return null;
      const name = normalize(group.querySelector(".details-product-option__title")?.textContent || select?.getAttribute("aria-label") || radios[0]?.name);
      if (!name || result.some(c => c.name === name)) return null;
      const values = select ? [...select.options].filter(o => o.hasAttribute("value") && o.value !== "").map(o => o.value) : radios.map(r => r.value);
      const value = select ? (select.selectedOptions[0]?.hasAttribute("value") ? select.value : "") : (radios.find(r => r.checked)?.value || "");
      result.push({ name, value, values, select, radios });
    }
    return result.length ? result : null;
  }

  function productId(sidebar) {
    const wrapper = sidebar.closest('[class*="ec-store__product-page--"]');
    const match = wrapper?.className?.match(/(?:^|\s)ec-store__product-page--(\d+)(?=\s|$)/);
    const dom = match && Number(match[1]);
    return positiveId(dom) ? dom : page?.type === "PRODUCT" && positiveId(Number(page.productId)) ? Number(page.productId) : null;
  }

  function sameChoices(left, right) {
    return left.length === right.length && left.every(([name,value]) => right.some(([n,v]) => n === name && v === value));
  }

  function validChoice(choice) {
    return Array.isArray(choice) && choice.length === 2 && choice.every(s => typeof s === "string" && s.length > 0 && s.length < 1024);
  }

  function parseIntent(value, path) {
    try {
      if (value.length > 6500) return null;
      const x = JSON.parse(value);
      return x?.p === path && positiveId(x.i) && positiveId(x.v) && typeof x.s === "string" && x.s.length > 0 && x.s.length < 1024
        && Array.isArray(x.o) && x.o.length && x.o.every(validChoice) && new Set(x.o.map(o => o[0])).size === x.o.length ? x : null;
    } catch { return null; }
  }

  async function catalog(id, getter, signal) {
    const token = await getter.getAppPublicToken(app);
    if (typeof token !== "string" || !token.startsWith("public_")) throw Error("Public catalog access is unavailable");
    const url = new URL("https://app.ecwid.com/api/v3/" + store + "/products/" + id);
    url.searchParams.set("responseFields", "id,url,enabled,outOfStockVisibilityBehaviour,combinations(id,sku,options(name,value),inStock,outOfStockVisibilityBehaviour)");
    const r = await fetch(url.href, { method: "GET", credentials: "omit", redirect: "error", cache: "no-store", signal,
      headers: { Accept: "application/json", Authorization: "Bearer " + token } });
    if (!r.ok) throw Error("Public product could not be read");
    const p = await r.json();
    if (p?.id !== id || p.enabled !== true || !Array.isArray(p.combinations)) throw Error("Public product could not be matched");
    return p;
  }

  function exact(product, id, sku, choices) {
    const matches = product.combinations.filter(v => (!id || v.id === id) && v.sku === sku && positiveId(v.id)
      && typeof v.inStock === "boolean" && Array.isArray(v.options) && v.options.length
      && v.options.every(o => choices.some(([name,value]) => name === o.name && value === o.value)));
    return matches.length === 1 ? matches[0] : null;
  }

  function purchaseAgrees(sidebar, variation, product) {
    const panel = sidebar.querySelector(purchaseSelector);
    const tag = sidebar.querySelector('[itemprop="offers"] [itemprop="availability"]');
    const state = (tag?.getAttribute("href") || tag?.getAttribute("content") || "").split("/").filter(Boolean).pop();
    const add = panel && [...panel.querySelectorAll(".details-product-purchase__add-to-bag button")].some(b => visible(b) && !b.disabled && b.getAttribute("aria-disabled") !== "true");
    const unavailable = [...sidebar.querySelectorAll(".details-product-purchase__sold-out")].some(visible);
    if (variation.inStock) return ["InStock","LimitedAvailability"].includes(state) && add && !unavailable;
    if (["OutOfStock","SoldOut","Discontinued"].includes(state) && unavailable && !add) return true;
    return ["PreOrder","PreSale","BackOrder"].includes(state) && add &&
      (variation.outOfStockVisibilityBehaviour || product.outOfStockVisibilityBehaviour) === "ALLOW_PREORDER";
  }

  function route() {
    const url = new URL(location.href), path = cleanPath(url.pathname);
    if (url.href === lastUrl) return;
    lastUrl = url.href;
    active?.stop();
    active = null;
    if (!/^\/products\/[^/]+$/.test(path)) return;
    const variations = url.searchParams.getAll("variation"), indexes = url.searchParams.getAll("options"), share = url.searchParams.getAll(marker);
    const direct = variations.length > 0 || indexes.length > 0;
    if (!direct && !share.length) return;
    if (!document.documentElement) { lastUrl = null; return; }
    const target = !direct && share.length === 1 ? parseIntent(share[0], path) : null;
    const validParams = variations.length <= 1 && indexes.length <= 1 &&
      (!variations.length || (/^[1-9]\d*$/.test(variations[0]) && positiveId(Number(variations[0])))) &&
      (!indexes.length || /^[1-9]\d*(,[1-9]\d*)*$/.test(indexes[0]));
    let timer, note, closed = false, blocked = false, loaded, requestId, settled = 0, lastDispatch = 0, lastStep = "", attempts = 0;
    let hydrated = false, readyAt = 0, preHydrationField = "", replayNativeEvent = false;
    const stopper = new AbortController();
    const deadline = Date.now() + 18000;
    document.documentElement.setAttribute(guard, "");
    if (!style?.isConnected) {
      style = document.createElement("style");
      style.textContent = "html[" + guard + "] .product-details__sidebar .details-product-purchase{visibility:hidden!important;pointer-events:none!important}";
      (document.head || document.documentElement).append(style);
    }
    function stop() {
      closed = true; clearTimeout(timer); stopper.abort();
      note?.remove(); document.documentElement.removeAttribute(guard);
      for (const type of ["pointerdown","keydown","input","change"]) document.removeEventListener(type, shopper, true);
    }
    function shopper(e) {
      if (!e.isTrusted || !e.target.closest?.(sidebarSelector + " .product-details__product-options")) return;
      if (direct) {
        if (e.type === "change" || e.type === "input") {
          const sidebar = e.target.closest(sidebarSelector);
          const fields = sidebar && controls(sidebar);
          const next = plain(url.href);
          if (loaded && fields) {
            const choices = fields.map(f => [f.name,f.value]);
            const matches = loaded.combinations.filter(v => positiveId(v.id) && v.sku && v.options?.length &&
              v.options.every(o => choices.some(([n,value]) => n === o.name && value === o.value)));
            if (matches.length === 1 && choices.every(validChoice)) {
              const v = matches[0]; next.searchParams.set(marker,JSON.stringify({p:path,i:loaded.id,v:v.id,s:v.sku,o:choices}));
            }
          }
          closed = true; clearTimeout(timer); location.replace(next.href);
        }
        return;
      }
      history.replaceState(history.state, "", plain(location.href).href);
      stop(); lastUrl = location.href;
    }
    function message(sidebar, reason) {
      if (!sidebar) return;
      if (!note?.isConnected) {
        note = document.createElement("p"); note.setAttribute("role","status");
        (sidebar.querySelector(purchaseSelector) || sidebar).before(note);
      }
      if (reason) {
        note.textContent = reason + " ";
        const link = document.createElement("a"); link.href = plain(url.href).href; link.textContent = "Open the product and choose options"; note.append(link);
      } else if (!note.textContent) note.textContent = "Checking availability for the selected options…";
    }
    function hold(reason) {
      blocked = true; clearTimeout(timer); stopper.abort();
      const show = () => { if (!closed) message(document.querySelector(sidebarSelector) || document.body, reason); };
      if (document.body) show(); else document.addEventListener("DOMContentLoaded",show,{once:true});
    }
    function tick() {
      if (closed || blocked) return;
      if (location.href !== url.href) { route(); return; }
      const sidebar = [...document.querySelectorAll(sidebarSelector)].find(visible);
      message(sidebar);
      if (!validParams || (!direct && !target)) { hold("This option link could not be recognized."); return; }
      if (Date.now() >= deadline) { hold("The store could not confirm the selected option’s availability."); return; }
      const wait = () => { clearTimeout(timer); timer = setTimeout(tick, 100); };
      if (!sidebar) { wait(); return; }
      const id = productId(sidebar), fields = controls(sidebar);
      if (!id || !sidebar.querySelector(groupSelector)) { wait(); return; }
      if (!fields) { hold("Choose these product options on the ordinary product page."); return; }
      if (target && target.i !== id) { hold("This option link belongs to a different product."); return; }
      const getter = [window.Ecwid,window.instantsite].find(x => typeof x?.getAppPublicToken === "function");
      if (getter && requestId === undefined) {
        requestId = id;
        catalog(id, getter, stopper.signal).then(p => { if (!closed && !blocked) { loaded = p; tick(); } })
          .catch(() => { if (!closed && !blocked) hold("The store could not verify this product’s public options."); });
      }
      if (!loaded || id !== requestId) { wait(); return; }
      if (loaded.url && cleanPath(new URL(loaded.url,location.href).pathname) !== path) { hold("This option link belongs to a different product page."); return; }
      const sku = normalize(sidebar.querySelector('[itemprop="sku"]')?.textContent), choices = fields.map(f => [f.name,f.value]);
      if (direct) {
        const idx = indexes[0]?.split(",").map(Number) || [];
        if (!sku || choices.some(([,v]) => !v) || idx.some((n,i) => fields[i]?.values[n-1] !== fields[i]?.value)) { wait(); return; }
        const variation = exact(loaded, Number(variations[0]) || null, sku, choices);
        if (!variation) { wait(); return; }
        const next = plain(url.href);
        next.searchParams.set(marker,JSON.stringify({p:path,i:id,v:variation.id,s:sku,o:choices}));
        if (next.href.length > 7000) { hold("Choose these options directly on the product page."); return; }
        closed = true; clearTimeout(timer); location.replace(next.href); return;
      }
      const variation = exact(loaded,target.v,target.s,target.o);
      if (!variation) { hold("This product’s saved option or SKU has changed."); return; }
      if (fields.length !== target.o.length || fields.some(f => !target.o.some(([n]) => n === f.name))) { hold("This product’s options have changed."); return; }
      if (!readyAt) readyAt = Date.now();
      if (!hydrated && (document.readyState !== "complete" || Date.now()-readyAt < 500)) { wait(); return; }
      let field = fields.find(f => target.o.find(([n]) => n === f.name)[1] !== f.value);
      if (!field && replayNativeEvent && sku !== target.s) {
        field = fields.find(f => f.name === preHydrationField);
        if (Date.now()-lastDispatch >= 220) replayNativeEvent = false;
      }
      if (field) {
        settled = 0;
        const value = target.o.find(([n]) => n === field.name)[1];
        if (Date.now()-lastDispatch < 220 || !field.values.includes(value)) { wait(); return; }
        if (lastStep !== field.name) { lastStep = field.name; attempts = 0; }
        if (++attempts > 3) { hold("The product could not select these options."); return; }
        lastDispatch = Date.now();
        if (!hydrated) preHydrationField = field.name;
        if (field.select && !field.select.disabled) {
          field.select.value = value; field.select.dispatchEvent(new Event("change",{bubbles:true}));
        } else {
          const radio = field.radios.find(r => r.value === value && !r.disabled);
          if (radio) { radio.checked = true; radio.dispatchEvent(new Event("change",{bubbles:true})); }
        }
      } else if (sku === target.s && sameChoices(choices,target.o) && purchaseAgrees(sidebar,variation,loaded)) {
        if (!settled) settled = Date.now();
        if (Date.now()-settled >= 180) {
          stop();
          // Keep a valid share/refresh address until a shopper actually changes the chosen options.
          function changed(e) {
            if (!e.isTrusted || !e.target.closest?.(sidebarSelector+" .product-details__product-options")) return;
            if (location.href === url.href) history.replaceState(history.state,"",plain(location.href).href);
            document.removeEventListener("change",changed,true);
          }
          document.addEventListener("change",changed,true);
          return;
        }
      } else settled = 0;
      wait();
    }
    for (const type of ["pointerdown","keydown","input","change"]) document.addEventListener(type,shopper,true);
    active = { stop, loaded: event => {
      if (event?.type === "PRODUCT" && (!requestId || Number(event.productId) === requestId)) {
        if (!hydrated && preHydrationField) replayNativeEvent = true;
        hydrated = true; tick();
      }
    } };
    tick();
  }
  function bind() {
    const event = window.Ecwid?.OnPageLoaded;
    if (event?.add && pageEvent !== event) {
      pageEvent = event;
      event.add(p => { page = p; route(); active?.loaded(p); });
    }
    route();
  }
  if (!document.documentElement) {
    const first = new MutationObserver(() => { if (document.documentElement) { first.disconnect(); bind(); } });
    first.observe(document,{childList:true});
  } else bind();
  document.addEventListener("DOMContentLoaded",bind,{once:true}); window.addEventListener("load",bind,{once:true});
  window.addEventListener("popstate",() => { page=null; bind(); });
  [80,350,1000,2500,6000,12000].forEach(ms => setTimeout(bind,ms));
})();
