// Drives the VV Apartelle demo app and records an onboarding walkthrough.
// Usage: node record.js dump    -> writes beats.json (narration text)
//        node record.js record  -> records video.webm + timeline.json (needs durations.json)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const B = 'http://localhost:3000';
const DIR = __dirname;
const W = 1280, H = 720;
let page, code = '';

const wait = (ms) => page.waitForTimeout(ms);

// ---------- overlay helpers (run inside the page) ----------
const INIT = () => {
  const css = `
  #__cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);width:min(1120px,calc(100vw - 48px));
    background:rgba(20,18,16,.90);color:#fff;border-radius:14px;padding:14px 22px 16px;z-index:2147483600;
    font:500 19px/1.45 Geist,Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:opacity .3s}
  #__cap .ch{display:block;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#e0a458;font-weight:700;margin-bottom:4px}
  #__cap.off{opacity:0}
  #__cur{position:fixed;left:640px;top:360px;width:26px;height:26px;z-index:2147483646;pointer-events:none;
    transition:left .6s cubic-bezier(.4,0,.2,1),top .6s cubic-bezier(.4,0,.2,1)}
  #__cur svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
  .__rip{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #e0a458;
    z-index:2147483645;pointer-events:none;animation:__r .55s ease-out forwards}
  @keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
  #__card{position:fixed;inset:0;z-index:2147483640;background:#f6f1ea;display:flex;align-items:center;justify-content:center;
    opacity:0;pointer-events:none;transition:opacity .6s}
  #__card.on{opacity:1}
  #__card .in{max-width:900px;padding:0 48px;text-align:left}
  #__card img{width:84px;height:84px;border-radius:18px;margin-bottom:26px}
  #__card .k{font:700 13px/1 Geist,Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#b4772f;margin-bottom:14px}
  #__card h1{font:600 52px/1.08 Fraunces,Georgia,serif;color:#1c1917;margin:0 0 16px}
  #__card p{font:400 22px/1.5 Geist,Inter,sans-serif;color:#57534e;margin:0}
  #__card ul{margin:22px 0 0;padding:0;list-style:none;font:500 21px/1.5 Geist,Inter,sans-serif;color:#292524}
  #__card li{padding:7px 0 7px 34px;position:relative}
  #__card li:before{content:"";position:absolute;left:4px;top:17px;width:12px;height:12px;border-radius:50%;background:#b4772f}
  @media print{#__cap,#__cur,#__card{display:none!important}}`;
  const mk = () => {
    if (document.getElementById('__cap')) return;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    const cap = document.createElement('div'); cap.id = '__cap'; cap.className = 'off'; document.body.appendChild(cap);
    const cur = document.createElement('div'); cur.id = '__cur';
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l16 10.5-7 1.3 4.2 7.6-2.9 1.6-4.2-7.7L4 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const card = document.createElement('div'); card.id = '__card'; document.body.appendChild(card);
    try {
      const c = JSON.parse(sessionStorage.getItem('__capv') || 'null'); if (c) window.__cap(c.ch, c.t);
      const p = JSON.parse(sessionStorage.getItem('__curp') || 'null'); if (p) { cur.style.transition = 'none'; cur.style.left = p.x + 'px'; cur.style.top = p.y + 'px'; requestAnimationFrame(() => cur.style.transition = ''); }
    } catch {}
  };
  window.__cap = (ch, t) => {
    const el = document.getElementById('__cap'); if (!el) return;
    sessionStorage.setItem('__capv', JSON.stringify(t ? { ch, t } : null));
    if (!t) { el.className = 'off'; return; }
    el.innerHTML = (ch ? `<span class="ch">${ch}</span>` : '') + t; el.className = '';
  };
  window.__mv = (x, y) => { const c = document.getElementById('__cur'); c.style.left = x + 'px'; c.style.top = y + 'px'; sessionStorage.setItem('__curp', JSON.stringify({ x, y })); };
  window.__rip = (x, y) => { const r = document.createElement('div'); r.className = '__rip'; r.style.left = x + 'px'; r.style.top = y + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); };
  window.__card = (html) => { const c = document.getElementById('__card'); const cu = document.getElementById('__cur'); if (html) { c.innerHTML = html; c.classList.add('on'); cu.style.opacity = '0'; } else { c.classList.remove('on'); cu.style.opacity = '1'; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk();
  if (document.documentElement) new MutationObserver(() => { if (document.body && document.head && !document.getElementById('__cap')) mk(); }).observe(document.documentElement, { childList: true, subtree: true });
};

// ---------- node-side helpers ----------
async function ensure() { await page.waitForFunction(() => !!window.__mv && !!document.getElementById('__cap')); }
async function go(url) { await page.goto(B + url); await page.waitForLoadState('networkidle').catch(() => {}); await ensure(); await wait(500); }
async function move(loc) {
  loc = loc.first();
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox();
  if (!b) return null;
  const x = Math.round(b.x + Math.min(b.width / 2, 60)), y = Math.round(b.y + b.height / 2);
  await page.evaluate(([x, y]) => window.__mv(x, y), [x, y]);
  await wait(700);
  return { x, y };
}
async function moveXY(x, y, ms = 700) { await page.evaluate(([x, y]) => window.__mv(x, y), [x, y]); await wait(ms); }
async function click(loc, after = 500) {
  loc = loc.first();
  const p = await move(loc);
  if (p) await page.evaluate(([x, y]) => window.__rip(x, y), [p.x, p.y]);
  await wait(150);
  await loc.click();
  await wait(after);
}
async function type(loc, text) { await click(loc, 200); await loc.pressSequentially(text, { delay: 55 }); await wait(300); }
async function scroll(px, steps = 10, x = 760, y = 380) {
  await page.mouse.move(x, y);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, px / steps); await wait(45); }
  await wait(400);
}
async function login(role) {
  await go('/login');
  const re = { guest: /^Guest/, admin: /^Front desk admin/, owner: /^Owner/ }[role];
  await click(page.getByRole('button', { name: re }), 300);
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.waitForLoadState('networkidle').catch(() => {});
  await ensure(); await wait(600);
}
const card = (kicker, title, sub, list) =>
  page.evaluate((h) => window.__card(h),
    `<div class="in"><img src="/logo.jpg" alt=""><div class="k">${kicker}</div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}${list ? `<ul>${list.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}</div>`);
const uncard = () => page.evaluate(() => window.__card(null));

// ---------- the script ----------
// ch: chapter label shown in the caption. say: narration (also the caption, unless cap is given).
const beats = [
  // Intro
  { ch: 'Welcome', say: "Hi! This short video walks you through your new online booking system for V-V Apartelle Panabo: what it does, who uses it, and how bookings and payments flow through it.",
    cap: "This short video walks you through your new online booking system for VV Apartelle Panabo: what it does, who uses it, and how bookings and payments flow through it.",
    act: async () => { await card('Owner onboarding', 'VV Apartelle Panabo<br>Online Booking System', 'A guided tour of what you get, in about six minutes.'); } },
  { ch: 'Welcome', say: "It replaces the back-and-forth of chats and phone calls. Guests check open rooms, reserve, and pay by QR on their own, any time of day. You and your staff simply verify the payment and welcome them.",
    act: async () => { await wait(800); await card('How it works', 'Guests book themselves.<br>You just verify.', null, ['1. Guest picks nights and reserves', '2. Guest pays by GCash, Maya or bank QR', '3. Front desk confirms the payment', '4. Guest gets an email receipt and checks in']); } },

  // Guest website
  { ch: '1 · Your guest website', say: "This is the website your guests see. It shows your three rooms, the price per night, and whether you're already full tonight.",
    act: async () => { await uncard(); await wait(700); await move(page.getByRole('link', { name: /Check availability/ })); await wait(600); await move(page.getByText(/booked tonight|available tonight|left tonight/i)); } },
  { ch: '1 · Your guest website', say: "Each room has its own description, amenities, and nightly rate, and you can change all of these yourself, any time.",
    act: async () => { await scroll(560, 14); await wait(800); await scroll(300, 8); } },

  // Roles
  { ch: '2 · Three kinds of accounts', say: "There are three kinds of accounts. Guests, who book and pay. Front desk staff, who verify payments and check people in. And you, the owner, who can see everything, including the money.",
    act: async () => { await go('/login'); await move(page.getByRole('button', { name: /^Guest/ })); await wait(1200); await move(page.getByRole('button', { name: /^Front desk admin/ })); await wait(1500); await move(page.getByRole('button', { name: /^Owner/ })); } },
  { ch: '2 · Three kinds of accounts', say: "In this demo, each account opens with one click. Let's start as a guest named Juan.",
    act: async () => { await wait(1200); await login('guest'); } },

  // Booking
  { ch: '3 · A guest books a room', say: "Juan sees an availability calendar: rooms down the side, nights across the top. Striped boxes are already booked. Open boxes show the price for that night.",
    act: async () => { const g = page.locator('table').first(); await g.scrollIntoViewIfNeeded(); await moveXY(950, 455); await wait(900); await move(page.locator('button[aria-label^="Room 1, night of"]').first()); await wait(900); await moveXY(900, 515); } },
  { ch: '3 · A guest books a room', say: "He taps two nights in Room 1, and the total updates instantly on the right.",
    act: async () => { const c = page.locator('button[aria-label^="Room 1, night of"]'); await click(c.nth(0), 500); await click(c.nth(1), 700); await move(page.getByText('Total').first()); } },
  { ch: '3 · A guest books a room', say: "When he taps Reserve and pay, the system holds those nights for fifteen minutes, so nobody else can grab them while he is paying.",
    act: async () => { await click(page.getByRole('button', { name: /Reserve & pay/ }), 300); await page.waitForURL('**/checkout/**'); await ensure(); await wait(1000);
      code = (await page.locator('text=/VV-[A-Z0-9]{6}/').first().innerText()).match(/VV-[A-Z0-9]{6}/)[0]; } },

  // Payment
  { ch: '4 · Paying by QR', say: "Now Juan sees your QR code and the exact amount to pay. He can choose GCash, Maya, or bank transfer, using your real accounts, which you upload yourself.",
    act: async () => { await move(page.getByText('Amount to pay')); await wait(900); await click(page.getByRole('tab', { name: /Maya/ }), 1100); await click(page.getByRole('tab', { name: /Bank/ }), 1100); await click(page.getByRole('tab', { name: /GCash/ }), 300); } },
  { ch: '4 · Paying by QR', say: "Notice the timer at the top. If he doesn't pay within fifteen minutes, the nights are released automatically for other guests.",
    act: async () => { await move(page.getByText('Nights held for')); } },
  { ch: '4 · Paying by QR', say: "After paying in his e-wallet app, Juan types in the reference number, and uploads a screenshot of his payment.",
    act: async () => { const inp = page.getByPlaceholder('e.g. 1234 567 890123'); await type(inp, '5012 884 731209');
      const up = page.getByText('Upload payment screenshot').first(); await move(up); await page.locator('input[type=file]').first().setInputFiles(path.join(DIR, 'payment.png')); await wait(900); await scroll(250, 6); } },
  { ch: '4 · Paying by QR', say: "He taps Submit, and the booking now waits for your team to check the payment.",
    act: async () => { await click(page.getByRole('button', { name: 'Submit payment' }), 1500); await page.waitForLoadState('networkidle').catch(() => {}); await ensure(); } },

  // Front desk verify
  { ch: '5 · Front desk verifies', say: "Now let's switch to the front desk account. The Bookings page lists every payment waiting to be checked, with a counter so nothing gets missed.",
    act: async () => { await login('admin'); await move(page.getByRole('link', { name: /Bookings/ }).first()); await wait(800); await move(page.getByText(code).first()); } },
  { ch: '5 · Front desk verifies', say: "Staff open the booking, and compare the reference number and screenshot with what actually arrived in your GCash or bank app.",
    act: async () => { await click(page.getByText(code).first(), 1200); await page.waitForLoadState('networkidle').catch(() => {}); await ensure();
      await move(page.getByAltText('Payment screenshot').first()); await wait(800); await move(page.getByText('5012 884 731209').first()); } },
  { ch: '5 · Front desk verifies', say: "If the money is really there, they tap Confirm payment. If not, they can reject it with a reason, and the guest is told why.",
    act: async () => { await move(page.getByRole('button', { name: /Reject payment/ })); await wait(900); await click(page.getByRole('button', { name: /Confirm payment/ }), 1500); } },

  // Receipt
  { ch: '6 · Automatic receipt', say: "The moment it's confirmed, Juan automatically receives an email receipt.",
    act: async () => { await login('guest'); await go('/inbox'); await click(page.getByText(new RegExp('Booking confirmed.*' + code)).first(), 800); } },
  { ch: '6 · Automatic receipt', say: "It shows his booking code, a QR code, the nights he booked, and the amount paid. In this demo, emails land in a test inbox. In the live version, they go to the guest's real email address.",
    act: async () => { await wait(1500); await scroll(350, 10, 900, 400); await wait(1200); await scroll(350, 10, 900, 400); } },
  { ch: '6 · Automatic receipt', say: "He can also find all his bookings under My bookings, and print or save the receipt as a PDF.",
    act: async () => { await click(page.getByRole('link', { name: 'My bookings' }), 900); await click(page.getByText(code).first(), 1000); await move(page.getByRole('button', { name: /Print/ })); } },

  // Check-in
  { ch: '7 · Check-in day', say: "When Juan arrives, the front desk types his booking code, or scans the QR on his receipt, to pull up the reservation.",
    act: async () => { await login('admin'); await go('/admin/check-in'); await type(page.getByPlaceholder(/Booking code/), code); await click(page.getByRole('button', { name: 'Find booking' }), 900); } },
  { ch: '7 · Check-in day', say: "One tap checks him in, and another checks him out when he leaves. This page also lists who is arriving today, who is staying in-house, and who is coming tomorrow.",
    act: async () => { await click(page.getByRole('button', { name: /Check in guest/ }), 1600); await scroll(500, 10); await wait(600); } },

  // Owner dashboard
  { ch: '8 · Your owner dashboard', say: "Now, the part that's just for you: the owner dashboard. At the top you see registered customers, payments waiting to be verified, today's arrivals, and money already confirmed for upcoming nights.",
    act: async () => { await login('owner'); await wait(800); await move(page.getByText('Registered customers')); await wait(700); await move(page.getByText('Payments to verify')); await wait(700); await move(page.getByText(/Arrivals today/)); await wait(700); await move(page.getByText('Upcoming paid revenue')); } },
  { ch: '8 · Your owner dashboard', say: "Below that are your revenue and occupancy for this week, this month, and this year, each compared with the same point last period, so you know right away if business is up or down.",
    act: async () => { await move(page.getByText('This week').first()); await wait(900); await move(page.getByText('This month').first()); await wait(900); await move(page.getByText('This year').first()); } },
  { ch: '8 · Your owner dashboard', say: "The charts show your revenue trend, how full each room gets, and which payment channels guests use most. The demo is filled with about two years of sample history, so you can see how it will look.",
    act: async () => { await scroll(420, 12); await wait(500); const m = page.getByRole('button', { name: '12 months' }); if (await m.count()) await click(m, 900); await scroll(420, 12); await wait(900); await scroll(450, 12); } },

  // Managing
  { ch: '9 · Running your property', say: "Under Rooms, you can add a new room, edit its photo, price and description, or close it temporarily, for repairs for example, with a single switch.",
    act: async () => { await click(page.getByRole('link', { name: 'Rooms' }).first(), 900); await move(page.getByRole('button', { name: /Add room/ })); await wait(500); await click(page.getByRole('button', { name: /Edit/ }).first(), 1800); await page.keyboard.press('Escape'); await wait(500); await move(page.getByText('Open for booking').first()); } },
  { ch: '9 · Running your property', say: "Under Rates, you set special prices for holidays, fiestas, or busy weekends. Pick the dates, choose the rooms, type the price, and apply.",
    act: async () => { await click(page.getByRole('link', { name: 'Rates' }).first(), 900); await click(page.getByRole('button', { name: 'Next month' }), 700); await click(page.getByRole('button', { name: /Fri & Sat/ }), 700);
      const r3 = page.getByRole('button', { name: /Room 3/ }); if (await r3.count()) await click(r3, 500);
      await type(page.getByPlaceholder('e.g. 1500'), '1500'); await click(page.getByRole('button', { name: /Apply special rate/ }), 900); } },
  { ch: '9 · Running your property', say: "Payment QR is where you upload your real GCash, Maya, and bank QR codes and account details. You can switch any of them off.",
    act: async () => { await click(page.getByRole('link', { name: 'Payment QR' }).first(), 1000); await move(page.getByText('Replace image').first()); await wait(800); await move(page.getByRole('switch').first().or(page.getByLabel(/GCash enabled/)).first()); } },
  { ch: '9 · Running your property', say: "Customers lists everyone who has signed up, with their mobile number, how many times they've stayed, and how much they've spent.",
    act: async () => { await click(page.getByRole('link', { name: 'Customers' }).first(), 1000); await moveXY(1180, 175); await wait(800); await scroll(300, 8); } },
  { ch: '9 · Running your property', say: "Under Staff, you add or remove front desk accounts. Staff can verify payments and check guests in, but they can't see your revenue or change your prices.",
    act: async () => { await click(page.getByRole('link', { name: 'Staff' }).first(), 1000); await move(page.getByRole('button', { name: /Add/ }).first()); } },
  { ch: '9 · Running your property', say: "And in Settings, you control the payment hold time, check-in and check-out times, how far ahead guests can book, and your contact details.",
    act: async () => { await click(page.getByRole('link', { name: 'Settings' }).first(), 1000); await move(page.getByText(/Payment hold time/)); await wait(900); await scroll(350, 10); } },

  // Safeguards
  { ch: 'Built-in safeguards', say: "A few safeguards are built in. The same room can never be sold twice for the same night. Unpaid reservations release themselves. And every booking keeps a full history of who confirmed, rejected, or checked it in.",
    act: async () => { await card('Peace of mind', 'Built-in safeguards', null, ['No double bookings: one room, one guest, per night', 'Unpaid holds release automatically after 15 minutes', 'Every booking records who confirmed or checked it in', 'Staff accounts cannot see revenue or change prices']); } },

  // Demo vs live
  { ch: 'Demo vs. live', say: "One important note. What you're seeing is a fully clickable demo. It saves everything inside this one browser, which is perfect for trying things out, but it isn't live for real guests yet.",
    act: async () => { await card('Where things stand', 'This is a working demo', 'Every screen and button you saw works today. For now, data is saved only in the browser you are using, so it is safe to click around and experiment.'); } },
  { ch: 'Demo vs. live', say: "To go live, the remaining steps are: a secure online database, real log-ins, real emails to guests, and your own web address. The database design is already drafted, so the screens you saw today stay the same.",
    act: async () => { await card('Next steps to go live', 'Going live', null, ['Secure online database, so all devices share the same data', 'Real, secure log-ins for guests, staff and you', 'Receipts sent to guests’ real email addresses', 'Hosted on your own web address']); } },
  { ch: 'Thank you', say: "In short: guests book and pay on their own, your staff verify in a couple of taps, and you can see exactly how your business is doing, from your phone or your computer. Thank you for watching!",
    act: async () => { await card('In short', 'Less admin. More bookings.', null, ['Guests book and pay by QR, 24/7', 'Staff verify and check in with a couple of taps', 'You see revenue and occupancy at a glance']); } },
];

(async () => {
  const mode = process.argv[2];
  if (mode === 'dump') {
    fs.writeFileSync(path.join(DIR, 'beats.json'), JSON.stringify(beats.map((b) => b.say), null, 1));
    console.log(beats.length, 'beats'); return;
  }
  const dur = JSON.parse(fs.readFileSync(path.join(DIR, 'durations.json'), 'utf8'));
  const only = process.argv[3] ? Number(process.argv[3]) : null; // debug: stop after N beats
  const browser = await chromium.launch();
  // Reset demo data first in a throwaway context so every run starts the same.
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: path.join(DIR, 'raw'), size: { width: W, height: H } } });
  await ctx.addInitScript(INIT);
  page = await ctx.newPage();
  const t0 = Date.now();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(B + '/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(B + '/'); await ensure();
  await card('Owner onboarding', 'VV Apartelle Panabo<br>Online Booking System', 'A guided tour of what you get, in about six minutes.');
  await wait(1500);
  const timeline = [];
  for (let i = 0; i < beats.length; i++) {
    if (only !== null && i >= only) break;
    const b = beats[i];
    const start = Date.now();
    await page.evaluate(([ch, t]) => window.__cap(ch, t), [b.ch, b.cap || b.say]);
    timeline.push({ i, at: (start - t0) / 1000 });
    try { await b.act(); } catch (e) { console.log('beat', i, 'error:', e.message.split('\n')[0]); }
    const need = dur[i] * 1000 + 450 - (Date.now() - start);
    if (need > 0) await wait(need);
    console.log(i, ((Date.now() - t0) / 1000).toFixed(1));
  }
  await page.evaluate(() => window.__cap(null, null));
  await wait(1500);
  const end = (Date.now() - t0) / 1000;
  const vpath = await page.video().path();
  await ctx.close(); await browser.close();
  fs.renameSync(vpath, path.join(DIR, 'video.webm'));
  fs.writeFileSync(path.join(DIR, 'timeline.json'), JSON.stringify({ timeline, end }));
  console.log('done', end);
})();
