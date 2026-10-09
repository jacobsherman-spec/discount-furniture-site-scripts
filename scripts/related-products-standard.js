(() => {
'use strict';
if (window.__dfRelatedStandardV1) return;
const groups = [["Complete the Affinity Room","cyrlyz.38xwl"],["Complete the Allyson Park Room","canu7n.7qa.2bi.dk.140uj.30g.7swl6.gx4.6t.htm2o.1hcz3.bgae.28r"],["Complete the Avalon Room","dbggzc.coo3s.1jy.u9j"],["Complete the Bexley Room","e2fzxu.13s.5"],["Complete the Carolina Park Room","d1fv72.19h.4la"],["Complete the Cascade Falls Room","cmzxwh.29v.1qg.fwh1h.4.hx0xd.jfqur"],["Complete the Century Modern Room","dkp3u3.1wg.204.9t7km.3ai.u.9h18x.1.1.1.k3.1.70.1.1.1.1.1"],["Complete the Danby Room","dwihib.2yr.jl.1pe"],["Complete the Harrison Heights Room","e3b05p.1.2.k4.1.4ad.6o"],["Complete the Haven Hills Room","d1gduu.rv"],["Complete the Hendrix Place Room","e2fvlv.1cl.2wt"],["Complete the Homestead Haven Room","e3kdjv.2dx.1.2.2.1.3k.qc.149.1.1.1.1"],["Complete the Ivy Hollow Room","e3yu6f.6j.cw.1.1.2.1d.1.1.1.1.1.1.1.7k2.1.2.4.4.1.2.1.1.1bp.1.2.2.1.1.2"],["Complete the Lennox Hill Room","e1g13h.12d.288.14p9k.vh.37l.61"],["Complete the Magnolia Manor Room","cgtxp1.cueyu.5gp4.uus.vza1t.lhl.d8vq1.2rn.35p.mc5.34n.1i7.1gh.6k.1.py.1o1.3.1.2.1.2.1.1.ie.9.5.5f.3.2"],["Complete the Modern Edge Room","casaxx.yg.2a3.6n.15r.fdbzb.29k.6e4.cqish.5v4q9.29z6.12.5aq.fh5a7.1a.ezmrn.1.1bs.pv"],["Complete the Modern Play Room","d2w6qo.c78"],["Complete the Modern View Room","cvfyg5.5zqo8.15b"],["Complete the New Haven Room","e405yg.1.1h2.1.4.1.1.1.6o.6"],["Complete the Perspectives Room","catpwj.it.8qdz.adrcj"],["Complete the Piedmont Room","d20jvn.kq.6o.6x.jn1md"],["Complete the Proximity Place Room","e4a81h.w.1.1.2.1.bk.1.1b8.3.1.r.1.1.1"],["Complete the Rochelle Park Room","e3b55l.2.10.4f.18.15f.1.7.1"],["Complete the Santa Rosa Room","dxd5fo.40.h.6i"],["Complete the Shaker Lakes Room","d1fqcl.40m.1hw.ki"],["Complete the Skye View Room","e3a66w.2eb.3.1.15x.319.2.1.1.rc.2yt"],["Complete the South Bend Room","ceffoz.7h8zq.7036r.gcxc4.4bp1u.um5.32csa.ffu.1od.8fnpd.6lnf9.4v5.6t.e2.t.jy.c.6ujxd"],["Complete the Stillwater Room","e48xlx.61.19.55.1.1b.1.1.1.1kx.1"],["Complete the Wesley Hall Room","e2ul6r.i.b78.1l.8t7.8.xk.6.2.1oq.k"]];
const products = Object.create(null);
for (const [heading, encoded] of groups) {
let id = 0;
for (const delta of encoded.split('.')) {
id += parseInt(delta, 36);
if (!Number.isSafeInteger(id) || id <= 0 || products[id]) return;
products[id] = heading;
}
}
window.__dfRelatedStandardV1 = true;
const originals = new WeakMap();
let scheduled = false;
function restore(title) {
const original = title && originals.get(title);
if (!original) return;
if (title.textContent === original.applied) title.textContent = original.text;
for (const name of ['role', 'aria-level']) {
if (original[name] === null) title.removeAttribute(name);
else title.setAttribute(name, original[name]);
}
originals.delete(title);
}
function apply() {
scheduled = false;
document.querySelectorAll('.ec-store__product-page, .df-related-standard').forEach(root => {
const identities = Array.from(root.classList).filter(name => /^ec-store__product-page--\d+$/.test(name));
const id = identities.length === 1 && identities[0].slice(24);
const heading = root.classList.contains('ec-store__product-page') && products[id];
const related = root.querySelector('.ec-related-products');
const title = related && related.querySelector('.ec-related-products__title');
const enabled = Boolean(heading && title && related.querySelector('.grid-product'));
if (root.classList.contains('df-related-standard') !== enabled) root.classList.toggle('df-related-standard', enabled);
if (!enabled) { restore(title); return; }
if (!originals.has(title)) originals.set(title, {text: title.textContent, role: title.getAttribute('role'), 'aria-level': title.getAttribute('aria-level')});
originals.get(title).applied = heading;
if (title.textContent !== heading) title.textContent = heading;
title.setAttribute('role', 'heading');
title.setAttribute('aria-level', '2');
});
}
function queue() {
if (scheduled) return;
scheduled = true;
window.requestAnimationFrame(apply);
}
function start() {
apply();
new MutationObserver(queue).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
window.addEventListener('popstate', queue);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
else start();
})();
