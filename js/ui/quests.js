// ============================================================
// GTDM quests — missions, achievements, attendance, mail
// ============================================================
import { el, clear, fmt, bus } from '../core/util.js';
import { t, tData } from '../core/i18n.js';
import { sfx } from '../core/audio.js';
import * as ST from '../game/state.js';
import { openModal, toast, rewardItemsHTML, CUR_ICON } from './modal.js';

let curTab = 'daily';

export function renderQuests(scene) {
  clear(scene);
  const root = el('div', 'scene-root');
  scene.appendChild(root);
  ST.ensureMissions();

  root.appendChild(el('div', 'sec-title', '📜 ' + t('nav.quests')));

  // tabs
  const tabs = el('div', 'tab-row');
  const TABS = [['daily', t('quests.daily')], ['weekly', t('quests.weekly')], ['achieve', t('quests.achieve')], ['attend', t('quests.attend')], ['mail', `✉️ ${t('mail.title')}${ST.unreadMail() ? ` (${ST.unreadMail()})` : ''}`]];
  TABS.forEach(([id, label]) => {
    const b = el('button', 'tab-btn' + (curTab === id ? ' on' : ''), label);
    b.onclick = () => { curTab = id; sfx.click(); renderQuests(scene); };
    tabs.appendChild(b);
  });
  root.appendChild(tabs);

  const pane = el('div');
  root.appendChild(pane);
  if (curTab === 'daily') missionList(pane, 'daily', ST.S.missions.daily);
  else if (curTab === 'weekly') missionList(pane, 'weekly', ST.S.missions.weekly);
  else if (curTab === 'achieve') achieveList(pane);
  else if (curTab === 'attend') attendPane(pane, scene);
  else mailList(pane, scene);
}

function missionRowHTML(m) {
  const pct = Math.min(100, (m.progress / m.goal) * 100);
  return `
    <div class="mi-ico">${m.icon}</div>
    <div class="mi-body">
      <div class="mi-t">${tData(m, 'text').replaceAll('{n}', fmt(m.goal))}</div>
      <div class="mi-p"><i style="width:${pct}%"></i></div>
      <div class="mi-n">${fmt(m.progress)} / ${fmt(m.goal)}</div>
    </div>
    <div class="mi-r">${rewardItemsHTML(m.reward)}</div>`;
}

function missionList(pane, which, list) {
  if (!list.length) { pane.innerHTML = `<div class="empty-note">${t('quests.refresh')}</div>`; return; }
  list.forEach((m, i) => {
    const done = m.progress >= m.goal;
    const item = el('div', 'mission-item' + (m.claimed ? ' done' : ''));
    item.innerHTML = missionRowHTML(m);
    const b = el('button', m.claimed ? 'btn btn-sm' : done ? 'btn btn-sm btn-gold' : 'btn btn-sm',
      m.claimed ? t('common.claimed') : done ? t('common.claim') : '⏳');
    b.disabled = m.claimed || !done;
    b.onclick = () => {
      if (ST.claimMission(which, i)) {
        sfx.bigCoin(); toast(t('common.claim') + ' ✓', 'gold', '🎁');
        bus.emit('state'); renderQuests(document.getElementById('scene'));
      }
    };
    item.appendChild(b);
    pane.appendChild(item);
  });
}

function achieveList(pane) {
  ST.ACHIEVEMENTS.forEach(a => {
    const rec = ST.achieveState(a.id) || { progress: 0, claimed: false };
    const prog = Math.min(a.goal, rec.progress ?? 0);
    const done = prog >= a.goal;
    const item = el('div', 'mission-item' + (rec.claimed ? ' done' : ''));
    item.innerHTML = `
      <div class="mi-ico">${a.icon}</div>
      <div class="mi-body">
        <div class="mi-t">${tData(a, 'text')}</div>
        <div class="mi-p"><i style="width:${Math.min(100, (prog / a.goal) * 100)}%"></i></div>
        <div class="mi-n">${fmt(prog)} / ${fmt(a.goal)}</div>
      </div>
      <div class="mi-r">${rewardItemsHTML(a.reward)}</div>`;
    const b = el('button', rec.claimed ? 'btn btn-sm' : done ? 'btn btn-sm btn-gold' : 'btn btn-sm',
      rec.claimed ? t('common.claimed') : done ? t('common.claim') : '⏳');
    b.disabled = rec.claimed || !done;
    b.onclick = () => {
      if (ST.claimAchievement(a.id)) {
        sfx.bigCoin(); toast('🏆 ' + tData(a, 'text'), 'gold', '🏆');
        bus.emit('state'); renderQuests(document.getElementById('scene'));
      }
    };
    item.appendChild(b);
    pane.appendChild(item);
  });
}

function attendPane(pane, scene) {
  const A = ST.S.attend;
  const claimable = ST.attendClaimable();
  const dayIdx = claimable ? (A.streak % 7) : ((A.streak - 1) % 7 + 7) % 7;

  pane.insertAdjacentHTML('beforeend', `
    <div class="panel" style="margin-bottom:12px;text-align:center">
      <div class="sec-title" style="justify-content:center">📅 ${t('attend.title')}</div>
      <div class="txt-s txt-mut">${t('attend.streak')}: <b class="txt-gold">${A.streak}</b> · ${t('attend.milestone')}: <b class="txt-gold">${A.totalDays}</b></div>
      <button class="btn ${claimable ? 'btn-gold btn-lg' : ''} mt12" id="attClaim" ${claimable ? '' : 'disabled'}>
        ${claimable ? t('common.claim') + ' ✨' : t('common.claimed')}</button>
    </div>`);
  pane.querySelector('#attClaim').onclick = () => {
    const r = ST.attendToday();
    if (r) {
      sfx.bigCoin();
      bus.emit('state');
      openModal({
        title: '📅 ' + t('attend.title'),
        body: `<div style="text-align:center"><div style="font-size:52px">${r.rw.icon}</div>
          <div class="reward-items">${rewardItemsHTML([{ id: r.rw.cur, n: r.rw.n }])}</div>
          <div class="txt-gold fw9">${t('attend.streak')}: ${r.streak} 🔥</div></div>`,
      });
      renderQuests(scene);
    }
  };

  const grid = el('div', 'att-grid');
  ST.ATTEND_REWARDS.forEach((r, i) => {
    const claimed = i < dayIdx || (!claimable && i === dayIdx);
    const today = claimable && i === dayIdx;
    const d = el('div', 'att-day' + (claimed ? ' claimed' : '') + (today ? ' today' : ''));
    d.innerHTML = `
      ${claimed ? '<div class="ad-check">✓</div>' : ''}
      <div class="ad-n">DAY ${i + 1}</div>
      <div class="ad-ico">${r.icon}</div>
      <div class="ad-r">${CUR_ICON[r.cur]} ${r.n}</div>`;
    grid.appendChild(d);
  });
  pane.appendChild(grid);

  const ms = el('div', 'mt12');
  ms.innerHTML = `<div class="sec-title">🏆 ${t('attend.milestone')}</div>` +
    ST.ATTEND_MILESTONES.map(m => {
      const got = A.totalDays >= m.days;
      return `<div class="mission-item${got ? ' done' : ''}">
        <div class="mi-ico">${m.icon}</div>
        <div class="mi-body"><div class="mi-t">${m.days} ${t('quests.attend')}</div>
        <div class="mi-p"><i style="width:${Math.min(100, (A.totalDays / m.days) * 100)}%"></i></div>
        <div class="mi-n">${A.totalDays} / ${m.days}</div></div>
        <div class="mi-r">${rewardItemsHTML(m.reward)}</div></div>`;
    }).join('');
  pane.appendChild(ms);
}

function mailList(pane, scene) {
  ST.pruneMail();
  if (!ST.S.mail.length) { pane.innerHTML = `<div class="empty-note">📭 ${t('mail.empty')}</div>`; return; }
  const bar = el('div', 'dsp-flex gap8 mt8');
  bar.style.marginBottom = '10px';
  const ca = el('button', 'btn btn-sm btn-gold', t('mail.claimAll'));
  ca.onclick = () => {
    const n = ST.claimAllMail();
    if (n) { sfx.bigCoin(); toast(`+${n} ✓`, 'gold', '🎁'); bus.emit('state'); }
    else sfx.error();
    renderQuests(scene);
  };
  const ra = el('button', 'btn btn-sm', t('mail.readAll'));
  ra.onclick = () => { ST.S.mail.forEach(m => m.read = true); ST.persist(); sfx.click(); renderQuests(scene); bus.emit('mail'); };
  bar.appendChild(ca); bar.appendChild(ra);
  pane.appendChild(bar);

  [...ST.S.mail].reverse().forEach(m => {
    const item = el('div', 'mail-item ' + (m.read ? 'read' : 'unread'));
    item.innerHTML = `
      <div class="ml-ico">${m.icon}</div>
      <div style="flex:1;min-width:0">
        <div class="ml-t">${tData(m, 'title')}</div>
        <div class="ml-d">${tData(m, 'text')}</div>
        ${m.attach.length ? `<div class="ml-a">${rewardItemsHTML(m.attach)}</div>` : ''}
      </div>`;
    if (m.attach.length && !m.claimed) {
      const b = el('button', 'btn btn-sm btn-gold', t('common.claim'));
      b.onclick = () => {
        if (ST.claimMail(m.id)) { sfx.bigCoin(); toast(t('common.claim') + ' ✓', 'gold', '🎁'); bus.emit('state'); }
        renderQuests(scene);
      };
      item.appendChild(b);
    } else if (m.claimed) {
      item.appendChild(el('div', 'txt-s txt-mut', t('common.claimed')));
    }
    item.onclick = e => { if (e.target === item || !m.read) { m.read = true; ST.persist(); bus.emit('mail'); } };
    pane.appendChild(item);
  });
}

// quick mail modal from topbar
export function openMailModal() {
  const body = el('div');
  const m = openModal({ title: '✉️ ' + t('mail.title'), body, wide: true });
  mailListInto(body, () => { m.close(); openMailModal(); });
}

function mailListInto(pane, refresh) {
  ST.pruneMail();
  clear(pane);
  if (!ST.S.mail.length) { pane.innerHTML = `<div class="empty-note">📭 ${t('mail.empty')}</div>`; return; }
  const bar = el('div', 'dsp-flex gap8');
  bar.style.marginBottom = '10px';
  const ca = el('button', 'btn btn-sm btn-gold', t('mail.claimAll'));
  ca.onclick = () => {
    const n = ST.claimAllMail();
    if (n) { sfx.bigCoin(); toast(`+${n} ✓`, 'gold', '🎁'); bus.emit('state'); refresh(); }
    else sfx.error();
  };
  bar.appendChild(ca);
  pane.appendChild(bar);
  [...ST.S.mail].reverse().forEach(m => {
    const item = el('div', 'mail-item ' + (m.read ? 'read' : 'unread'));
    item.innerHTML = `
      <div class="ml-ico">${m.icon}</div>
      <div style="flex:1;min-width:0">
        <div class="ml-t">${tData(m, 'title')}</div>
        <div class="ml-d">${tData(m, 'text')}</div>
        ${m.attach.length ? `<div class="ml-a">${rewardItemsHTML(m.attach)}</div>` : ''}
      </div>`;
    if (m.attach.length && !m.claimed) {
      const b = el('button', 'btn btn-sm btn-gold', t('common.claim'));
      b.onclick = () => {
        if (ST.claimMail(m.id)) { sfx.bigCoin(); toast(t('common.claim') + ' ✓', 'gold', '🎁'); bus.emit('state'); refresh(); }
      };
      item.appendChild(b);
    }
    pane.appendChild(item);
  });
  // mark read on open
  ST.S.mail.forEach(x => x.read = true);
  ST.persist(); bus.emit('mail');
}
