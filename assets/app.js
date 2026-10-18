/* GreenKit English：共用程式（讀題庫 .md、隨機出題、作答、朗讀、音效）。
   題庫在 banks/unit-N.md，寫法見 banks/README.md。首頁 index.html 和練習頁 practice.html 都載入這個檔。 */
const GK = (() => {
  const VER = '1.2.0', DATE = '2026-10-18';
  const PER_ROUND = 15;
  const UNITS = [1, 2, 3];
  const CREW = ['yellow', 'red', 'blue', 'purple', 'white', 'rock', 'wing', 'ice'];
  const LISTEN = { '聽單字': '聽一聽，是哪一個單字？', '聽句子': '聽一聽，你聽到哪一句？', '聽意思': '聽一聽，這句話是什麼意思？', '聽數字': '聽一聽，是多少？', '聽問答': '聽問題，選出最好的回答。' };
  const TYPES = ['選擇', '挑正確', '重組', '拼字', '是非', ...Object.keys(LISTEN)];

  const $ = s => document.querySelector(s);
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 讀題庫 ---------- */
  function parse(md) {
    const unit = { title: '', scope: '', sections: [] };
    let sec = null, inComment = false;
    for (const raw of md.split(/\r?\n/)) {
      const line = raw.trim();
      if (inComment) { if (line.includes('-->')) inComment = false; continue; }
      if (line.startsWith('<!--')) { if (!line.includes('-->')) inComment = true; continue; }
      if (/^# /.test(line)) { unit.title = line.slice(2).trim(); continue; }
      if (/^範圍[:：]/.test(line)) { unit.scope = line.replace(/^範圍[:：]\s*/, '').split('。')[0]; continue; }
      if (/^## /.test(line)) { sec = { name: line.slice(3).trim(), page: '', hint: '', passage: [], items: [] }; unit.sections.push(sec); continue; }
      if (!sec) continue;
      let m;
      if ((m = line.match(/^-\s*頁碼[:：]\s*(.*)$/))) { sec.page = m[1].trim(); continue; }
      if ((m = line.match(/^-\s*提示[:：]\s*(.*)$/))) { sec.hint = m[1].trim(); continue; }
      if (line.startsWith('>')) { sec.passage.push(line.replace(/^>\s?/, '')); continue; }
      if (line.startsWith('|')) {
        const c = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
        if (!TYPES.includes(c[0]) || !c[2]) continue;   /* 表頭、分隔線、不認得的題型 */
        sec.items.push({ type: c[0], q: c[1] || '', a: c[2], others: (c[3] || '').split(' / ').map(s => s.trim()).filter(Boolean), hint: c[4] || '', self: c[5] === '自編', sec });
      }
    }
    unit.sections = unit.sections.filter(s => s.items.length);
    return unit;
  }
  const isListen = it => it.type.startsWith('聽');
  async function loadUnit(n) {
    const r = await fetch(`banks/unit-${n}.md?v=${VER}-${Math.floor(Date.now() / 600000)}`);   /* 每 10 分鐘換一次，改了題庫很快就看得到 */
    if (!r.ok) throw new Error('fetch');
    return parse(await r.text());
  }
  /* 從各句型平均抽題：每一輪每個句型抽一題（句型順序隨機），抽滿為止；聽力題改成依題型平均抽 */
  function draw(unit, listen, n = PER_ROUND) {
    const all = unit.sections.flatMap(s => s.items.filter(it => isListen(it) === listen));
    const keyOf = it => listen ? it.type : it.sec;
    const pools = [...new Set(all.map(keyOf))].map(k => shuffle(all.filter(it => keyOf(it) === k)));
    const out = [];
    while (out.length < n && pools.some(p => p.length)) {
      for (const p of shuffle(pools)) { if (out.length >= n) break; if (p.length) out.push(p.pop()); }
    }
    return shuffle(out);
  }

  /* ---------- 聲音 ---------- */
  let soundOn = true, actx = null, enVoice = null;
  try { soundOn = localStorage.getItem('gk-sound') !== 'off'; } catch (e) {}
  function setSound(on) { soundOn = on; try { localStorage.setItem('gk-sound', on ? 'on' : 'off'); } catch (e) {} if (!on) stopSay(); }
  function tone(freqs, dur = .12, type = 'sine', vol = .16) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime;
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + i * dur);
        g.gain.linearRampToValueAtTime(vol, t0 + i * dur + .02);
        g.gain.exponentialRampToValueAtTime(.001, t0 + i * dur + dur * 1.6);
        o.connect(g).connect(actx.destination);
        o.start(t0 + i * dur); o.stop(t0 + i * dur + dur * 1.8);
      });
    } catch (e) {}
  }
  const sfx = {
    good: () => tone([660, 880, 1175], .1, 'triangle'),
    bad: () => tone([240, 190], .15, 'square', .06),
    pop: () => tone([560 + Math.random() * 240], .06, 'triangle', .1),
    win: () => tone([523, 659, 784, 1046, 1318], .1, 'triangle')
  };
  function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume && actx.resume(); } catch (e) {} }
  /* 系統的「玩具聲音」不拿來念課文 */
  const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|kathy|pipe|grandma|grandpa|rocko|shelley|eddy|flo|reed|sandy/i;
  function pickEnVoice() {
    if (!('speechSynthesis' in window)) return;
    const good = v => /natural|premium|enhanced|neural/i.test(v.name);
    const rank = v => (/en[-_]US/i.test(v.lang) ? 0 : /en[-_](GB|AU|CA)/i.test(v.lang) ? 2 : 4) - (good(v) ? 1 : 0) - (/samantha|ava|allison|susan|zira|aria|jenny|google us/i.test(v.name) ? .5 : 0);
    enVoice = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang) && !NOVELTY.test(v.name)).sort((x, y) => rank(x) - rank(y))[0] || null;
  }
  if ('speechSynthesis' in window) { pickEnVoice(); try { speechSynthesis.addEventListener('voiceschanged', pickEnVoice); } catch (e) {} }
  /* 英文朗讀：單字 0.8、句子 0.9；slow 再慢一點 */
  function sayEn(text, slow, onend) {
    if (!soundOn || !('speechSynthesis' in window)) return false;
    try {
      speechSynthesis.cancel();
      const t = String(text).replace(/\$([\d,]+)/g, '$1 dollars').replace(/___/g, ' blank ').replace(/\*\*/g, '')
        .replace(/[（(][^）)]*[㐀-鿿][^）)]*[）)]/g, ' ').replace(/[㐀-鿿（）]/g, ' ');   /* 題目裡的中文提示不念 */
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'en-US'; if (enVoice) u.voice = enVoice;
      u.rate = (/\s/.test(t.trim()) ? .9 : .8) * (slow ? .7 : 1);
      if (onend) { let fired = false; const f = () => { if (!fired) { fired = true; onend(); } }; u.onend = f; u.onerror = f; setTimeout(f, 1500 + t.length * 120); }
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function stopSay() { try { speechSynthesis.cancel(); } catch (e) {} }

  const ICON = {
    spk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.6 8.6 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5M6 10v10h4.5v-6h3v6H18V10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5C5.5 4 8.5 4 12 6c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 6v13.5" stroke="currentColor" stroke-width="2"/></svg>',
    next: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1l9 5-9 5z" fill="currentColor"/></svg>',
    again: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M3 3v5h5" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    turtle: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="11" cy="13" rx="7" ry="5" fill="currentColor"/><circle cx="19.5" cy="12" r="2.2" fill="currentColor"/><path d="M6 17.5l-1 2M16 17.5l1 2M4 13H2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="currentColor"/></svg>'
  };
  /* 答對的花（第一次就答對）和小芽（改過來才答對） */
  const PETAL = { yellow: '#FFE066', red: '#FF9A84', blue: '#93C1FF', purple: '#C6A6F0', white: '#FFFFFF', rock: '#FFE08A', wing: '#F9B3CC', ice: '#B9E9FA' };
  const flowerSVG = (c = '#F9B3CC') => `<svg class="flower" viewBox="-20 -20 40 40" aria-hidden="true">${[0, 72, 144, 216, 288].map(a => `<circle cx="0" cy="-9" r="7.5" fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width="1.2" transform="rotate(${a})"/>`).join('')}<circle r="5.5" fill="#FFC93C" stroke="#D9A21F" stroke-width="1.2"/></svg>`;
  const sproutSVG = () => '<svg class="flower" viewBox="-20 -20 40 40" aria-hidden="true"><path d="M0,16 V-2" stroke="#3C8C37" stroke-width="3" stroke-linecap="round"/><path d="M0,2 C-4,-8 -14,-8 -16,-4 C-12,2 -4,4 0,2Z" fill="#78C84A" stroke="#3E8E2C" stroke-width="1.2"/><path d="M0,-2 C4,-12 14,-12 16,-8 C12,-2 4,0 0,-2Z" fill="#78C84A" stroke="#3E8E2C" stroke-width="1.2"/></svg>';
  CREW.forEach(k => { new Image().src = `assets/pikmin/${k}.webp`; });   /* 先載入，答題時角色馬上出現 */
  const pikImg = (k, cls = '') => `<img class="pik ${cls}" src="assets/pikmin/${k}.webp" alt="" draggable="false">`;
  /* 點一下角色會跳起來 */
  document.addEventListener('click', e => {
    const p = e.target.closest && e.target.closest('.hopper .pik'); if (!p) return;
    hop(p); sfx.pop();
  });
  function hop(el) { if (reduceMotion) return; el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); }

  return { VER, DATE, PER_ROUND, UNITS, CREW, PETAL, flowerSVG, sproutSVG, LISTEN, $, esc, shuffle, pick, parse, loadUnit, draw, isListen, sfx, unlockAudio, sayEn, stopSay, setSound, get soundOn() { return soundOn; }, ICON, pikImg, hop, reduceMotion };
})();
