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
  const by = {};
  L.forEach(m => { (by[m.subdistrictId] = by[m.subdistrictId] || []).push(m); });
  const rows = Object.keys(by).map(id => {
    const t = tot(by[id]), m = by[id][0];
    return { id, s: nm(S.subdistricts, id), d: nm(S.districts, m.districtId), ...t, r: pct(t.p, t.t) };
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
const canEd = m => {
  const u = S.user;
  return u.role === 'central' ||
    (u.role === 'province' && m.provinceId === u.provinceId) ||
    (u.role === 'district' && m.districtId === u.districtId) ||
    (u.role === 'subdistrict' && m.subdistrictId === u.subdistrictId);
};

function viewMeet() {
  const L = fm(), ed = true;
  $('#view').innerHTML = `
    <div class="head">
      <h2>การประชุม</h2>
      <div>${ed ? '<button class="btn" onclick="openMeeting()">+ เพิ่มการประชุม</button> ' : ''}${btns}</div>
    </div>
    ${filterBar(1)}
    <div class="card tw">
      ${L.length ? `
        <table>
          <tr><th>วันที่</th><th>ประเภท / เรื่อง</th><th>พื้นที่</th><th class="n">องค์ประชุม</th><th class="n">เข้า</th><th class="n">ไม่เข้า</th><th></th></tr>
          ${L.map(m => `<tr>
            <td>${thDate(m.date)}</td>
            <td>${esc(nm(S.types, m.typeId))}<br><small style="color:var(--mut)">${esc(m.title)}</small></td>
            <td>${esc(nm(S.subdistricts, m.subdistrictId))}<br><small style="color:var(--mut)">อ.${esc(nm(S.districts, m.districtId))}</small></td>
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
  const ro = m ? !canEd(m) : false;
  // จำกัดตำบลตามสิทธิ์ผู้ใช้
  const eSubs = myScope().subdistricts;
  if (!m && !eSubs.length) return toast('ยังไม่มีตำบลในความรับผิดชอบ กรุณาติดต่อส่วนกลาง', 1);
  if (m && !canEd(m) && S.user.role !== 'central') {
    return toast('ไม่มีสิทธิ์ดูการประชุมนอกพื้นที่ของท่าน', 1);
  }

  FM = {
    id: m ? m.id : '',
    ro,
    att: m ? m.attendance.map(a => ({ ...a })) : [],
    topics: m ? m.topics.map(t => ({ ...t })) : [{ title: '', detail: '' }]
  };
  const subs = (ro ? S.subdistricts : eSubs).map(subL);
  const sel = m ? m.subdistrictId : (subs.length === 1 ? subs[0].id : '');
  const d = ro ? 'disabled' : '';

  openM(`${mh(m ? (ro ? 'รายละเอียดการประชุม' : 'แก้ไขการประชุม') : 'เพิ่มการประชุม')}
    <div class="g2">
      <label>วันที่ประชุม<input type="date" id="f_date" value="${m ? m.date : new Date().toISOString().slice(0, 10)}" ${d}></label>
      <label>ประเภทการประชุม<select id="f_type" ${d}>${opts(S.types, m ? m.typeId : '', 'เลือก...')}</select></label>
      <label>ตำบล<select id="f_sub" onchange="subChange()" ${d}>${opts(subs, sel, 'เลือก...')}</select></label>
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
  if (!m && sel) await syncMem();
});

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
    : '<div class="empty" style="grid-column:1/-1">เลือกตำบลเพื่อโหลดรายชื่อองค์ประชุม</div>';
  cnt();
}
function cnt() {
  const p = FM.att.filter(a => a.present).length;
  $('#cnt').textContent = `ทั้งหมด ${FM.att.length} | เข้าร่วม ${p} | ไม่เข้าร่วม ${FM.att.length - p}`;
}
const tick = (i, v) => { FM.att[i].present = v; cnt(); };
const markAll = v => { FM.att.forEach(a => a.present = !!v); renderAtt(); };
const syncMem = safe(async () => {
  const sid = $('#f_sub').value;
  if (!sid) return;
  const r = await api('listMembers', { subdistrictId: sid });
  const have = new Set(FM.att.map(x => x.id));
  r.forEach(x => {
    if (!have.has(x.id)) FM.att.push({ id: x.id, name: x.name, position: x.position, present: false });
  });
  renderAtt();
  if (!r.length) toast('ตำบลนี้ยังไม่มีรายชื่อองค์ประชุม (เพิ่มได้ที่เมนู องค์ประชุม)', 1);
});
const subChange = () => { FM.att = []; renderAtt(); syncMem(); };
const saveMeeting = safe(async () => {
  colTopics();
  const d = {
    id: FM.id,
    date: $('#f_date').value,
    typeId: $('#f_type').value,
    subdistrictId: $('#f_sub').value,
    title: $('#f_title').value.trim(),
    attendance: FM.att,
    topics: FM.topics.filter(t => t.title.trim() || t.detail.trim())
  };
  if (!d.date || !d.typeId || !d.subdistrictId) return toast('กรอกวันที่ ประเภท และตำบลให้ครบ', 1);
  if (!d.attendance.length) return toast('ยังไม่มีรายชื่อองค์ประชุม', 1);
  await api('saveMeeting', d);
  closeM();
  S.my = null;
  toast('บันทึกแล้ว');
  await redraw();
});

/* ========== Members ========== */
const M = { sub: '' };

async function viewMem() {
  const sc = myScope();
  const subs = sc.subdistricts;
  if (sc.lockSub) M.sub = sc.lockSub;
  else if (!subs.find(s => s.id === M.sub)) M.sub = subs[0] ? subs[0].id : '';
  S.members = M.sub ? await api('listMembers', { subdistrictId: M.sub }) : [];
  const ed = true;
  const lockSub = !!sc.lockSub;
  $('#view').innerHTML = `
    <div class="head">
      <h2>องค์ประชุม</h2>
      ${ed && M.sub ? `<div>
        <button class="btn sec" onclick="openBulk()">เพิ่มหลายรายชื่อ</button>
        <button class="btn" onclick="openMember()">+ เพิ่มรายชื่อ</button>
      </div>` : ''}
    </div>
    <div class="card">
      <label>ตำบล<select onchange="M.sub=this.value;redraw()" ${lockSub ? 'disabled' : ''}>${opts(subs.map(subL), M.sub)}</select></label>
      ${lockSub ? '<p style="margin:8px 0 0;font-size:13px;color:var(--mut)">แสดงเฉพาะตำบลในความรับผิดชอบของท่าน</p>' : ''}
    </div>
    <div class="card tw">
      ${S.members.length ? `
        <table>
          <tr><th>#</th><th>ชื่อ-สกุล</th><th>ตำแหน่ง</th><th></th></tr>
          ${S.members.map((x, i) => `<tr>
            <td>${i + 1}</td><td>${esc(x.name)}</td><td>${esc(x.position)}</td>
            <td style="white-space:nowrap">
              ${ed ? `<button class="btn sec sm" onclick="openMember('${x.id}')">แก้ไข</button>
              <button class="btn bad sm" onclick="delMem('${x.id}')">ลบ</button>` : ''}
            </td>
          </tr>`).join('')}
        </table>` : '<div class="empty">ยังไม่มีรายชื่อองค์ประชุมในตำบลนี้</div>'}
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
  await api('saveMember', { id, subdistrictId: M.sub, name: $('#m_n').value, position: $('#m_p').value });
  closeM();
  toast('บันทึกแล้ว');
  await redraw();
});
const delMem = safe(async id => {
  if (!await ask('ลบรายชื่อนี้? (การประชุมที่บันทึกไว้แล้วไม่ได้รับผลกระทบ)')) return;
  await api('delMember', { id });
  await redraw();
});
function openBulk() {
  openM(`${mh('เพิ่มหลายรายชื่อ')}
    <label>พิมพ์/วาง 1 บรรทัดต่อ 1 คน รูปแบบ: ชื่อ-สกุล, ตำแหน่ง
      <textarea id="b_t" style="min-height:220px" placeholder="นายสมชาย ใจดี, นายก อบต.&#10;นางสมหญิง รักดี, ประธานสภา"></textarea>
    </label>
    <p style="margin-top:12px"><button class="btn" onclick="saveBulk()">บันทึกทั้งหมด</button></p>`);
}
const saveBulk = safe(async () => {
  const list = $('#b_t').value.split('\n').map(l => {
    const [n, ...p] = l.split(',');
    return { name: n.trim(), position: p.join(',').trim() };
  }).filter(x => x.name);
  const n = await api('saveMembers', { subdistrictId: M.sub, list });
  closeM();
  toast('เพิ่ม ' + n + ' รายชื่อ');
  await redraw();
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
const area = m => `ต.${nm(S.subdistricts, m.subdistrictId)} อ.${nm(S.districts, m.districtId)} จ.${nm(S.provinces, m.provinceId)}`;

async function makePDF(html, fn, land) {
  showBusy('กำลังสร้างรายงาน', 'กรุณารอสักครู่...');
  await document.fonts.ready;
  const d = document.createElement('div');
  d.className = 'rep';
  d.style.width = (land ? 1050 : 730) + 'px';
  d.innerHTML = html;
  document.body.appendChild(d);
  let okp = 0;
  try {
    await html2pdf().set({
      margin: 10, filename: fn,
      image: { type: 'jpeg', quality: .95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: land ? 'landscape' : 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] }
    }).from(d).save();
    okp = 1;
  } finally {
    d.remove();
    hideBusy();
  }
  if (okp) toast('สร้างรายงานแล้ว');
}

const mPDF = safe(async id => {
  const m = S.meetings.find(x => x.id === id);
  await makePDF(`
    <h2>รายงานสรุปผลการประชุม</h2>
    <h3 style="font-weight:400">${esc(nm(S.types, m.typeId))}${m.title ? ' : ' + esc(m.title) : ''}</h3>
    <table style="margin:10px 0">
      <tr><td width="22%"><b>วันที่ประชุม</b></td><td>${thDate(m.date)}</td></tr>
      <tr><td><b>พื้นที่</b></td><td>${esc(area(m))}</td></tr>
      <tr><td><b>องค์ประชุมทั้งหมด</b></td><td>${m.total} คน</td></tr>
      <tr><td><b>เข้าร่วมประชุม</b></td><td>${m.present} คน (ร้อยละ ${pct(m.present, m.total)})</td></tr>
      <tr><td><b>ไม่เข้าร่วมประชุม</b></td><td>${m.absent} คน</td></tr>
    </table>
    <div class="l"><h3>หัวข้อการประชุม</h3></div>
    ${m.topics.length
      ? m.topics.map((t, i) => `<div style="margin:6px 0"><b>${i + 1}. ${esc(t.title)}</b><div style="white-space:pre-wrap;padding-left:18px">${esc(t.detail)}</div></div>`).join('')
      : '<p>-</p>'}
    <div class="l"><h3 style="margin-top:10px">รายชื่อองค์ประชุม</h3></div>
    <table>
      <tr><th width="8%">ลำดับ</th><th>ชื่อ-สกุล</th><th>ตำแหน่ง</th><th width="18%">การเข้าร่วม</th></tr>
      ${m.attendance.map((a, i) => `<tr>
        <td align="center">${i + 1}</td>
        <td>${esc(a.name)}</td>
        <td>${esc(a.position)}</td>
        <td align="center">${a.present ? 'เข้าร่วม' : 'ไม่เข้าร่วม'}</td>
      </tr>`).join('')}
    </table>
    <div style="margin-top:36px;text-align:right;padding-right:40px">
      ลงชื่อ ....................................... ผู้บันทึกการประชุม<br>( ....................................... )
    </div>`, 'สรุปการประชุม_' + m.date + '.pdf');
});

const expP = safe(async () => {
  const L = fm(), T = tot(L);
  if (!L.length) return toast('ไม่มีข้อมูลให้ออกรายงาน', 1);
  await makePDF(`
    <h2>รายงานสรุปการประชุม ปี ${F.year + 543}</h2>
    <p style="text-align:center;margin:0">
      ${F.month ? 'เดือน' + TH[+F.month - 1] + ' ' : ''}
      ${F.sub ? 'ต.' + esc(nm(S.subdistricts, F.sub)) + ' ' : ''}
      ${F.dist ? 'อ.' + esc(nm(S.districts, F.dist)) + ' ' : ''}
      ${F.prov ? 'จ.' + esc(nm(S.provinces, F.prov)) : ''}
    </p>
    <p>ประชุมทั้งหมด ${T.n} ครั้ง | องค์ประชุมรวม ${T.t} | เข้าร่วม ${T.p} | ไม่เข้าร่วม ${T.t - T.p} | ร้อยละการเข้าร่วม ${pct(T.p, T.t)}</p>
    <table>
      <tr><th>วันที่</th><th>ประเภท</th><th>เรื่อง</th><th>พื้นที่</th><th>องค์ประชุม</th><th>เข้าร่วม</th><th>ไม่เข้า</th><th>ร้อยละ</th></tr>
      ${L.map(m => `<tr>
        <td>${thDate(m.date)}</td>
        <td>${esc(nm(S.types, m.typeId))}</td>
        <td>${esc(m.title)}</td>
        <td>${esc(area(m))}</td>
        <td align="center">${m.total}</td>
        <td align="center">${m.present}</td>
        <td align="center">${m.absent}</td>
        <td align="center">${pct(m.present, m.total)}</td>
      </tr>`).join('')}
    </table>`, 'รายงานสรุปการประชุม_' + (F.year + 543) + '.pdf', 1);
});

const expX = safe(async () => {
  const L = fm();
  if (!L.length) return toast('ไม่มีข้อมูลให้ออกรายงาน', 1);
  const wb = XLSX.utils.book_new();
  const a = [['วันที่', 'ประเภท', 'เรื่อง', 'จังหวัด', 'อำเภอ', 'ตำบล', 'องค์ประชุม', 'เข้าร่วม', 'ไม่เข้าร่วม', 'ร้อยละ']];
  const b = [['วันที่', 'ตำบล', 'เรื่อง', 'ชื่อ-สกุล', 'ตำแหน่ง', 'การเข้าร่วม']];
  const c = [['วันที่', 'ตำบล', 'หัวข้อ', 'รายละเอียด']];
  L.forEach(m => {
    a.push([
      thDate(m.date), nm(S.types, m.typeId), m.title,
      nm(S.provinces, m.provinceId), nm(S.districts, m.districtId), nm(S.subdistricts, m.subdistrictId),
      m.total, m.present, m.absent, pct(m.present, m.total)
    ]);
    m.attendance.forEach(x => b.push([
      thDate(m.date), nm(S.subdistricts, m.subdistrictId), m.title,
      x.name, x.position, x.present ? 'เข้าร่วม' : 'ไม่เข้าร่วม'
    ]));
    m.topics.forEach(t => c.push([
      thDate(m.date), nm(S.subdistricts, m.subdistrictId), t.title, t.detail
    ]));
  });
  [['สรุปการประชุม', a], ['รายชื่อผู้เข้าร่วม', b], ['หัวข้อการประชุม', c]]
    .forEach(x => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(x[1]), x[0]));
  XLSX.writeFile(wb, 'รายงานการประชุม_' + (F.year + 543) + '.xlsx');
});
