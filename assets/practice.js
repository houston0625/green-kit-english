/* GreenKit English：練習頁（practice.html?u=單元&m=s 句型練習 / m=l 聽力練習）。
   每回從題庫隨機抽 15 題；答錯第一次給提示和課本／習作頁碼，第二次直接看答案。 */
(() => {
  const { $, esc, shuffle, pick, sfx, sayEn, stopSay, ICON, pikImg, hop, CREW, LISTEN, PER_ROUND } = GK;
  const P = new URLSearchParams(location.search);
  const U = GK.UNITS.includes(+P.get('u')) ? +P.get('u') : 1;
  const LISTEN_MODE = P.get('m') === 'l';
  const MODE_NAME = LISTEN_MODE ? '聽力練習' : '句型練習';
  const main = $('#main');
  let unit = null, list = [], idx = 0, score = 0, review = [];
  let it = null, tries = 0, finished = false;

  /* ---------- 頂列 ---------- */
  const sndBtn = $('#soundBtn');
  function renderSound() { sndBtn.innerHTML = (GK.soundOn ? ICON.spk : ICON.mute) + `<span>聲音 ${GK.soundOn ? '開' : '關'}</span>`; sndBtn.setAttribute('aria-pressed', GK.soundOn); }
  sndBtn.onclick = () => { GK.setSound(!GK.soundOn); renderSound(); };
  renderSound();
  $('#homeBtn').innerHTML = ICON.home + '<span>回首頁</span>';
  $('#homeBtn').addEventListener('click', stopSay);

  function setProgress() {
    const n = list.length || PER_ROUND, done = Math.min(idx, n);
    $('#progText').textContent = list.length && idx < n ? `第 ${idx + 1} / ${n} 題` : '';
    $('#progBar').style.width = (done / n * 100) + '%';
  }

  /* ---------- 開始 ---------- */
  GK.loadUnit(U).then(u => {
    unit = u;
    document.title = `Unit ${U} ${MODE_NAME}｜GreenKit English`;
    $('#unitName').textContent = u.title;
    $('#modeName').textContent = MODE_NAME;
    const total = u.sections.reduce((s, x) => s + x.items.filter(i => GK.isListen(i) === LISTEN_MODE).length, 0);
    main.innerHTML = `<section class="card start">
      <div class="crew hopper">${shuffle(CREW).slice(0, 3).map(k => pikImg(k)).join('')}</div>
      <p class="kicker">${esc(u.title)}</p>
      <h1>${MODE_NAME}</h1>
      <p class="sub">${esc(u.scope)}<br>題庫 ${total} 題，每次隨機出 ${Math.min(PER_ROUND, total)} 題。${LISTEN_MODE ? '<br><b>請把聲音打開，仔細聽！</b>' : ''}</p>
      <button class="btn primary big" id="goBtn">${ICON.next}開始練習</button>
    </section>`;
    $('#goBtn').onclick = () => { GK.unlockAudio(); if (LISTEN_MODE && !GK.soundOn) { GK.setSound(true); renderSound(); } newRound(); };
  }).catch(() => {
    main.innerHTML = `<section class="card start"><h1>題庫讀不到</h1><p class="sub">請用網址打開這個網站（不要直接點兩下 html 檔），或稍後再試一次。</p><a class="btn" href="index.html">${ICON.home}回首頁</a></section>`;
  });

  function newRound() {
    list = GK.draw(unit, LISTEN_MODE); idx = 0; score = 0; review = [];
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
  const pagePill = sec => sec.page ? `<span class="page-pill">${ICON.book}翻到 ${esc(sec.page)}</span>` : '';

  function show() {
    stopSay();
    if (idx >= list.length) { result(); return; }
    it = list[idx]; tries = 0; finished = false;
    GK.cur = it;   /* 給自動測試用 */
    setProgress();
    const sec = it.sec, lis = GK.isListen(it);
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
    main.innerHTML = `<section class="card q">
      <div class="qhead"><span class="sec-tag">${esc(sec.name)}</span><span class="qnum">${idx + 1} / ${list.length}</span></div>
      ${passage}
      <p class="prompt">${esc(prompt)}</p>
      ${body}
      <div class="answers" id="answers"></div>
      <div class="feedback" id="fb" hidden></div>
      <div class="nav"><button class="btn primary" id="nextBtn" hidden>${ICON.next}${idx + 1 < list.length ? '下一題' : '看成績'}</button></div>
    </section>`;
    $('#nextBtn').onclick = () => { idx++; show(); window.scrollTo({ top: 0, behavior: GK.reduceMotion ? 'auto' : 'smooth' }); };
    main.querySelector('.q').addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'play') sayOrWarn(it.q);
      else if (a === 'slow') sayOrWarn(it.q, true);
      else if (a === 'say') sayOrWarn(it.type === '拼字' ? it.a : b.dataset.t);
    });
    if (it.type === '重組' || it.type === '拼字') tiles();
    else options();
    if (lis) setTimeout(() => sayOrWarn(it.q), 350);
  }
  function sayOrWarn(t, slow) {
    if (!sayEn(t, slow)) fb('red', GK.soundOn ? '這台裝置不能朗讀英文。' : '聲音是關的，先按右上角「聲音」打開。');
  }

  /* ---------- 選擇、挑正確、是非、聽力 ---------- */
  function options() {
    const box = $('#answers');
    const opts = it.type === '是非' ? ['對', '錯'] : shuffle([it.a, ...it.others]);
    box.className = 'answers' + (it.type === '是非' ? ' tf' : opts.some(o => o.length > 22) ? ' stack' : '');
    box.innerHTML = opts.map(o => `<button class="opt" data-o="${esc(o)}">${it.type === '是非' ? `<span class="tf-mark">${o === '對' ? 'O' : 'X'}</span>` : ''}${esc(o)}</button>`).join('');
    box.onclick = e => {
      const b = e.target.closest('.opt'); if (!b || finished || b.disabled) return;
      if (b.dataset.o === it.a) { b.classList.add('right'); right(); }
      else {
        b.classList.add('wrong'); b.disabled = true; shake(b); tries++;
        if (tries >= (it.type === '是非' || opts.length <= 2 ? 1 : 2)) reveal(() => box.querySelector(`.opt[data-o="${CSS.escape(it.a)}"]`).classList.add('right'));
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
    pool = shuffle(pool);
    let placed = [];
    const slots = $('#slots'), box = $('#answers');
    box.className = 'answers tiles' + (spell ? ' letters' : '');
    function draw(marks) {
      if (spell) {
        let k = 0;
        slots.innerHTML = it.a.split(/\s+/).map(w => `<span class="word">${[...w].map(() => { const p = placed[k], m = marks ? marks[k] : ''; const h = `<button class="slot ${p ? 'full' : ''} ${m || ''}" data-k="${k}">${p ? esc(p.t) : ''}</button>`; k++; return h; }).join('')}</span>`).join('');
      } else {
        slots.innerHTML = placed.length ? placed.map((p, k) => `<button class="slot full ${marks ? marks[k] : ''}" data-k="${k}">${esc(p.t)}</button>`).join('') : '<span class="slot-hint">點下面的字卡，放到這裡</span>';
      }
      box.innerHTML = pool.map(p => `<button class="tile" data-id="${p.id}" ${placed.includes(p) ? 'disabled' : ''}>${esc(p.t)}</button>`).join('');
    }
    draw();
    box.onclick = e => {
      const b = e.target.closest('.tile'); if (!b || finished || b.disabled) return;
      const p = pool.find(x => x.id === +b.dataset.id); if (placed.includes(p)) return;
      placed.push(p); sfx.pop(); draw();
      if (placed.length === target.length) check();
    };
    slots.onclick = e => {
      const b = e.target.closest('.slot.full'); if (!b || finished) return;
      placed.splice(+b.dataset.k, 1); draw();
    };
    function check() {
      const ok = placed.map((p, k) => p.t.toLowerCase() === target[k].toLowerCase());
      if (ok.every(Boolean)) { draw(ok.map(() => 'right')); right(); return; }
      tries++;
      draw(ok.map(v => v ? 'right' : 'wrong')); shake(slots);
      if (tries >= 2) {
        reveal(() => { placed = target.map((t, k) => ({ t, id: -1 - k })); draw(target.map(() => 'right')); box.innerHTML = ''; });
        return;
      }
      hint();
      finished = true;   /* 等一下再讓孩子改 */
      setTimeout(() => { let keep = ok.indexOf(false); placed = placed.slice(0, keep); finished = false; draw(); }, 1100);
    }
  }

  /* ---------- 回饋 ---------- */
  function shake(el) { if (GK.reduceMotion) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function fb(who, html) {
    const f = $('#fb'); f.hidden = false;
    f.className = 'feedback ' + (who === 'red' ? 'bad' : 'good');
    f.innerHTML = `<div class="hopper">${pikImg(who)}</div><div class="bubble">${html}</div>`;
    hop(f.querySelector('.pik'));
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
    $('#nextBtn').hidden = false; $('#nextBtn').focus({ preventScroll: true });
  }
  function right() {
    sfx.good();
    if (tries === 0) score++; else review.push(it);
    const cheer = tries === 0 ? pick(['答對了！', '太棒了！', '完全正確！', '好厲害！']) : '對了！改過來就學會了！';
    fb(pick(CREW.filter(k => k !== 'red')), `<b>${cheer}</b>`);
    afterAnswer();
  }
  function hint() {
    sfx.bad();
    fb('red', `<b>再想一想！</b><span>${ruleText()}</span>${pagePill(it.sec)}`);
  }
  function reveal(mark) {
    sfx.bad(); review.push(it); mark();
    fb('red', `<b>正確答案是：${esc(it.type === '重組' ? it.a.split(' / ').join(' ') : it.a)}</b><span>${ruleText()}</span>${pagePill(it.sec)}`);
    afterAnswer();
  }

  /* ---------- 成績 ---------- */
  function result() {
    setProgress();
    const n = list.length, pct = score / n;
    const stars = pct >= .9 ? 3 : pct >= .7 ? 2 : 1;
    const msg = score === n ? '全部第一次就答對！太厲害了！' : pct >= .8 ? '很棒！把下面的題目再看一次就更好了！' : pct >= .6 ? '不錯喔！翻翻課本，再練一次會更好！' : '沒關係！照下面的頁碼翻課本看一看，再練一次！';
    const pages = [...new Set(review.map(x => x.sec.page).filter(Boolean))];
    const other = LISTEN_MODE ? 's' : 'l';
    main.innerHTML = `<section class="card result">
      <div class="crew hopper">${shuffle(CREW).map(k => pikImg(k, 'jump')).join('')}</div>
      <p class="stars">${[0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}">${ICON.star}</i>`).join('')}</p>
      <h1>第一次就答對 ${score} / ${n} 題</h1>
      <p class="sub">${msg}</p>
      ${pages.length ? `<div class="go-pages"><b>回去翻一翻：</b>${pages.map(p => `<span class="page-pill">${ICON.book}${esc(p)}</span>`).join('')}</div>` : ''}
      ${review.length ? `<h2>要再看一次的題目</h2><ol class="review">${review.map(x => `<li><span class="sec-tag">${esc(x.sec.name)}</span>
        <p class="rq">${GK.isListen(x) ? '聽到：' + esc(x.q) : x.type === '重組' || x.type === '拼字' ? esc(x.q || '') : qHTML(x.q)}</p>
        <p class="ra">正確答案：<b>${esc(x.type === '重組' ? x.a.split(' / ').join(' ') : x.a)}</b></p>
        ${x.sec.page ? `<p class="rp">${ICON.book}${esc(x.sec.page)}</p>` : ''}</li>`).join('')}</ol>` : ''}
      <div class="nav center">
        <button class="btn primary big" id="againBtn">${ICON.again}再練一次（換新題目）</button>
        <a class="btn" href="practice.html?u=${U}&m=${other}">${LISTEN_MODE ? '去句型練習' : '去聽力練習'}</a>
        <a class="btn" href="index.html">${ICON.home}回首頁</a>
      </div>
    </section>`;
    sfx.win();
    $('#againBtn').onclick = () => { newRound(); window.scrollTo(0, 0); };
  }
})();
