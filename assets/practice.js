/* GreenKit English：練習頁（practice.html?u=單元&m=s 句型練習 / m=l 聽力練習）。
   每回從題庫隨機抽 15 題；答錯第一次給提示和課本／習作頁碼，第二次直接看答案。
   畫面：上方是 15 顆踏腳石的小路（角色一題走一步，答對種花）；每題由一位角色出題，題目是它的對話框；
   答對噴花瓣、花飛進右上角的花朵數；連續答對有全員歡呼；成績是一座花園。 */
(() => {
  const { $, esc, shuffle, pick, sayEn, stopSay, ICON, pikImg, hop, CREW, PETAL, flowerSVG, sproutSVG, LISTEN, PER_ROUND } = GK;
  const P = new URLSearchParams(location.search);
  const U = GK.UNITS.includes(+P.get('u')) ? +P.get('u') : 1;
  const LISTEN_MODE = P.get('m') === 'l';
  const MODE_NAME = LISTEN_MODE ? '聽力練習' : '句型練習';
  const HOSTS = CREW.filter(k => k !== 'red');   /* 紅色角色負責答錯時的提示 */
  const BADGE = ['#FFD43B', '#3F86E6', '#8A5CC9', '#F9A8CB'];
  const main = $('#main');
  let unit = null, list = [], idx = 0, score = 0, review = [], marks = [], streak = 0, hosts = [], walker = 'wing';
  let it = null, tries = 0, finished = false;

  /* ---------- 頂列：聲音、花朵數、小路 ---------- */
  const sndBtn = $('#soundBtn');
  function renderSound() { sndBtn.innerHTML = (GK.soundOn ? ICON.spk : ICON.mute) + `<span>朗讀 ${GK.soundOn ? '開' : '關'}</span>`; sndBtn.setAttribute('aria-pressed', GK.soundOn); }
  sndBtn.onclick = () => { GK.setSound(!GK.soundOn); renderSound(); };
  renderSound();
  $('#homeBtn').innerHTML = ICON.home + '<span>回首頁</span>';
  $('#homeBtn').addEventListener('click', stopSay);
  const bloomEl = $('#bloom');
  function renderBloom(pop) {
    bloomEl.innerHTML = flowerSVG('#F9B3CC') + `<b>${score}</b>`;
    if (pop && !GK.reduceMotion) { bloomEl.classList.remove('pop'); void bloomEl.offsetWidth; bloomEl.classList.add('pop'); }
  }
  function renderTrail() {
    const n = list.length;
    if (!n) { $('#trail').innerHTML = ''; return; }
    const pos = Math.min(idx, n - 1);
    $('#trail').innerHTML = `<div class="path"></div>${list.map((_, i) => {
      const m = marks[i];
      return `<span class="stone ${i === idx ? 'cur' : ''} ${m ? 'done' : ''}" style="left:${(i + .5) / n * 100}%">${m ? (m === 'sprout' ? sproutSVG() : flowerSVG(m)) : ''}</span>`;
    }).join('')}<span class="walker" style="left:${(pos + .5) / n * 100}%">${pikImg(walker)}</span>
      <span class="trail-text">${idx < n ? `第 ${idx + 1} / ${n} 題` : '完成！'}</span>`;
  }

  /* ---------- 開始 ---------- */
  GK.loadUnit(U).then(u => {
    unit = u;
    document.title = `Unit ${U} ${MODE_NAME}｜GreenKit English`;
    $('#unitName').textContent = u.title;
    $('#modeName').textContent = MODE_NAME;
    const total = u.sections.reduce((s, x) => s + x.items.filter(i => GK.isListen(i) === LISTEN_MODE).length, 0);
    main.innerHTML = `<section class="card start">
      <div class="crew hopper big">${shuffle(CREW).map(k => pikImg(k)).join('')}</div>
      <p class="kicker">${esc(u.title)}</p>
      <h1>${MODE_NAME}</h1>
      <p class="sub">走完 ${Math.min(PER_ROUND, total)} 顆石頭，第一次就答對會種出一朵花！<br>${esc(u.scope)}・題庫 ${total} 題，每次都不一樣。${LISTEN_MODE ? '<br><b>請把聲音打開，點角色可以再聽一次。</b>' : ''}</p>
      <button class="btn primary big" id="goBtn">${ICON.next}出發！</button>
    </section>`;
    $('#goBtn').onclick = () => { if (LISTEN_MODE && !GK.soundOn) { GK.setSound(true); renderSound(); } newRound(); };
  }).catch(() => {
    main.innerHTML = `<section class="card start"><h1>題庫讀不到</h1><p class="sub">請用網址打開這個網站（不要直接點兩下 html 檔），或稍後再試一次。</p><a class="btn" href="index.html">${ICON.home}回首頁</a></section>`;
  });

  function newRound() {
    list = GK.draw(unit, LISTEN_MODE); idx = 0; score = 0; review = []; marks = []; streak = 0;
    walker = pick(CREW);
    hosts = [];
    while (hosts.length < list.length) hosts.push(...shuffle(HOSTS));
    renderBloom();
    show();
  }

  /* ---------- 題目 ---------- */
  const fillBlank = (q, a) => q.replace('___', a);
  const fullSentence = item => item.type === '選擇' && item.q.includes('___') ? fillBlank(item.q, item.a) : item.type === '重組' ? item.a.split(' / ').join(' ') : item.type === '是非' ? item.q : item.a;
  /* Q: … A: … 分兩行；___ 變成空格 */
  function qHTML(q, ans) {
    const blank = ans != null ? `<span class="blank filled">${esc(ans)}</span>` : '<span class="blank">&nbsp;</span>';
    const one = s => esc(s).replace('___', '\u0000').replace('\u0000', blank);
    const parts = q.split(/\s+(?=A:\s)/);
    if (parts.length === 2 && /^Q:\s/.test(parts[0])) return `<span class="qa"><b>Q:</b> ${one(parts[0].slice(2).trim())}</span><span class="qa"><b>A:</b> ${one(parts[1].slice(2).trim())}</span>`;
    return one(q);
  }
  const passageHTML = sec => sec.passage.filter(l => l.trim()).map(l => `<p>${esc(l).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`).join('');
  const pagePill = (sec, self) => sec.page ? `<span class="page-pill">${ICON.book}${self ? '相關內容在' : '翻到'} ${esc(sec.page)}</span>` : '';
  /* 自編題：課本和習作上沒有這一題，是額外練習 */
  const SELF_TAG = '<span class="src-tag">自編練習</span>';
  const selfNote = item => item.self ? `<p class="self-note">${ICON.book}這題是額外練習，課本和習作上沒有這一題${item.sec.page ? `；用到的內容在 ${esc(item.sec.page)}` : ''}。</p>` : '';
  const hostEl = () => main.querySelector('.host .pik');

  function show() {
    stopSay();
    renderTrail();
    if (idx >= list.length) { result(); return; }
    it = list[idx]; tries = 0; finished = false;
    GK.cur = it;   /* 給自動測試用 */
    const sec = it.sec, lis = GK.isListen(it), host = hosts[idx];
    let prompt = '', body = '';
    if (lis) {
      prompt = LISTEN[it.type];
      body = `<div class="listen"><button class="btn primary big" data-a="play">${ICON.spk}播放</button><button class="btn" data-a="slow">${ICON.turtle}慢慢念</button></div><p class="heard" hidden></p>`;
    } else if (it.type === '選擇') {
      prompt = it.q.includes('___') ? '選出正確的答案，填進空格' : '選出正確的答案';
      body = `<p class="sentence" id="sent">${qHTML(it.q)}</p>`;
    } else if (it.type === '挑正確') {
      prompt = '哪一句是對的？';
      body = it.q ? `<p class="zh">${esc(it.q)}</p>` : '';
    } else if (it.type === '重組') {
      prompt = '照順序點字卡，排出正確的句子';
      body = (it.q ? `<p class="zh">${esc(it.q)}</p>` : '') + '<div class="slots" id="slots"></div>';
    } else if (it.type === '拼字') {
      prompt = '照順序點字母，拼出英文';
      body = `<p class="zh big">${esc(it.q)} <button class="icon-btn" data-a="say" aria-label="聽發音">${ICON.spk}</button></p><div class="slots spell" id="slots"></div>`;
    } else if (it.type === '是非') {
      prompt = '這句話對不對？';
      body = `<p class="sentence">${esc(it.q)}</p>`;
    }
    const passage = sec.passage.length ? `<details class="passage" open><summary>${ICON.book}看文章</summary><div class="ptext">${passageHTML(sec)}</div></details>` : '';
    main.innerHTML = `<section class="scene-q" style="--hc:${GK.PETAL[host]}">
      <div class="host hopper ${lis ? 'speaker' : ''}" ${lis ? 'data-a="play" role="button" aria-label="再聽一次"' : ''}>
        ${pikImg(host, 'enter')}
        ${lis ? `<span class="host-hint">${ICON.spk}點我再聽</span>` : ''}
      </div>
      <div class="card q">
        <div class="qhead"><span class="tags"><span class="sec-tag">${esc(sec.name)}</span>${it.self ? SELF_TAG : ''}</span><span class="qnum">${idx + 1} / ${list.length}</span></div>
        ${selfNote(it)}
        ${passage}
        <p class="prompt">${esc(prompt)}</p>
        ${body}
        <div class="answers" id="answers"></div>
        <div class="feedback" id="fb" hidden></div>
        <div class="nav"><button class="btn primary big" id="nextBtn" hidden>${ICON.next}${idx + 1 < list.length ? '下一題' : '看我的花園'}</button></div>
      </div>
    </section>`;
    $('#nextBtn').onclick = () => { idx++; show(); window.scrollTo({ top: 0, behavior: GK.reduceMotion ? 'auto' : 'smooth' }); };
    main.querySelector('.scene-q').addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'play') speak(it.q);
      else if (a === 'slow') speak(it.q, true);
      else if (a === 'say') speak(it.type === '拼字' ? it.a : b.dataset.t);
    });
    if (it.type === '重組' || it.type === '拼字') tiles();
    else options();
    if (lis) setTimeout(() => speak(it.q), 650);
  }
  /* 念的時候出題角色會一直跳 */
  function speak(t, slow) {
    const h = hostEl();
    const ok = sayEn(t, slow, () => h && h.classList.remove('talking'));
    if (ok) { if (h) h.classList.add('talking'); }
    else fb('red', GK.soundOn ? '這台裝置不能朗讀英文。' : '朗讀是關的，先按右上角「朗讀」打開。');
  }

  /* ---------- 選擇、挑正確、是非、聽力 ---------- */
  function options() {
    const box = $('#answers');
    const tf = it.type === '是非';
    const opts = tf ? ['對', '錯'] : shuffle([it.a, ...it.others]);
    box.className = 'answers' + (tf ? ' tf' : opts.some(o => o.length > 22) ? ' stack' : '');
    box.innerHTML = opts.map((o, i) => `<button class="opt" data-o="${esc(o)}" style="--bc:${tf ? (o === '對' ? '#2f9e44' : '#d6453a') : BADGE[i % 4]}">
      <span class="badge">${tf ? (o === '對' ? 'O' : 'X') : 'ABCD'[i]}</span><span class="otext">${esc(o)}</span></button>`).join('');
    box.onclick = e => {
      const b = e.target.closest('.opt'); if (!b || finished || b.disabled) return;
      if (b.dataset.o === it.a) { b.classList.add('right'); right(b); }
      else {
        b.classList.add('wrong'); b.disabled = true; shake(b); tries++;
        if (tries >= (tf || opts.length <= 2 ? 1 : 2)) reveal(() => box.querySelector(`.opt[data-o="${CSS.escape(it.a)}"]`).classList.add('right'));
        else hint();
      }
    };
  }

  /* ---------- 重組、拼字：照順序點 ---------- */
  function tiles() {
    const spell = it.type === '拼字';
    const target = spell ? it.a.replace(/\s+/g, '').split('') : it.a.split(' / ');
    let pool = target.map((t, i) => ({ t, id: i }));
    if (spell) { const az = 'abcdefghijklmnopqrstuvwxyz'; for (let k = 0; k < 2; k++) pool.push({ t: pick(az), id: 100 + k }); }
    pool = shuffle(pool).map((p, i) => ({ ...p, c: BADGE[i % 4] }));
    let placed = [];
    const slots = $('#slots'), box = $('#answers');
    box.className = 'answers tiles' + (spell ? ' letters' : '');
    function draw(m) {
      if (spell) {
        let k = 0;
        slots.innerHTML = it.a.split(/\s+/).map(w => `<span class="word">${[...w].map(() => { const p = placed[k], mk = m ? m[k] : ''; const h = `<button class="slot ${p ? 'full' : ''} ${mk || ''}" data-k="${k}" ${p ? `style="--tc:${p.c}"` : ''}>${p ? esc(p.t) : ''}</button>`; k++; return h; }).join('')}</span>`).join('');
      } else {
        slots.innerHTML = placed.length ? placed.map((p, k) => `<button class="slot full ${m ? m[k] : ''}" data-k="${k}" style="--tc:${p.c || '#3f9cc8'}">${esc(p.t)}</button>`).join('') : '<span class="slot-hint">點下面的字卡，放到這裡</span>';
      }
      box.innerHTML = pool.map(p => `<button class="tile" data-id="${p.id}" style="--tc:${p.c}" ${placed.includes(p) ? 'disabled' : ''}>${esc(p.t)}</button>`).join('');
    }
    draw();
    box.onclick = e => {
      const b = e.target.closest('.tile'); if (!b || finished || b.disabled) return;
      const p = pool.find(x => x.id === +b.dataset.id); if (placed.includes(p)) return;
      placed.push(p); draw();
      if (placed.length === target.length) check();
    };
    slots.onclick = e => {
      const b = e.target.closest('.slot.full'); if (!b || finished) return;
      placed.splice(+b.dataset.k, 1); draw();
    };
    function check() {
      const ok = placed.map((p, k) => p.t.toLowerCase() === target[k].toLowerCase());
      if (ok.every(Boolean)) { draw(ok.map(() => 'right')); right(slots); return; }
      tries++;
      draw(ok.map(v => v ? 'right' : 'wrong')); shake(slots);
      if (tries >= 2) {
        reveal(() => { placed = target.map((t, k) => ({ t, id: -1 - k, c: '#2f9e44' })); draw(target.map(() => 'right')); box.innerHTML = ''; });
        return;
      }
      hint();
      finished = true;   /* 等一下再讓孩子改 */
      setTimeout(() => { placed = placed.slice(0, ok.indexOf(false)); finished = false; draw(); }, 1100);
    }
  }

  /* ---------- 特效 ---------- */
  function shake(el) { if (GK.reduceMotion) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function center(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  /* 從答對的地方噴出花瓣 */
  function burst(el) {
    if (GK.reduceMotion) return;
    const [x, y] = center(el), cols = Object.values(PETAL);
    for (let i = 0; i < 16; i++) {
      const d = document.createElement('i'); d.className = 'petal';
      const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 90;
      d.style.cssText = `left:${x}px;top:${y}px;background:${pick(cols)};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r - 40}px;--rot:${Math.random() * 540 - 270}deg`;
      document.body.appendChild(d); setTimeout(() => d.remove(), 950);
    }
  }
  /* 一朵花從答對的地方飛到右上角的花朵數 */
  function flyFlower(el, color) {
    if (GK.reduceMotion) { renderBloom(true); return; }
    const [x, y] = center(el), [tx, ty] = center(bloomEl);
    const f = document.createElement('div'); f.className = 'fly'; f.innerHTML = flowerSVG(color);
    f.style.cssText = `left:${x}px;top:${y}px`;
    document.body.appendChild(f);
    requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transform = `translate(${tx - x}px,${ty - y}px) scale(.55) rotate(360deg)`; f.style.opacity = '.9'; }));
    setTimeout(() => { f.remove(); renderBloom(true); }, 820);
  }
  /* 連續答對：全員出來歡呼 */
  function cheer(n) {
    const c = $('#cheer');
    c.innerHTML = `<div class="cheer-box"><div class="crew">${shuffle(CREW).slice(0, 5).map(k => pikImg(k, 'jump')).join('')}</div><b>連續答對 ${n} 題！</b></div>`;
    c.hidden = false;
    clearTimeout(cheer.t); cheer.t = setTimeout(() => { c.hidden = true; }, 1700);
  }

  /* ---------- 回饋 ---------- */
  function fb(who, html) {
    const f = $('#fb'); f.hidden = false;
    f.className = 'feedback ' + (who === 'red' ? 'bad' : 'good');
    f.innerHTML = `<div class="hopper">${pikImg(who, 'enter')}</div><div class="bubble">${html}</div>`;
  }
  const ruleText = () => esc(it.hint || it.sec.hint);
  function afterAnswer() {
    finished = true;
    const s = fullSentence(it);
    if (it.type === '選擇' && it.q.includes('___')) $('#sent').innerHTML = qHTML(it.q, it.a);
    if (GK.isListen(it)) { const h = main.querySelector('.heard'); h.hidden = false; h.innerHTML = `剛剛念的是：<b>${esc(it.q)}</b>`; }
    if (!GK.isListen(it) && /[A-Za-z]/.test(s)) {
      $('#fb').querySelector('.bubble').insertAdjacentHTML('beforeend', `<button class="btn small" data-a="say" data-t="${esc(s)}">${ICON.spk}聽這句</button>`);
    }
    renderTrail();
    $('#nextBtn').hidden = false; $('#nextBtn').focus({ preventScroll: true });
    $('#nextBtn').scrollIntoView({ block: 'nearest', behavior: GK.reduceMotion ? 'auto' : 'smooth' });
  }
  function right(el) {
    const h = hostEl(); if (h) { h.classList.remove('enter'); hop(h); }
    if (tries === 0) {
      score++; streak++;
      const col = PETAL[hosts[idx]];
      marks[idx] = col;
      burst(el); flyFlower(el, col);
      fb(hosts[idx], `<b>${pick(['答對了！', '太棒了！', '完全正確！', '好厲害！', '種出一朵花！'])}</b>`);
      if (streak >= 3 && (streak === 3 || streak % 5 === 0)) { const s = streak; setTimeout(() => cheer(s), 500); }
    } else {
      streak = 0; marks[idx] = 'sprout'; review.push(it);
      fb(hosts[idx], '<b>對了！改過來就學會了！</b><span>長出一棵小芽。</span>');
    }
    afterAnswer();
  }
  function hint() {
    streak = 0;
    fb('red', `<b>再想一想！</b><span>${ruleText()}</span>${pagePill(it.sec, it.self)}`);
  }
  function reveal(mark) {
    streak = 0; review.push(it); marks[idx] = 'sprout'; mark();
    fb('red', `<b>正確答案是：${esc(it.type === '重組' ? it.a.split(' / ').join(' ') : it.a)}</b><span>${ruleText()}</span>${pagePill(it.sec, it.self)}`);
    afterAnswer();
  }

  /* ---------- 成績：我的花園 ---------- */
  function result() {
    clearTimeout(cheer.t); $("#cheer").hidden = true;
    const n = list.length, pct = score / n;
    const stars = pct >= .9 ? 3 : pct >= .7 ? 2 : 1;
    const msg = score === n ? '全部第一次就答對，花園開滿了花！' : pct >= .8 ? '花園好漂亮！把下面的題目再看一次，就能開滿花！' : pct >= .6 ? '不錯喔！翻翻課本，再練一次會開更多花！' : '小芽也會長大！照下面的頁碼翻課本看一看，再練一次！';
    const pages = [...new Set(review.map(x => x.sec.page).filter(Boolean))];
    const other = LISTEN_MODE ? 's' : 'l';
    main.innerHTML = `<section class="card result">
      <div class="garden">
        <div class="crew hopper">${shuffle(CREW).map(k => pikImg(k, 'jump')).join('')}</div>
        <div class="beds">${marks.map((m, i) => `<span class="bed" style="animation-delay:${i * 70}ms">${m === 'sprout' || !m ? sproutSVG() : flowerSVG(m)}</span>`).join('')}</div>
      </div>
      <p class="stars">${[0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}">${ICON.star}</i>`).join('')}</p>
      <h1>種出 ${score} 朵花（${score} / ${n} 題第一次就答對）</h1>
      <p class="sub">${msg}</p>
      ${pages.length ? `<div class="go-pages"><b>回去翻一翻：</b>${pages.map(p => `<span class="page-pill">${ICON.book}${esc(p)}</span>`).join('')}</div>` : ''}
      ${review.length ? `<h2>要再看一次的題目</h2><ol class="review">${review.map(x => `<li><span class="sec-tag">${esc(x.sec.name)}</span>${x.self ? SELF_TAG : ''}
        <p class="rq">${GK.isListen(x) ? '聽到：' + esc(x.q) : x.type === '重組' || x.type === '拼字' ? esc(x.q || '') : qHTML(x.q)}</p>
        <p class="ra">正確答案：<b>${esc(x.type === '重組' ? x.a.split(' / ').join(' ') : x.a)}</b></p>
        ${x.sec.page ? `<p class="rp">${ICON.book}${esc(x.sec.page)}</p>` : ''}</li>`).join('')}</ol>` : ''}
      <div class="nav center">
        <button class="btn primary big" id="againBtn">${ICON.again}再練一次（換新題目）</button>
        <a class="btn" href="practice.html?u=${U}&m=${other}">${LISTEN_MODE ? '去句型練習' : '去聽力練習'}</a>
        <a class="btn" href="index.html">${ICON.home}回首頁</a>
      </div>
    </section>`;
    $('#againBtn').onclick = () => { newRound(); window.scrollTo(0, 0); };
  }
})();
