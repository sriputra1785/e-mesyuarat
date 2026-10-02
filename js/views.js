/* views.js — all screens: dashboard, meetings, members, users, master, reports */
/* ========== Router ========== */
const go = safe(async v => {
  S.view = v;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'dash' || v === 'meet') await ensureM();
  await ({ dash: viewDash, meet: viewMeet, mem: viewMem, users: viewUsers, master: viewMaster })[v]();
});
const redraw = () => go(S.view);

async function ensureM() {
  if (S.my !== F.year) {
    S.meetings = await api('listMeetings', { year: F.year });
    S.my = F.year;
  }
}
const setF = safe(async (k, v) => {
  F[k] = v;
  if (k === 'prov') { F.dist = ''; F.sub = ''; }
  if (k === 'dist') F.sub = '';
  if (k === 'year') F.year = +v;
  await redraw();
});

/* ขอบเขตพื้นที่ตาม role ของผู้ใช้ */
function myScope() {
  const u = S.user || {};
  if (u.role === 'subdistrict' && u.subdistrictId) {
    const s = S.subdistricts.find(x => x.id === u.subdistrictId);
    const d = s ? S.districts.find(x => x.id === s.districtId) : null;
    return {
      provinces: d ? S.provinces.filter(p => p.id === d.provinceId) : [],
      districts: d ? S.districts.filter(x => x.id === d.id) : [],
      subdistricts: S.subdistricts.filter(x => x.id === u.subdistrictId),
      lockProv: d ? d.provinceId : '',
      lockDist: d ? d.id : '',
      lockSub: u.subdistrictId
    };
  }
  if (u.role === 'district' && u.districtId) {
    const d = S.districts.find(x => x.id === u.districtId);
    return {
      provinces: d ? S.provinces.filter(p => p.id === d.provinceId) : [],
      districts: S.districts.filter(x => x.id === u.districtId),
      subdistricts: S.subdistricts.filter(x => x.districtId === u.districtId),
      lockProv: d ? d.provinceId : '',
      lockDist: u.districtId,
      lockSub: ''
    };
  }
  if (u.role === 'province' && u.provinceId) {
    return {
      provinces: S.provinces.filter(p => p.id === u.provinceId),
      districts: S.districts.filter(x => x.provinceId === u.provinceId),
      subdistricts: S.subdistricts.filter(s => {
        const d = S.districts.find(x => x.id === s.districtId);
        return d && d.provinceId === u.provinceId;
      }),
      lockProv: u.provinceId,
      lockDist: '',
      lockSub: ''
    };
  }
  // central
  return {
    provinces: S.provinces,
    districts: S.districts,
    subdistricts: S.subdistricts,
    lockProv: '',
    lockDist: '',
    lockSub: ''
  };
}

function applyScopeFilters() {
  const sc = myScope();
  if (sc.lockSub) { F.sub = sc.lockSub; F.dist = sc.lockDist; F.prov = sc.lockProv; }
  else if (sc.lockDist) { F.dist = sc.lockDist; F.prov = sc.lockProv; if (F.sub && !sc.subdistricts.some(s => s.id === F.sub)) F.sub = ''; }
  else if (sc.lockProv) { F.prov = sc.lockProv; if (F.dist && !sc.districts.some(d => d.id === F.dist)) { F.dist = ''; F.sub = ''; } }
}

const fm = () => {
  applyScopeFilters();
  return S.meetings.filter(m =>
    (!F.prov || m.provinceId === F.prov) &&
    (!F.dist || m.districtId === F.dist) &&
    (!F.sub  || m.subdistrictId === F.sub) &&
    (!F.type || m.typeId === F.type) &&
    (!F.month || m.date.slice(5, 7) === F.month)
  );
};

function filterBar(mon) {
  applyScopeFilters();
  const sc = myScope();
  const y = new Date().getFullYear(), ys = [];
  for (let i = y + 1; i >= y - 5; i--) ys.push({ id: String(i), name: String(i + 543) });
  const ds = sc.districts.filter(d => !F.prov || d.provinceId === F.prov).map(distL);
  const ss = sc.subdistricts.filter(s =>
    (!F.dist || s.districtId === F.dist) &&
    (!F.prov || (S.districts.find(d => d.id === s.districtId) || {}).provinceId === F.prov)
  ).map(subL);
  const ms = TH.map((n, i) => ({ id: String(i + 1).padStart(2, '0'), name: n }));
  const lockP = !!sc.lockProv, lockD = !!sc.lockDist, lockS = !!sc.lockSub;
  return `<div class="card fl">
    <label>ปี (พ.ศ.)<select onchange="setF('year',this.value)">${opts(ys, String(F.year))}</select></label>
    ${mon ? `<label>เดือน<select onchange="setF('month',this.value)">${opts(ms, F.month, 'ทุกเดือน')}</select></label>` : ''}
    <label>จังหวัด<select onchange="setF('prov',this.value)" ${lockP ? 'disabled' : ''}>${opts(sc.provinces, F.prov, lockP ? undefined : 'ทั้งหมด')}</select></label>
    <label>อำเภอ<select onchange="setF('dist',this.value)" ${lockD ? 'disabled' : ''}>${opts(ds, F.dist, lockD ? undefined : 'ทั้งหมด')}</select></label>
    <label>ตำบล<select onchange="setF('sub',this.value)" ${lockS ? 'disabled' : ''}>${opts(ss, F.sub, lockS ? undefined : 'ทั้งหมด')}</select></label>
    <label>ประเภท<select onchange="setF('type',this.value)">${opts(S.types, F.type, 'ทั้งหมด')}</select></label>
  </div>`;
}

const tot = L => L.reduce((a, m) => ({ n: a.n + 1, t: a.t + m.total, p: a.p + m.present }), { n: 0, t: 0, p: 0 });
const btns = `<button class="btn sec" onclick="expX()">Excel</button> <button class="btn" onclick="expP()">PDF สรุป</button>`;

/* ========== Dashboard ========== */
function viewDash() {
  const L = fm(), T = tot(L);
  const mo = THS.map((n, i) => {
    const k = String(i + 1).padStart(2, '0');
    const x = L.filter(m => m.date.slice(5, 7) === k);
    const t = tot(x);
    return { n, c: t.n, t: t.t, p: t.p, r: pct(t.p, t.t) };
  });
  // จัดกลุ่มตามพื้นที่ (รองรับทั้งตำบล / อำเภอ / จังหวัด)
  const by = {};
  L.forEach(m => {
    const key = m.subdistrictId
      ? 's:' + m.subdistrictId
      : m.districtId
        ? 'd:' + m.districtId
        : m.provinceId
          ? 'p:' + m.provinceId
          : 'c:central';
    (by[key] = by[key] || []).push(m);
  });
  const rows = Object.keys(by).map(key => {
    const list = by[key], t = tot(list), m = list[0];
    let s = '', d = '';
    if (key.startsWith('s:')) {
      s = nm(S.subdistricts, m.subdistrictId);
      d = 'อ.' + nm(S.districts, m.districtId);
    } else if (key.startsWith('d:')) {
      s = 'อ.' + nm(S.districts, m.districtId) + ' (ระดับอำเภอ)';
      d = 'จ.' + nm(S.provinces, m.provinceId);
    } else if (key.startsWith('p:')) {
      s = 'จ.' + nm(S.provinces, m.provinceId) + ' (ระดับจังหวัด)';
      d = '-';
    } else {
      s = 'ส่วนกลาง';
      d = '-';
    }
    return { id: key, s, d, ...t, r: pct(t.p, t.t) };
  }).sort((a, b) => b.r - a.r);

  $('#view').innerHTML = `
    <div class="head"><h2>แดชบอร์ดปี ${F.year + 543}</h2><div>${btns}</div></div>
    ${filterBar()}
    <div class="kpi">
      <div><b>${T.n}</b><span>จำนวนการประชุม (ครั้ง)</span></div>
      <div><b>${T.t}</b><span>องค์ประชุมรวม (คน-ครั้ง)</span></div>
      <div><b>${T.p}</b><span>เข้าร่วม</span></div>
      <div><b>${T.t - T.p}</b><span>ไม่เข้าร่วม</span></div>
      <div><b>${pct(T.p, T.t)}%</b><span>อัตราการเข้าร่วม</span></div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:12px;font-size:16px;color:var(--navy)">อัตราการเข้าร่วมประชุมรายเดือน (%)</h3>
      <div class="bars">${mo.map(m => `
        <div class="bar">
          <b>${m.c ? m.r + '%' : ''}</b>
          <div class="col"><i class="${m.c ? '' : 'z'}" style="height:${m.r}%"></i></div>
          <span>${m.n}</span>
          <small>${m.c} ครั้ง</small>
        </div>`).join('')}
      </div>
    </div>
    <div class="card tw">
      <h3 style="margin-bottom:12px;font-size:16px;color:var(--navy)">สรุปรายตำบล</h3>
      ${rows.length ? `
        <table>
          <tr><th>ตำบล</th><th>อำเภอ</th><th class="n">ประชุม (ครั้ง)</th><th class="n">องค์ประชุมรวม</th><th class="n">เข้าร่วม</th><th class="n">ร้อยละ</th></tr>
          ${rows.map(r => `<tr>
            <td>${esc(r.s)}</td><td>${esc(r.d)}</td>
            <td class="n">${r.n}</td><td class="n">${r.t}</td><td class="n">${r.p}</td><td class="n">${r.r}%</td>
          </tr>`).join('')}
        </table>` : '<div class="empty">ยังไม่มีข้อมูลการประชุมตามเงื่อนไขที่เลือก</div>'}
    </div>`;
}

/* ========== Meetings ========== */
/* ตำบลบันทึกระดับตำบล · อำเภอบันทึกระดับอำเภอ · จังหวัดบันทึก/ดูในจังหวัด · ส่วนกลางทั้งหมด */
const canEd = m => {
  const u = S.user;
  if (!u || !m) return false;
  // แก้ได้เฉพาะการประชุมที่ระดับตัวเองบันทึก (จังหวัดดูของอำเภอได้ แต่ไม่แก้แทน)
  if (u.role === 'central') return true;
  if (u.role === 'province') return m.provinceId === u.provinceId && !m.districtId && !m.subdistrictId;
  if (u.role === 'district') return m.districtId === u.districtId && !m.subdistrictId;
  if (u.role === 'subdistrict') return m.subdistrictId === u.subdistrictId;
  return false;
};
const canRecord = () => {
  const u = S.user;
  if (!u) return false;
  if (u.role === 'central') return true;
  if (u.role === 'province') return !!u.provinceId;
  if (u.role === 'district') return !!u.districtId;
  if (u.role === 'subdistrict') return !!u.subdistrictId;
  return false;
};
const meetAreaLabel = m => {
  if (m.subdistrictId) {
    return `ต.${nm(S.subdistricts, m.subdistrictId)}<br><small style="color:var(--mut)">อ.${esc(nm(S.districts, m.districtId))}</small>`;
  }
  if (m.districtId) {
    return `อ.${nm(S.districts, m.districtId)}<br><small style="color:var(--mut)">จ.${esc(nm(S.provinces, m.provinceId))} · ระดับอำเภอ</small>`;
  }
  if (m.provinceId) {
    return `จ.${nm(S.provinces, m.provinceId)}<br><small style="color:var(--mut)">ระดับจังหวัด</small>`;
  }
  return 'ส่วนกลาง';
};

function viewMeet() {
  const L = fm(), ed = canRecord();
  $('#view').innerHTML = `
    <div class="head">
      <h2>การประชุม</h2>
      <div>${ed ? '<button class="btn" onclick="openMeeting()">+ เพิ่มการประชุม</button> ' : ''}${btns}</div>
    </div>
    <p style="color:var(--mut);font-size:14px;margin:0 0 12px">
      ${S.user.role === 'subdistrict' ? 'บันทึกการประชุมระดับตำบล (ตำบลของท่าน)' :
        S.user.role === 'district' ? 'บันทึกการประชุมระดับอำเภอ — จังหวัดสามารถดูข้อมูลอำเภอในกำกับได้' :
        S.user.role === 'province' ? 'บันทึกการประชุมระดับจังหวัด และดูการประชุมอำเภอ/ตำบลในจังหวัด' :
        'ส่วนกลางเห็นและจัดการได้ทั้งหมด'}
    </p>
    ${filterBar(1)}
    <div class="card tw">
      ${L.length ? `
        <table>
          <tr><th>วันที่</th><th>ประเภท / เรื่อง</th><th>พื้นที่</th><th class="n">องค์ประชุม</th><th class="n">เข้า</th><th class="n">ไม่เข้า</th><th></th></tr>
          ${L.map(m => `<tr>
            <td>${thDate(m.date)}</td>
            <td>${esc(nm(S.types, m.typeId))}<br><small style="color:var(--mut)">${esc(m.title)}</small></td>
            <td>${meetAreaLabel(m)}</td>
            <td class="n">${m.total}</td><td class="n">${m.present}</td><td class="n">${m.absent}</td>
            <td style="white-space:nowrap">
              <button class="btn sec sm" onclick="mPDF('${m.id}')">PDF</button>
              <button class="btn sec sm" onclick="openMeeting('${m.id}')">${canEd(m) ? 'แก้ไข' : 'ดู'}</button>
              ${canEd(m) ? `<button class="btn bad sm" onclick="delMeet('${m.id}')">ลบ</button>` : ''}
            </td>
          </tr>`).join('')}
        </table>` : `<div class="empty">ยังไม่มีการประชุม${ed ? ' กด "+ เพิ่มการประชุม" เพื่อเริ่มบันทึก' : ''}</div>`}
    </div>`;
}

const delMeet = safe(async id => {
  if (!await ask('ลบการประชุมนี้?')) return;
  await api('delMeeting', { id });
  S.my = null;
  toast('ลบแล้ว');
  await redraw();
});

/* ========== Modal ========== */
const openM = h => { $('#box').innerHTML = h; $('#modal').hidden = false; };
const closeM = () => { $('#modal').hidden = true; $('#box').innerHTML = ''; };
const mh = t => `<div class="mh"><h3>${t}</h3><button onclick="closeM()" aria-label="ปิด">✕</button></div>`;

/* ========== Meeting form ========== */
let FM = { id: '', att: [], topics: [], ro: false };

const openMeeting = safe(async id => {
  const m = id ? S.meetings.find(x => x.id === id) : null;
  if (!m && !canRecord()) {
    return toast('ไม่มีสิทธิ์บันทึกการประชุม', 1);
  }
  const ro = m ? !canEd(m) : false;
  const role = S.user.role;

  FM = {
    id: m ? m.id : '',
    ro,
    att: m ? m.attendance.map(a => ({ ...a })) : [],
    topics: m ? m.topics.map(t => ({ ...t })) : [{ title: '', detail: '' }]
  };

  // พื้นที่ตามระดับ — ไม่ให้ อำเภอ/จังหวัด/ส่วนกลาง เลือกตำบล
  let areaHtml = '';
  let selSub = '';
  if (role === 'subdistrict') {
    selSub = m ? m.subdistrictId : S.user.subdistrictId;
    areaHtml = `<label>ตำบล
      <input type="text" value="${esc(nm(S.subdistricts, selSub))}" disabled>
      <input type="hidden" id="f_sub" value="${esc(selSub)}">
    </label>`;
  } else if (role === 'district') {
    const did = m ? m.districtId : S.user.districtId;
    areaHtml = `<label>อำเภอ
      <input type="text" value="${esc(nm(S.districts, did))} (ระดับอำเภอ)" disabled>
      <input type="hidden" id="f_dist" value="${esc(did)}">
    </label>`;
  } else if (role === 'province') {
    const pid = m ? m.provinceId : S.user.provinceId;
    areaHtml = `<label>จังหวัด
      <input type="text" value="${esc(nm(S.provinces, pid))} (ระดับจังหวัด)" disabled>
      <input type="hidden" id="f_prov" value="${esc(pid)}">
    </label>`;
  } else {
    // ส่วนกลาง — เลือกระดับการบันทึก
    areaHtml = `<label>ระดับการบันทึก
      <select id="f_level" onchange="centralLevelChange()" ${ro ? 'disabled' : ''}>
        <option value="central" ${!m || (!m.provinceId && !m.districtId && !m.subdistrictId) ? 'selected' : ''}>ส่วนกลาง</option>
        <option value="province" ${m && m.provinceId && !m.districtId && !m.subdistrictId ? 'selected' : ''}>จังหวัด</option>
        <option value="district" ${m && m.districtId && !m.subdistrictId ? 'selected' : ''}>อำเภอ</option>
        <option value="subdistrict" ${m && m.subdistrictId ? 'selected' : ''}>ตำบล</option>
      </select>
    </label>
    <div id="f_central_area"></div>`;
  }
  const d = ro ? 'disabled' : '';

  openM(`${mh(m ? (ro ? 'รายละเอียดการประชุม' : 'แก้ไขการประชุม') : 'เพิ่มการประชุม')}
    <div class="g2">
      <label>วันที่ประชุม<input type="date" id="f_date" value="${m ? m.date : new Date().toISOString().slice(0, 10)}" ${d}></label>
      <label>ประเภทการประชุม<select id="f_type" ${d}>${opts(S.types, m ? m.typeId : '', 'เลือก...')}</select></label>
      ${areaHtml}
      <label>เรื่อง / ชื่อการประชุม<input id="f_title" maxlength="300" value="${esc(m ? m.title : '')}" ${d}></label>
    </div>
    <div class="head" style="margin-top:18px">
      <h4 style="font-size:15px;color:var(--navy)">หัวข้อการประชุม</h4>
      ${ro ? '' : '<button class="btn sec sm" onclick="addTopic()">+ เพิ่มหัวข้อ</button>'}
    </div>
    <div id="f_topics"></div>
    <div class="head" style="margin-top:18px">
      <h4 style="font-size:15px;color:var(--navy)">องค์ประชุม <span id="cnt" style="font-weight:400;color:var(--mut)"></span></h4>
      ${ro ? '' : `<div>
        <button class="btn sec sm" onclick="markAll(1)">เลือกทั้งหมด</button>
        <button class="btn sec sm" onclick="markAll(0)">ล้าง</button>
        <button class="btn sec sm" onclick="syncMem()">โหลดรายชื่อล่าสุด</button>
      </div>`}
    </div>
    <div class="att" id="f_att"></div>
    ${ro ? '' : '<button class="btn" style="margin-top:8px" onclick="saveMeeting()">บันทึกการประชุม</button>'}`);
  renderTopics();
  renderAtt();
  if (role === 'central') centralLevelChange(m);
  if (!m && !ro) await syncMem();
});

function centralLevelChange(m) {
  const lv = ($('#f_level') && $('#f_level').value) || 'central';
  const box = $('#f_central_area');
  if (!box) return;
  const ro = FM.ro ? 'disabled' : '';
  if (lv === 'central') {
    box.innerHTML = '';
  } else if (lv === 'province') {
    box.innerHTML = `<label>จังหวัด<select id="f_prov" ${ro}>${opts(S.provinces, m ? m.provinceId : '', 'เลือก...')}</select></label>`;
  } else if (lv === 'district') {
    box.innerHTML = `<label>อำเภอ<select id="f_dist" ${ro}>${opts(S.districts.map(distL), m ? m.districtId : '', 'เลือก...')}</select></label>`;
  } else {
    box.innerHTML = `<label>ตำบล<select id="f_sub" onchange="subChange()" ${ro}>${opts(S.subdistricts.map(subL), m ? m.subdistrictId : '', 'เลือก...')}</select></label>`;
  }
}

function renderTopics() {
  $('#f_topics').innerHTML = FM.topics.map((t, i) => `
    <div class="tp">
      <input placeholder="หัวข้อ" value="${esc(t.title)}" ${FM.ro ? 'disabled' : ''}>
      <textarea placeholder="รายละเอียดสำคัญ / มติที่ประชุม" ${FM.ro ? 'disabled' : ''}>${esc(t.detail)}</textarea>
      ${FM.ro ? '' : `<button class="btn sec sm" style="justify-self:end" onclick="rmTopic(${i})">ลบหัวข้อ</button>`}
    </div>`).join('');
}
function colTopics() {
  FM.topics = [...document.querySelectorAll('#f_topics .tp')].map(e => ({
    title: e.querySelector('input').value,
    detail: e.querySelector('textarea').value
  }));
}
const addTopic = () => { colTopics(); FM.topics.push({ title: '', detail: '' }); renderTopics(); };
const rmTopic = i => { colTopics(); FM.topics.splice(i, 1); renderTopics(); };

function renderAtt() {
  $('#f_att').innerHTML = FM.att.length
    ? FM.att.map((a, i) => `
      <label class="chk">
        <input type="checkbox" ${a.present ? 'checked' : ''} ${FM.ro ? 'disabled' : ''} onchange="tick(${i},this.checked)">
        ${esc(a.name)} <small>${esc(a.position)}</small>
      </label>`).join('')
    : `<div class="empty" style="grid-column:1/-1">${
        S.user.role === 'subdistrict' ? 'กด "โหลดรายชื่อล่าสุด" เพื่อดึงองค์ประชุม' :
        S.user.role === 'district' ? 'กด "โหลดรายชื่อล่าสุด" เพื่อดึงองค์ประชุมทุกตำบลในอำเภอ' :
        'ระดับจังหวัด/ส่วนกลาง อาจไม่มีรายชื่อองค์ประชุม — บันทึกหัวข้อได้อย่างเดียวได้'
      }</div>`;
  cnt();
}
function cnt() {
  const p = FM.att.filter(a => a.present).length;
  const el = $('#cnt');
  if (el) el.textContent = `ทั้งหมด ${FM.att.length} | เข้าร่วม ${p} | ไม่เข้าร่วม ${FM.att.length - p}`;
}
const tick = (i, v) => { FM.att[i].present = v; cnt(); };
const markAll = v => { FM.att.forEach(a => a.present = !!v); renderAtt(); };
const syncMem = safe(async () => {
  const role = S.user.role;
  let r = [];
  // ดึงเฉพาะองค์ประชุมระดับเดียวกับการประชุม — ไม่ปนตำบลกับอำเภอ
  if (role === 'subdistrict' || ($('#f_sub') && $('#f_sub').value)) {
    const sid = ($('#f_sub') && $('#f_sub').value) || S.user.subdistrictId;
    if (!sid) return;
    r = await api('listMembers', { subdistrictId: sid });
  } else if (role === 'district' || ($('#f_dist') && $('#f_dist').value && !($('#f_sub') && $('#f_sub').value))) {
    const did = ($('#f_dist') && $('#f_dist').value) || S.user.districtId;
    if (!did) return;
    r = await api('listMembers', { districtId: did }); // เฉพาะระดับอำเภอ
  } else if (role === 'province' || ($('#f_prov') && $('#f_prov').value && !($('#f_dist') && $('#f_dist').value))) {
    const pid = ($('#f_prov') && $('#f_prov').value) || S.user.provinceId;
    if (!pid) return;
    r = await api('listMembers', { provinceId: pid });
  } else {
    renderAtt();
    return;
  }
  const have = new Set(FM.att.map(x => x.id));
  r.forEach(x => {
    if (!have.has(x.id)) FM.att.push({ id: x.id, name: x.name, position: x.position, present: false });
  });
  renderAtt();
  if (!r.length) toast('ยังไม่มีรายชื่อองค์ประชุมระดับนี้ — เพิ่มได้ที่เมนู องค์ประชุม', 1);
});
const subChange = () => { FM.att = []; renderAtt(); syncMem(); };
const saveMeeting = safe(async () => {
  colTopics();
  const role = S.user.role;
  const d = {
    id: FM.id,
    date: $('#f_date').value,
    typeId: $('#f_type').value,
    title: $('#f_title').value.trim(),
    attendance: FM.att,
    topics: FM.topics.filter(t => t.title.trim() || t.detail.trim()),
    subdistrictId: '',
    districtId: '',
    provinceId: ''
  };
  if (role === 'subdistrict') {
    d.subdistrictId = ($('#f_sub') && $('#f_sub').value) || S.user.subdistrictId;
  } else if (role === 'district') {
    d.districtId = ($('#f_dist') && $('#f_dist').value) || S.user.districtId;
  } else if (role === 'province') {
    d.provinceId = ($('#f_prov') && $('#f_prov').value) || S.user.provinceId;
  } else {
    const lv = ($('#f_level') && $('#f_level').value) || 'central';
    if (lv === 'subdistrict') d.subdistrictId = $('#f_sub') ? $('#f_sub').value : '';
    else if (lv === 'district') d.districtId = $('#f_dist') ? $('#f_dist').value : '';
    else if (lv === 'province') d.provinceId = $('#f_prov') ? $('#f_prov').value : '';
  }
  if (!d.date || !d.typeId) return toast('กรอกวันที่และประเภทให้ครบ', 1);
  if (role === 'subdistrict' && !d.subdistrictId) return toast('ไม่พบตำบลในความรับผิดชอบ', 1);
  if (role === 'district' && !d.districtId) return toast('ไม่พบอำเภอในความรับผิดชอบ', 1);
  if (role === 'province' && !d.provinceId) return toast('ไม่พบจังหวัดในความรับผิดชอบ', 1);
  if ((role === 'subdistrict' || role === 'district') && !d.attendance.length) {
    return toast('ยังไม่มีรายชื่อองค์ประชุม — กดโหลดรายชื่อล่าสุด', 1);
  }
  showBusy('กำลังบันทึก', 'บันทึกการประชุม...');
  try {
    await api('saveMeeting', d);
    hideBusy();
    closeM();
    S.my = null;
  } catch (e) {
    hideBusy();
    throw e;
  }
  toast('บันทึกแล้ว');
  await redraw();
});

/* ========== Members ==========
 * ระดับตำบล: จัดการองค์ประชุมตำบลตน
 * ระดับอำเภอ: จัดการองค์ประชุมอำเภอ + เพิ่มให้ตำบลในอำเภอได้
 * ระดับจังหวัด: จัดการองค์ประชุมจังหวัด + เพิ่มให้อำเภอ/ตำบลในจังหวัดได้
 * ส่วนกลาง: จัดการได้ทุกระดับ
 */
const M = { mode: '', sub: '', dist: '', prov: '' };

function initMemMode() {
  const u = S.user;
  if (u.role === 'subdistrict') {
    M.mode = 'subdistrict';
    M.sub = u.subdistrictId;
    M.dist = '';
    M.prov = '';
  } else if (u.role === 'district') {
    if (M.mode !== 'district' && M.mode !== 'subdistrict') M.mode = 'district';
    M.dist = u.districtId;
    if (M.mode === 'district') { M.sub = ''; }
  } else if (u.role === 'province') {
    if (!['province', 'district', 'subdistrict'].includes(M.mode)) M.mode = 'province';
    M.prov = u.provinceId;
    if (M.mode === 'province') { M.dist = ''; M.sub = ''; }
  } else {
    if (!['province', 'district', 'subdistrict'].includes(M.mode)) M.mode = 'province';
  }
}

function memScopeQuery() {
  initMemMode();
  const u = S.user || {};
  if (M.mode === 'subdistrict') {
    const sid = (u.role === 'subdistrict' ? u.subdistrictId : M.sub) || '';
    if (!sid) return { error: 'กรุณาเลือกตำบลก่อนบันทึกองค์ประชุม' };
    return { subdistrictId: sid, districtId: '', provinceId: '' };
  }
  if (M.mode === 'district') {
    const did = (u.role === 'district' ? u.districtId : M.dist) || '';
    if (!did) {
      return {
        error: u.role === 'district'
          ? 'บัญชีอำเภอยังไม่ได้ผูกอำเภอ — ให้ส่วนกลางแก้ที่เมนูผู้ใช้'
          : 'กรุณาเลือกอำเภอก่อนบันทึกองค์ประชุม'
      };
    }
    return { subdistrictId: '', districtId: did, provinceId: '' };
  }
  if (M.mode === 'province') {
    const pid = (u.role === 'province' ? u.provinceId : M.prov) || '';
    if (!pid) {
      return {
        error: u.role === 'province'
          ? 'บัญชีจังหวัดยังไม่ได้ผูกจังหวัด — ให้ส่วนกลางแก้ที่เมนูผู้ใช้'
          : 'กรุณาเลือกจังหวัดก่อนบันทึกองค์ประชุม'
      };
    }
    return { subdistrictId: '', districtId: '', provinceId: pid };
  }
  return { error: 'ไม่ทราบระดับองค์ประชุม' };
}

function setMemMode(mode) {
  M.mode = mode;
  if (mode === 'district') M.sub = '';
  if (mode === 'province') { M.dist = ''; M.sub = ''; }
  redraw();
}

async function viewMem() {
  const u = S.user;
  initMemMode();
  let q = memScopeQuery();
  if (q && q.error) q = null;
  S.members = q ? await api('listMembers', q) : [];

  const sc = myScope();
  const distsInScope = sc.districts;
  const subsInScope = sc.subdistricts;

  // แถบเลือกระดับ
  let tabs = '';
  if (u.role === 'subdistrict') {
    tabs = `<span class="tag ok">องค์ประชุมตำบล: ${esc(nm(S.subdistricts, u.subdistrictId))}</span>`;
  } else if (u.role === 'district') {
    tabs = `
      <button class="btn sec sm" style="${M.mode === 'district' ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : ''}"
        onclick="setMemMode('district')">องค์ประชุมอำเภอ</button>
      <button class="btn sec sm" style="${M.mode === 'subdistrict' ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : ''}"
        onclick="setMemMode('subdistrict')">องค์ประชุมตำบล (เพิ่มให้ตำบล)</button>`;
  } else if (u.role === 'province') {
    tabs = `
      <button class="btn sec sm" style="${M.mode === 'province' ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : ''}"
        onclick="setMemMode('province')">องค์ประชุมจังหวัด</button>
      <button class="btn sec sm" style="${M.mode === 'district' ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : ''}"
        onclick="setMemMode('district')">องค์ประชุมอำเภอ</button>
      <button class="btn sec sm" style="${M.mode === 'subdistrict' ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : ''}"
        onclick="setMemMode('subdistrict')">องค์ประชุมตำบล</button>`;
  } else {
    tabs = `
      <button class="btn sec sm" style="${M.mode === 'province' ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : ''}"
        onclick="setMemMode('province')">จังหวัด</button>
      <button class="btn sec sm" style="${M.mode === 'district' ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : ''}"
        onclick="setMemMode('district')">อำเภอ</button>
      <button class="btn sec sm" style="${M.mode === 'subdistrict' ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : ''}"
        onclick="setMemMode('subdistrict')">ตำบล</button>`;
  }

  // ตัวเลือกพื้นที่เมื่อเพิ่มให้ระดับล่าง
  let pick = '';
  if (M.mode === 'subdistrict' && u.role !== 'subdistrict') {
    const subs = u.role === 'district'
      ? S.subdistricts.filter(s => s.districtId === u.districtId)
      : u.role === 'province'
        ? S.subdistricts.filter(s => {
            const d = S.districts.find(x => x.id === s.districtId);
            return d && d.provinceId === u.provinceId;
          })
        : S.subdistricts;
    if (!M.sub && subs[0]) M.sub = subs[0].id;
    pick = `<label>ตำบล<select onchange="M.sub=this.value;redraw()">${opts(subs.map(subL), M.sub)}</select></label>`;
  } else if (M.mode === 'district' && u.role !== 'district' && u.role !== 'subdistrict') {
    const dists = u.role === 'province'
      ? S.districts.filter(d => d.provinceId === u.provinceId)
      : S.districts;
    if (!M.dist && dists[0]) M.dist = dists[0].id;
    pick = `<label>อำเภอ<select onchange="M.dist=this.value;M.sub='';redraw()">${opts(dists.map(distL), M.dist)}</select></label>`;
  } else if (M.mode === 'province' && u.role === 'central') {
    if (!M.prov && S.provinces[0]) M.prov = S.provinces[0].id;
    pick = `<label>จังหวัด<select onchange="M.prov=this.value;M.dist='';M.sub='';redraw()">${opts(S.provinces, M.prov)}</select></label>`;
  }

  // โหลดใหม่หลังอาจตั้งค่า default
  let q2 = memScopeQuery();
  if (q2 && q2.error) q2 = null;
  if (JSON.stringify(q2) !== JSON.stringify(q)) {
    S.members = q2 ? await api('listMembers', q2) : [];
  }
  const canEdit = !!q2;

  const levelHint = {
    subdistrict: 'รายชื่อองค์ประชุมระดับตำบล',
    district: 'รายชื่อองค์ประชุมระดับอำเภอ (ไม่ปนกับตำบล)',
    province: 'รายชื่อองค์ประชุมระดับจังหวัด'
  }[M.mode] || '';

  $('#view').innerHTML = `
    <div class="head">
      <h2>องค์ประชุม</h2>
      ${canEdit ? `<div>
        <button class="btn sec" onclick="openBulk()">เพิ่มหลายรายชื่อ</button>
        <button class="btn" onclick="openMember()">+ เพิ่มรายชื่อ</button>
      </div>` : ''}
    </div>
    <div class="card">
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">${tabs}</div>
      ${pick ? `<div class="fl" style="margin-bottom:8px">${pick}</div>` : ''}
      <p style="margin:0;font-size:13px;color:var(--mut)">${esc(levelHint)}</p>
    </div>
    <div class="card tw">
      ${S.members.length ? `
        <table>
          <tr><th>#</th><th>ชื่อ-สกุล</th><th>ตำแหน่ง</th><th></th></tr>
          ${S.members.map((x, i) => `<tr>
            <td>${i + 1}</td><td>${esc(x.name)}</td><td>${esc(x.position)}</td>
            <td style="white-space:nowrap">
              ${canEdit ? `<button class="btn sec sm" onclick="openMember('${x.id}')">แก้ไข</button>
              <button class="btn bad sm" onclick="delMem('${x.id}')">ลบ</button>` : ''}
            </td>
          </tr>`).join('')}
        </table>` : `<div class="empty">ยังไม่มีรายชื่อองค์ประชุม${canEdit ? ' — กด "+ เพิ่มรายชื่อ"' : ''}</div>`}
    </div>`;
}

function openMember(id) {
  const x = S.members.find(m => m.id === id) || { name: '', position: '' };
  openM(`${mh(id ? 'แก้ไของค์ประชุม' : 'เพิ่มองค์ประชุม')}
    <div class="g2">
      <label>ชื่อ-สกุล<input id="m_n" value="${esc(x.name)}"></label>
      <label>ตำแหน่ง<input id="m_p" value="${esc(x.position)}"></label>
    </div>
    <p style="margin-top:16px"><button class="btn" onclick="saveMem('${id || ''}')">บันทึก</button></p>`);
}
const saveMem = safe(async id => {
  const q = memScopeQuery();
  if (!q || q.error) return toast((q && q.error) || 'เลือกพื้นที่/ระดับองค์ประชุมให้ครบก่อน', 1);
  showBusy('กำลังบันทึก', 'บันทึกรายชื่อ...');
  try {
    await api('saveMember', {
      id: id || '',
      subdistrictId: q.subdistrictId || '',
      districtId: q.districtId || '',
      provinceId: q.provinceId || '',
      name: $('#m_n').value,
      position: $('#m_p').value
    });
    hideBusy();
    closeM();
    toast('บันทึกแล้ว');
    await redraw();
  } catch (e) {
    hideBusy();
    throw e;
  }
});
const delMem = safe(async id => {
  if (!await ask('ลบรายชื่อนี้? (การประชุมที่บันทึกไว้แล้วไม่ได้รับผลกระทบ)')) return;
  await api('delMember', { id });
  await redraw();
});
function openBulk() {
  openM(`${mh('เพิ่มหลายรายชื่อ')}
    <label>พิมพ์/วาง 1 บรรทัดต่อ 1 คน รูปแบบ: ชื่อ-สกุล, ตำแหน่ง
      <textarea id="b_t" style="min-height:220px" placeholder="นายสมชาย ใจดี, นายอำเภอ&#10;นางสมหญิง รักดี, ปลัดอำเภอ"></textarea>
    </label>
    <p style="margin-top:12px"><button class="btn" onclick="saveBulk()">บันทึกทั้งหมด</button></p>`);
}
const saveBulk = safe(async () => {
  const q = memScopeQuery();
  if (!q || q.error) return toast((q && q.error) || 'เลือกพื้นที่/ระดับองค์ประชุมให้ครบก่อน', 1);
  const list = $('#b_t').value.split('\n').map(l => {
    const [n, ...p] = l.split(',');
    return { name: n.trim(), position: p.join(',').trim() };
  }).filter(x => x.name);
  if (!list.length) return toast('ไม่มีรายชื่อที่จะบันทึก', 1);
  showBusy('กำลังบันทึก', 'เพิ่มรายชื่อ...');
  try {
    const n = await api('saveMembers', {
      subdistrictId: q.subdistrictId || '',
      districtId: q.districtId || '',
      provinceId: q.provinceId || '',
      list
    });
    hideBusy();
    closeM();
    toast('เพิ่ม ' + n + ' รายชื่อ');
    await redraw();
  } catch (e) {
    hideBusy();
    throw e;
  }
});

/* ========== Users (central) ========== */
async function viewUsers() {
  S.users = await api('listUsers');
  $('#view').innerHTML = `
    <div class="head">
      <h2>ผู้ใช้งาน</h2>
      <button class="btn" onclick="openNewUser()">+ เพิ่มผู้ใช้</button>
    </div>
    <p style="color:var(--mut);font-size:14px;margin:0 0 16px">
      กำหนดสิทธิ์ตามระดับ: <b>ตำบล</b> = ปลัดตำบล · <b>อำเภอ</b> = เลขาอำเภอ · <b>จังหวัด</b> = เลขาจังหวัด · <b>ส่วนกลาง</b> = ผู้ดูแลระบบ
      <br>ผู้ใช้ล็อกอินด้วย <b>รหัสผู้ใช้ + รหัสผ่าน</b> ที่ส่วนกลางตั้งให้ (ไม่ต้องใช้อีเมล)
    </p>
    <div class="card tw">
      <table>
        <tr><th>รหัสผู้ใช้</th><th>ชื่อ</th><th>ระดับ</th><th>พื้นที่</th><th>สถานะ</th><th></th></tr>
        ${S.users.map(u => `<tr>
          <td>${esc(u.username)}</td>
          <td>${esc(u.name)}</td>
          <td>${ROLE[u.role] || 'รอกำหนดสิทธิ์'}</td>
          <td>${esc(
            u.role === 'subdistrict' ? nm(S.subdistricts, u.subdistrictId) :
            u.role === 'district' ? nm(S.districts, u.districtId) :
            u.role === 'province' ? nm(S.provinces, u.provinceId) :
            u.role === 'central' ? 'ทั้งหมด' : '-'
          )}</td>
          <td><span class="tag ${u.active === 'Y' ? 'ok' : 'no'}">${u.active === 'Y' ? 'ใช้งาน' : 'ปิด'}</span></td>
          <td style="white-space:nowrap">
            <button class="btn sec sm" onclick="openUser('${u.id}')">แก้ไข</button>
            ${u.id !== S.user.id ? `<button class="btn bad sm" onclick="delUserRow('${u.id}')">ลบ</button>` : ''}
          </td>
        </tr>`).join('')}
      </table>
    </div>`;
}

function userFormFields(u, isNew) {
  return `
    <div class="g2">
      <label>รหัสผู้ใช้
        <input id="u_un" type="text" value="${esc(u.username)}" ${isNew ? 'required' : 'disabled'}
          placeholder="เช่น padat_bannai" autocapitalize="off" spellcheck="false"
          pattern="[a-zA-Z0-9._\\-]{2,40}" title="ใช้ a-z 0-9 . _ - เท่านั้น">
      </label>
      <label>ชื่อ-สกุล<input id="u_nm" value="${esc(u.name)}" required placeholder="ชื่อ นามสกุล"></label>
      ${isNew ? `<label>รหัสผ่าน (อย่างน้อย 6 ตัว)
        <input id="u_pw" type="password" required minlength="6" autocomplete="new-password" placeholder="••••••••">
      </label>` : ''}
      <label>ระดับ<select id="u_r" onchange="uRole()">${opts(Object.keys(ROLE).map(k => ({ id: k, name: ROLE[k] })), u.role || 'subdistrict', 'เลือก...')}</select></label>
      <label id="u_pl">จังหวัด<select id="u_p">${opts(S.provinces, u.provinceId, 'เลือก...')}</select></label>
      <label id="u_dl">อำเภอ<select id="u_d">${opts(S.districts.map(distL), u.districtId, 'เลือก...')}</select></label>
      <label id="u_sl">ตำบล<select id="u_s">${opts(S.subdistricts.map(subL), u.subdistrictId, 'เลือก...')}</select></label>
      <label class="chk" style="margin-top:8px">
        <input type="checkbox" id="u_a" ${u.active !== 'N' ? 'checked' : ''}> เปิดใช้งานบัญชี
      </label>
    </div>`;
}

function openNewUser() {
  openM(`${mh('เพิ่มผู้ใช้ใหม่')}
    ${userFormFields({ username: '', name: '', role: 'subdistrict', provinceId: '', districtId: '', subdistrictId: '', active: 'Y' }, true)}
    <p style="margin-top:8px;font-size:13px;color:var(--mut)">
      ตั้ง <b>รหัสผู้ใช้</b> ให้ง่ายต่อการจำ เช่น <code>padat01</code> หรือ <code>sekha_a1</code>
      แล้วแจ้งรหัสผู้ใช้ + รหัสผ่านให้ผู้ใช้คนนั้น
    </p>
    <p style="margin-top:12px"><button class="btn" onclick="createUser()">สร้างบัญชี</button></p>`);
  uRole();
}

function openUser(id) {
  const u = S.users.find(x => x.id === id) || {
    username: '', name: '', role: 'subdistrict',
    provinceId: '', districtId: '', subdistrictId: '', active: 'Y'
  };
  openM(`${mh('แก้ไขสิทธิ์ผู้ใช้')}
    ${userFormFields(u, false)}
    <p style="margin-top:16px"><button class="btn" onclick="saveUser('${id}')">บันทึก</button></p>`);
  uRole();
}

function uRole() {
  const r = $('#u_r').value;
  $('#u_pl').hidden = r !== 'province';
  $('#u_dl').hidden = r !== 'district';
  $('#u_sl').hidden = r !== 'subdistrict';
}

const createUser = safe(async () => {
  const role = $('#u_r').value;
  if (role === 'province' && !$('#u_p').value) return toast('เลือกจังหวัด', 1);
  if (role === 'district' && !$('#u_d').value) return toast('เลือกอำเภอ', 1);
  if (role === 'subdistrict' && !$('#u_s').value) return toast('เลือกตำบล', 1);
  await api('createUser', {
    username: $('#u_un').value,
    password: $('#u_pw').value,
    name: $('#u_nm').value,
    role,
    provinceId: $('#u_p').value,
    districtId: $('#u_d').value,
    subdistrictId: $('#u_s').value,
    active: $('#u_a').checked
  });
  closeM();
  toast('สร้างผู้ใช้เรียบร้อย');
  await redraw();
});

const saveUser = safe(async id => {
  const role = $('#u_r').value;
  if (role === 'province' && !$('#u_p').value) return toast('เลือกจังหวัด', 1);
  if (role === 'district' && !$('#u_d').value) return toast('เลือกอำเภอ', 1);
  if (role === 'subdistrict' && !$('#u_s').value) return toast('เลือกตำบล', 1);
  await api('saveUser', {
    id,
    username: $('#u_un').value,
    name: $('#u_nm').value,
    role,
    provinceId: $('#u_p').value,
    districtId: $('#u_d').value,
    subdistrictId: $('#u_s').value,
    active: $('#u_a').checked
  });
  closeM();
  toast('บันทึกแล้ว');
  await redraw();
});

const delUserRow = safe(async id => {
  const u = S.users.find(x => x.id === id);
  const label = u ? (u.name || u.username) : id;
  if (!await ask('ลบผู้ใช้นี้?', 'จะลบสิทธิ์ของ «' + label + '» ออกจากระบบ (เข้าสู่ระบบไม่ได้) บัญชีใน Supabase Auth ยังอยู่ — ลบถาวรได้ที่ Dashboard')) return;
  await api('delUser', { id });
  toast('ลบผู้ใช้แล้ว');
  await redraw();
});

/* ========== Master data (central) ========== */
const K = {
  province:    { t: 'จังหวัด', a: 'provinces' },
  district:    { t: 'อำเภอ', a: 'districts', p: 'provinceId', pa: 'provinces', pt: 'จังหวัด' },
  subdistrict: { t: 'ตำบล', a: 'subdistricts', p: 'districtId', pa: 'districts', pt: 'อำเภอ' },
  type:        { t: 'ประเภทการประชุม', a: 'types' }
};
const MK = { tab: 'province' };

function viewMaster() {
  const k = K[MK.tab], rows = S[k.a];
  $('#view').innerHTML = `
    <div class="head">
      <h2>ข้อมูลหลัก</h2>
      <button class="btn" onclick="openKind()">+ เพิ่ม${k.t}</button>
    </div>
    <div class="card">
      <nav style="margin-bottom:14px;display:flex;gap:4px;flex-wrap:wrap">
        ${Object.keys(K).map(x => `
          <button class="btn sec sm" style="${x === MK.tab ? 'background:var(--navy);color:#fff;border-color:var(--navy)' : ''}"
            onclick="MK.tab='${x}';viewMaster()">${K[x].t}</button>`).join('')}
      </nav>
      <div class="tw">
        ${rows.length ? `
          <table>
            <tr><th>ชื่อ</th>${k.p ? `<th>${k.pt}</th>` : ''}<th></th></tr>
            ${rows.map(r => `<tr>
              <td>${esc(r.name)}</td>
              ${k.p ? `<td>${esc(nm(S[k.pa], r[k.p]))}</td>` : ''}
              <td style="white-space:nowrap">
                <button class="btn sec sm" onclick="openKind('${r.id}')">แก้ไข</button>
                <button class="btn bad sm" onclick="delKind('${r.id}')">ลบ</button>
              </td>
            </tr>`).join('')}
          </table>` : '<div class="empty">ยังไม่มีข้อมูล</div>'}
      </div>
    </div>`;
}

function openKind(id) {
  const k = K[MK.tab];
  const r = S[k.a].find(x => x.id === id) || { name: '' };
  openM(`${mh((id ? 'แก้ไข' : 'เพิ่ม') + k.t)}
    <div class="g2">
      <label>ชื่อ<input id="k_n" value="${esc(r.name)}"></label>
      ${k.p ? `<label>${k.pt}<select id="k_p">${opts(
        S[k.pa].map(x => k.pa === 'districts' ? distL(x) : x), r[k.p], 'เลือก...'
      )}</select></label>` : ''}
    </div>
    <p style="margin-top:16px"><button class="btn" onclick="saveKind('${id || ''}')">บันทึก</button></p>`);
}
const reloadMe = async () => {
  const r = await api('me');
  S.provinces = r.provinces;
  S.districts = r.districts;
  S.subdistricts = r.subdistricts;
  S.types = r.types;
};
const saveKind = safe(async id => {
  const k = K[MK.tab];
  await api('saveGeo', {
    kind: MK.tab, id,
    name: $('#k_n').value,
    parentId: k.p ? $('#k_p').value : ''
  });
  closeM();
  await reloadMe();
  toast('บันทึกแล้ว');
  viewMaster();
});
const delKind = safe(async id => {
  if (!await ask('ลบรายการนี้?')) return;
  await api('delGeo', { kind: MK.tab, id });
  await reloadMe();
  viewMaster();
});

/* ========== Password ========== */
function openPw() {
  openM(`${mh('เปลี่ยนรหัสผ่าน')}
    <div class="g2">
      <label>รหัสผ่านเดิม<input id="w_o" type="password" autocomplete="current-password"></label>
      <label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)<input id="w_n" type="password" autocomplete="new-password"></label>
    </div>
    <p style="margin-top:16px"><button class="btn" onclick="savePw()">บันทึก</button></p>`);
}
const savePw = safe(async () => {
  await api('changePassword', { old: $('#w_o').value, pw: $('#w_n').value });
  closeM();
  toast('เปลี่ยนรหัสผ่านแล้ว');
});

/* ========== Reports ========== */
const area = m => {
  if (m.subdistrictId) return `ต.${nm(S.subdistricts, m.subdistrictId)} อ.${nm(S.districts, m.districtId)} จ.${nm(S.provinces, m.provinceId)}`;
  if (m.districtId) return `อ.${nm(S.districts, m.districtId)} จ.${nm(S.provinces, m.provinceId)} (ระดับอำเภอ)`;
  if (m.provinceId) return `จ.${nm(S.provinces, m.provinceId)} (ระดับจังหวัด)`;
  return 'ส่วนกลาง';
};

/* ========== รายงาน ========== */
const meetLevel = m => {
  if (m.subdistrictId) return 'ตำบล';
  if (m.districtId) return 'อำเภอ';
  if (m.provinceId) return 'จังหวัด';
  return 'ส่วนกลาง';
};
const filterDesc = () => {
  const parts = ['ปี ' + (F.year + 543)];
  if (F.month) parts.push('เดือน' + TH[+F.month - 1]);
  if (F.prov) parts.push('จ.' + nm(S.provinces, F.prov));
  if (F.dist) parts.push('อ.' + nm(S.districts, F.dist));
  if (F.sub) parts.push('ต.' + nm(S.subdistricts, F.sub));
  if (F.type) parts.push('ประเภท: ' + nm(S.types, F.type));
  return parts.join(' · ');
};
const reportFooter = () => {
  const now = new Date();
  const ds = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const who = (S.user && S.user.name) ? S.user.name : '';
  return `<div style="margin-top:28px;font-size:12px;color:#555;border-top:1px solid #ccc;padding-top:8px">
    พิมพ์เมื่อ ${ds}${who ? ' · โดย ' + esc(who) : ''} · ระบบบันทึกการประชุมออนไลน์
  </div>`;
};

async function makePDF(html, fn, land) {
  showBusy('กำลังสร้างรายงาน', 'กรุณารอสักครู่...');
  await document.fonts.ready;
  const d = document.createElement('div');
  d.className = 'rep';
  d.style.width = (land ? 1100 : 730) + 'px';
  d.innerHTML = html;
  document.body.appendChild(d);
  let okp = 0;
  try {
    await html2pdf().set({
      margin: [12, 10, 12, 10],
      filename: fn,
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: land ? 'landscape' : 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.nobreak'] }
    }).from(d).save();
    okp = 1;
  } finally {
    d.remove();
    hideBusy();
  }
  if (okp) toast('ดาวน์โหลดรายงานแล้ว');
}

/* PDF รายการประชุมรายครั้ง */
const mPDF = safe(async id => {
  const m = S.meetings.find(x => x.id === id);
  if (!m) return toast('ไม่พบข้อมูลการประชุม', 1);
  const pres = (m.attendance || []).filter(a => a.present);
  const abs = (m.attendance || []).filter(a => !a.present);
  await makePDF(`
    <div class="nobreak">
      <h2>รายงานสรุปผลการประชุม</h2>
      <h3 style="font-weight:500;margin:4px 0 12px">${esc(nm(S.types, m.typeId))}${m.title ? ' : ' + esc(m.title) : ''}</h3>
      <table style="margin:8px 0 14px">
        <tr><td width="26%"><b>วันที่ประชุม</b></td><td>${thDate(m.date)}</td></tr>
        <tr><td><b>ระดับ</b></td><td>${meetLevel(m)}</td></tr>
        <tr><td><b>พื้นที่</b></td><td>${esc(area(m))}</td></tr>
        <tr><td><b>องค์ประชุมทั้งหมด</b></td><td>${m.total || 0} คน</td></tr>
        <tr><td><b>เข้าร่วมประชุม</b></td><td>${m.present || 0} คน (ร้อยละ ${pct(m.present, m.total)})</td></tr>
        <tr><td><b>ไม่เข้าร่วมประชุม</b></td><td>${m.absent || 0} คน</td></tr>
      </table>
    </div>
    <div class="l nobreak"><h3>หัวข้อการประชุม / มติ</h3></div>
    ${(m.topics || []).length
      ? m.topics.map((t, i) => `<div class="nobreak" style="margin:8px 0 10px">
          <b>${i + 1}. ${esc(t.title || '-')}</b>
          <div style="white-space:pre-wrap;padding:4px 0 0 18px;line-height:1.55">${esc(t.detail || '-')}</div>
        </div>`).join('')
      : '<p>-</p>'}
    <div class="l"><h3 style="margin-top:12px">รายชื่อองค์ประชุมที่เข้าร่วม (${pres.length} คน)</h3></div>
    <table>
      <tr><th width="8%">ลำดับ</th><th>ชื่อ-สกุล</th><th>ตำแหน่ง</th></tr>
      ${pres.length
        ? pres.map((a, i) => `<tr>
            <td align="center">${i + 1}</td>
            <td>${esc(a.name)}</td>
            <td>${esc(a.position || '')}</td>
          </tr>`).join('')
        : '<tr><td colspan="3" align="center">-</td></tr>'}
    </table>
    ${abs.length ? `
      <div class="l"><h3 style="margin-top:14px">รายชื่อที่ไม่เข้าร่วม (${abs.length} คน)</h3></div>
      <table>
        <tr><th width="8%">ลำดับ</th><th>ชื่อ-สกุล</th><th>ตำแหน่ง</th></tr>
        ${abs.map((a, i) => `<tr>
          <td align="center">${i + 1}</td>
          <td>${esc(a.name)}</td>
          <td>${esc(a.position || '')}</td>
        </tr>`).join('')}
      </table>` : ''}
    <div style="margin-top:40px;text-align:right;padding-right:48px" class="nobreak">
      ลงชื่อ .............................................. ผู้บันทึกการประชุม<br>
      ( .............................................. )<br>
      ตำแหน่ง ..............................................
    </div>
    ${reportFooter()}
  `, 'สรุปการประชุม_' + m.date + '.pdf');
});

/* PDF สรุปรวมตามตัวกรอง */
const expP = safe(async () => {
  const L = fm(), T = tot(L);
  if (!L.length) return toast('ไม่มีข้อมูลให้ออกรายงานตามเงื่อนไขที่เลือก', 1);

  // สรุปตามระดับ
  const byLv = { 'ตำบล': [], 'อำเภอ': [], 'จังหวัด': [], 'ส่วนกลาง': [] };
  L.forEach(m => byLv[meetLevel(m)].push(m));
  const lvRows = Object.keys(byLv).filter(k => byLv[k].length).map(k => {
    const t = tot(byLv[k]);
    return `<tr>
      <td>${k}</td>
      <td align="center">${t.n}</td>
      <td align="center">${t.t}</td>
      <td align="center">${t.p}</td>
      <td align="center">${t.t - t.p}</td>
      <td align="center">${pct(t.p, t.t)}</td>
    </tr>`;
  }).join('');

  await makePDF(`
    <h2>รายงานสรุปการประชุม</h2>
    <p style="text-align:center;margin:2px 0 10px;font-size:14px">${esc(filterDesc())}</p>
    <table style="margin-bottom:12px">
      <tr>
        <td><b>จำนวนครั้ง</b><br>${T.n}</td>
        <td><b>องค์ประชุมรวม</b><br>${T.t}</td>
        <td><b>เข้าร่วม</b><br>${T.p}</td>
        <td><b>ไม่เข้าร่วม</b><br>${T.t - T.p}</td>
        <td><b>ร้อยละเข้าร่วม</b><br>${pct(T.p, T.t)}</td>
      </tr>
    </table>
    <div class="l"><h3>สรุปตามระดับ</h3></div>
    <table style="margin-bottom:14px">
      <tr><th>ระดับ</th><th>ครั้ง</th><th>องค์ประชุม</th><th>เข้าร่วม</th><th>ไม่เข้า</th><th>ร้อยละ</th></tr>
      ${lvRows}
    </table>
    <div class="l"><h3>รายการประชุม</h3></div>
    <table>
      <tr>
        <th>วันที่</th><th>ระดับ</th><th>ประเภท</th><th>เรื่อง</th><th>พื้นที่</th>
        <th>องค์ประชุม</th><th>เข้าร่วม</th><th>ไม่เข้า</th><th>ร้อยละ</th>
      </tr>
      ${L.map(m => `<tr>
        <td>${thDate(m.date)}</td>
        <td align="center">${meetLevel(m)}</td>
        <td>${esc(nm(S.types, m.typeId))}</td>
        <td>${esc(m.title)}</td>
        <td>${esc(area(m))}</td>
        <td align="center">${m.total || 0}</td>
        <td align="center">${m.present || 0}</td>
        <td align="center">${m.absent || 0}</td>
        <td align="center">${pct(m.present, m.total)}</td>
      </tr>`).join('')}
    </table>
    ${reportFooter()}
  `, 'รายงานสรุปการประชุม_' + (F.year + 543) + '.pdf', 1);
});

/* Excel หลายชีต */
const expX = safe(async () => {
  const L = fm(), T = tot(L);
  if (!L.length) return toast('ไม่มีข้อมูลให้ออกรายงานตามเงื่อนไขที่เลือก', 1);
  showBusy('กำลังสร้าง Excel', 'กรุณารอสักครู่...');
  try {
    const wb = XLSX.utils.book_new();

    // ชีต 1: สรุป
    const a = [
      ['รายงานสรุปการประชุม'],
      [filterDesc()],
      ['จำนวนครั้ง', T.n, 'องค์ประชุมรวม', T.t, 'เข้าร่วม', T.p, 'ไม่เข้าร่วม', T.t - T.p, 'ร้อยละ', pct(T.p, T.t)],
      [],
      ['วันที่', 'ระดับ', 'ประเภท', 'เรื่อง', 'จังหวัด', 'อำเภอ', 'ตำบล', 'พื้นที่', 'องค์ประชุม', 'เข้าร่วม', 'ไม่เข้าร่วม', 'ร้อยละ']
    ];
    L.forEach(m => {
      a.push([
        thDate(m.date),
        meetLevel(m),
        nm(S.types, m.typeId),
        m.title || '',
        nm(S.provinces, m.provinceId),
        nm(S.districts, m.districtId),
        nm(S.subdistricts, m.subdistrictId),
        area(m),
        m.total || 0,
        m.present || 0,
        m.absent || 0,
        pct(m.present, m.total)
      ]);
    });

    // ชีต 2: รายชื่อผู้เข้าร่วม
    const b = [['วันที่', 'ระดับ', 'พื้นที่', 'เรื่อง', 'ชื่อ-สกุล', 'ตำแหน่ง', 'การเข้าร่วม']];
    L.forEach(m => {
      (m.attendance || []).forEach(x => b.push([
        thDate(m.date),
        meetLevel(m),
        area(m),
        m.title || '',
        x.name || '',
        x.position || '',
        x.present ? 'เข้าร่วม' : 'ไม่เข้าร่วม'
      ]));
    });

    // ชีต 3: หัวข้อการประชุม
    const c = [['วันที่', 'ระดับ', 'พื้นที่', 'เรื่องการประชุม', 'หัวข้อ', 'รายละเอียด / มติ']];
    L.forEach(m => {
      (m.topics || []).forEach(t => c.push([
        thDate(m.date),
        meetLevel(m),
        area(m),
        m.title || '',
        t.title || '',
        t.detail || ''
      ]));
    });

    // ชีต 4: สรุปรายเดือน
    const d = [['เดือน', 'จำนวนครั้ง', 'องค์ประชุม', 'เข้าร่วม', 'ไม่เข้าร่วม', 'ร้อยละ']];
    TH.forEach((name, i) => {
      const k = String(i + 1).padStart(2, '0');
      const x = L.filter(m => (m.date || '').slice(5, 7) === k);
      if (!x.length) return;
      const t = tot(x);
      d.push([name, t.n, t.t, t.p, t.t - t.p, pct(t.p, t.t)]);
    });

    // ชีต 5: สรุปตามระดับ
    const e = [['ระดับ', 'จำนวนครั้ง', 'องค์ประชุม', 'เข้าร่วม', 'ไม่เข้าร่วม', 'ร้อยละ']];
    ['ตำบล', 'อำเภอ', 'จังหวัด', 'ส่วนกลาง'].forEach(lv => {
      const x = L.filter(m => meetLevel(m) === lv);
      if (!x.length) return;
      const t = tot(x);
      e.push([lv, t.n, t.t, t.p, t.t - t.p, pct(t.p, t.t)]);
    });

    [
      ['สรุปการประชุม', a],
      ['รายชื่อผู้เข้าร่วม', b],
      ['หัวข้อการประชุม', c],
      ['สรุปรายเดือน', d],
      ['สรุปตามระดับ', e]
    ].forEach(([name, data]) => {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name);
    });

    const fn = 'รายงานการประชุม_' + (F.year + 543) +
      (F.month ? '_' + F.month : '') + '.xlsx';
    XLSX.writeFile(wb, fn);
    toast('ดาวน์โหลด Excel แล้ว');
  } finally {
    hideBusy();
  }
});
