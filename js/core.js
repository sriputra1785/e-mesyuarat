/* core.js — config, state, helpers, supabase, API */
/* ========== Config ========== */
const SB_URL = 'https://ngphafjtptdmakzmxcgw.supabase.co';
const SB_KEY = 'sb_publishable_O53vYGQrygl3mAIfpt2PgQ_jl-m__hu';
const IDLE = 30 * 60 * 1000;

const TH  = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const ROLE = { central: 'ส่วนกลาง', province: 'จังหวัด', district: 'อำเภอ', subdistrict: 'ตำบล' };

/* ========== State ========== */
const S = {
  user: null, provinces: [], districts: [], subdistricts: [], types: [],
  meetings: [], my: null, view: 'dash', users: [], members: []
};
const F = { year: new Date().getFullYear(), prov: '', dist: '', sub: '', type: '', month: '' };

/* ========== Helpers ========== */
const $ = s => document.querySelector(s);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nm = (a, id) => (a.find(x => x.id === id) || {}).name || '-';
const thDate = d => {
  if (!d) return '-';
  const [y, m, dd] = d.split('-').map(Number);
  return dd + ' ' + TH[m - 1] + ' ' + (y + 543);
};
const pct = (p, t) => t ? Math.round(p * 1000 / t) / 10 : 0;
const opts = (a, sel, ph) =>
  (ph != null ? `<option value="">${ph}</option>` : '') +
  a.map(x => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${esc(x.label || x.name)}</option>`).join('');
const subL  = s => ({ id: s.id, label: s.name + ' (อ.' + nm(S.districts, s.districtId) + ')' });
const distL = d => ({ id: d.id, label: d.name + ' (จ.' + nm(S.provinces, d.provinceId) + ')' });

let last = Date.now(), busy = 0;
const load = on => { busy += on ? 1 : -1; const el = document.getElementById('top'); if (el) el.style.display = busy > 0 ? 'block' : 'none'; };

const SPINNER_HTML = `<div class="sw-spinner" aria-hidden="true">${Array.from({ length: 12 }, () => '<i></i>').join('')}</div>`;

/** แสดง SweetAlert กำลังโหลด (ไอคอนหมุน) */
function showBusy(title, text) {
  return Swal.fire({
    title: title || 'กำลังโหลด',
    html: SPINNER_HTML + (text ? `<p style="margin:12px 0 0">${text}</p>` : '<p style="margin:12px 0 0;color:#64748b">กรุณารอสักครู่</p>'),
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    customClass: { popup: 'sw-loading-popup' }
  });
}
function hideBusy() {
  if (Swal.isVisible()) Swal.close();
}

const Toast = Swal.mixin({
  toast: true, position: 'top-end', showConfirmButton: false, timer: 3000,
  timerProgressBar: true,
  didOpen: t => {
    t.addEventListener('mouseenter', Swal.stopTimer);
    t.addEventListener('mouseleave', Swal.resumeTimer);
  }
});
function toast(t, e) { Toast.fire({ icon: e ? 'error' : 'success', title: t }); }
const ask = (title, text) => Swal.fire({
  title, text, icon: 'warning', showCancelButton: true,
  confirmButtonText: 'ยืนยันลบ', cancelButtonText: 'ยกเลิก',
  confirmButtonColor: '#c53030', reverseButtons: true, focusCancel: true
}).then(r => r.isConfirmed);
const safe = f => async function (...a) {
  try { return await f.apply(this, a); }
  catch (e) { if (e && e.message) toast(e.message, 1); }
};

/* ========== Supabase ========== */
const sb = supabase.createClient(SB_URL, SB_KEY, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});
const un = r => {
  if (r.error) {
    const m = r.error.message || '';
    throw new Error(
      /row-level security|permission denied/i.test(m) ? 'ไม่มีสิทธิ์ดำเนินการ' :
      /duplicate key/i.test(m) ? 'ข้อมูลซ้ำ' :
      /foreign key/i.test(m) ? 'ยังมีข้อมูลที่เกี่ยวข้องอยู่ จึงลบไม่ได้' :
      /invalid login/i.test(m) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : m
    );
  }
  return r.data;
};
const sbT = { province: 'provinces', district: 'districts', subdistrict: 'subdistricts', type: 'meeting_types' };
const nl = v => v || null;
const mapM = r => ({
  id: r.id, date: r.meeting_date, typeId: r.type_id,
  provinceId: r.province_id, districtId: r.district_id, subdistrictId: r.subdistrict_id,
  title: r.title || '', total: r.total, present: r.present, absent: r.absent,
  attendance: r.attendance || [], topics: r.topics || []
});
/* รหัสผู้ใช้ → อีเมลภายใน (Supabase ต้องใช้อีเมล) */
const AUTH_DOMAIN = 'emesy.local';
const toAuthEmail = u => {
  const s = String(u || '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes('@')) return s; // รองรับอีเมลเดิมของส่วนกลาง
  return s + '@' + AUTH_DOMAIN;
};
const fromAuthEmail = e => {
  const s = String(e || '');
  if (s.endsWith('@' + AUTH_DOMAIN)) return s.slice(0, -(AUTH_DOMAIN.length + 1));
  return s;
};

const mapU = r => ({
  id: r.id,
  username: fromAuthEmail(r.email || ''),
  name: r.full_name || '',
  role: r.role || '',
  provinceId: r.province_id || '',
  districtId: r.district_id || '',
  subdistrictId: r.subdistrict_id || '',
  active: r.active ? 'Y' : 'N'
});

/* ========== API handlers ========== */
const H = {
  async login(d) {
    const email = toAuthEmail(d.username);
    if (!email) throw new Error('กรอกรหัสผู้ใช้');
    un(await sb.auth.signInWithPassword({
      email,
      password: String(d.password || '')
    }));
    return 1;
  },
  async me() {
    const s = (await sb.auth.getSession()).data.session;
    if (!s) throw new Error('กรุณาเข้าสู่ระบบ');
    const p = un(await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle());
    if (!p || !p.active || !p.role) {
      await sb.auth.signOut();
      throw new Error('บัญชียังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลส่วนกลาง');
    }
    const [pv, ds, sd, ty] = await Promise.all(
      ['provinces', 'districts', 'subdistricts', 'meeting_types'].map(t =>
        sb.from(t).select('*').order('name')
      )
    );
    return {
      user: {
        id: p.id,
        username: fromAuthEmail(p.email),
        name: p.full_name || fromAuthEmail(p.email),
        role: p.role,
        provinceId: p.province_id || '',
        districtId: p.district_id || '',
        subdistrictId: p.subdistrict_id || ''
      },
      provinces: un(pv),
      districts: un(ds).map(x => ({ id: x.id, name: x.name, provinceId: x.province_id })),
      subdistricts: un(sd).map(x => ({ id: x.id, name: x.name, districtId: x.district_id })),
      types: un(ty)
    };
  },
  async changePassword(d) {
    if (String(d.pw || '').length < 8) throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
    const s = (await sb.auth.getSession()).data.session;
    un(await sb.auth.signInWithPassword({ email: s.user.email, password: String(d.old || '') }));
    un(await sb.auth.updateUser({ password: d.pw }));
    return 1;
  },
  async saveGeo(d) {
    const n = String(d.name || '').trim();
    if (!n) throw new Error('กรอกชื่อ');
    const row = { name: n };
    if (d.kind === 'district') {
      if (!d.parentId) throw new Error('เลือกจังหวัด');
      row.province_id = d.parentId;
    }
    if (d.kind === 'subdistrict') {
      if (!d.parentId) throw new Error('เลือกอำเภอ');
      row.district_id = d.parentId;
    }
    const t = sbT[d.kind];
    un(await (d.id ? sb.from(t).update(row).eq('id', d.id) : sb.from(t).insert(row)));
    return 1;
  },
  async delGeo(d) {
    un(await sb.from(sbT[d.kind]).delete().eq('id', d.id));
    return 1;
  },
  async listUsers() {
    return un(await sb.from('profiles').select('*').order('email')).map(mapU);
  },
  async createUser(d) {
    const code = String(d.username || '').trim().toLowerCase().replace(/\s+/g, '');
    const password = String(d.password || '');
    const name = String(d.name || '').trim();
    if (!code) throw new Error('กรอกรหัสผู้ใช้');
    if (!/^[a-z0-9._-]{2,40}$/.test(code)) throw new Error('รหัสผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - (2–40 ตัว)');
    if (password.length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    if (!d.role) throw new Error('เลือกระดับ');
    if (!name) throw new Error('กรอกชื่อ-สกุล');

    const email = toAuthEmail(code);

    // เก็บ session ของส่วนกลางไว้ก่อน
    const { data: { session: adminSession } } = await sb.auth.getSession();
    if (!adminSession) throw new Error('กรุณาเข้าสู่ระบบใหม่');

    // สร้างบัญชี Auth
    const { data: su, error: se } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, username: code } }
    });
    if (se) {
      const m = se.message || '';
      throw new Error(
        /already registered|already been registered|User already registered/i.test(m)
          ? 'รหัสผู้ใช้นี้มีในระบบแล้ว'
          : /password/i.test(m) ? 'รหัสผ่านไม่ผ่านเงื่อนไขความปลอดภัย' : m
      );
    }
    const uid = su?.user?.id;
    if (!uid) throw new Error('สร้างบัญชีไม่สำเร็จ');

    // คืน session ส่วนกลางทันที
    await sb.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token
    });

    const r = d.role;
    const row = {
      id: uid,
      email,
      full_name: name,
      role: r,
      province_id: r === 'province' ? nl(d.provinceId) : null,
      district_id: r === 'district' ? nl(d.districtId) : null,
      subdistrict_id: r === 'subdistrict' ? nl(d.subdistrictId) : null,
      active: d.active !== false
    };
    const { error: pe } = await sb.from('profiles').upsert(row, { onConflict: 'id' });
    if (pe) {
      const { data: exist } = await sb.from('profiles').select('id').eq('id', uid).maybeSingle();
      if (exist) un(await sb.from('profiles').update(row).eq('id', uid));
      else un(await sb.from('profiles').insert(row));
    }
    return 1;
  },
  async saveUser(d) {
    if (!d.role) throw new Error('เลือกระดับ');
    const r = d.role;
    un(await sb.from('profiles').update({
      full_name: String(d.name || '').trim(),
      role: r,
      province_id: r === 'province' ? nl(d.provinceId) : null,
      district_id: r === 'district' ? nl(d.districtId) : null,
      subdistrict_id: r === 'subdistrict' ? nl(d.subdistrictId) : null,
      active: !!d.active
    }).eq('id', d.id));
    return 1;
  },
  async delUser(d) {
    if (!d || !d.id) throw new Error('ไม่พบผู้ใช้');
    // ห้ามลบตัวเอง
    const s = (await sb.auth.getSession()).data.session;
    if (s && d.id === s.user.id) throw new Error('ไม่สามารถลบบัญชีของตัวเองได้');
    // ลบแถว profiles (ผู้ใช้จะเข้าสู่ระบบไม่ได้) — บัญชีใน Authentication ยังอยู่ ลบถาวรได้ที่ Dashboard
    un(await sb.from('profiles').delete().eq('id', d.id));
    return 1;
  },
  async listMembers(d) {
    return un(await sb.from('members')
      .select('id,subdistrict_id,name,position')
      .eq('subdistrict_id', d.subdistrictId)
      .order('name')
    ).map(x => ({ id: x.id, subdistrictId: x.subdistrict_id, name: x.name, position: x.position || '' }));
  },
  async saveMember(d) {
    const n = String(d.name || '').trim();
    if (!n) throw new Error('กรอกชื่อ');
    const row = { subdistrict_id: d.subdistrictId, name: n, position: String(d.position || '').trim() };
    un(await (d.id ? sb.from('members').update(row).eq('id', d.id) : sb.from('members').insert(row)));
    return 1;
  },
  async saveMembers(d) {
    const have = new Set((await H.listMembers(d)).map(x => x.name));
    const rows = [];
    (d.list || []).slice(0, 300).forEach(x => {
      const n = String(x.name || '').trim();
      if (n && !have.has(n)) {
        have.add(n);
        rows.push({ subdistrict_id: d.subdistrictId, name: n, position: String(x.position || '').trim() });
      }
    });
    if (rows.length) un(await sb.from('members').insert(rows));
    return rows.length;
  },
  async delMember(d) {
    un(await sb.from('members').delete().eq('id', d.id));
    return 1;
  },
  async listMeetings(d) {
    let out = [], from = 0;
    for (;;) {
      const r = un(await sb.from('meetings').select('*')
        .gte('meeting_date', d.year + '-01-01')
        .lte('meeting_date', d.year + '-12-31')
        .order('meeting_date', { ascending: false })
        .order('id')
        .range(from, from + 999));
      out = out.concat(r);
      if (r.length < 1000) break;
      from += 1000;
    }
    return out.map(mapM);
  },
  async saveMeeting(d) {
    const sid = d.subdistrictId;
    if (!sid) throw new Error('เลือกตำบล');
    // เติม district_id / province_id จากตำบล (สำคัญต่อ RLS ของอำเภอ/จังหวัด)
    const sub = (typeof S !== 'undefined' ? S.subdistricts : []).find(x => x.id === sid);
    const distId = sub ? sub.districtId : (d.districtId || null);
    const dist = (typeof S !== 'undefined' ? S.districts : []).find(x => x.id === distId);
    const provId = dist ? dist.provinceId : (d.provinceId || null);
    const row = {
      meeting_date: d.date,
      type_id: d.typeId,
      subdistrict_id: sid,
      district_id: distId || null,
      province_id: provId || null,
      title: String(d.title || '').slice(0, 300),
      attendance: (d.attendance || []).map(a => ({
        id: a.id, name: a.name, position: a.position, present: !!a.present
      })),
      topics: (d.topics || []).map(t => ({
        title: String(t.title || '').slice(0, 300),
        detail: String(t.detail || '').slice(0, 5000)
      }))
    };
    if (!row.attendance.length) throw new Error('ไม่มีรายชื่อองค์ประชุม');
    // คำนวณจำนวน (กรณีไม่มี generated column / trigger)
    row.total = row.attendance.length;
    row.present = row.attendance.filter(a => a.present).length;
    row.absent = row.total - row.present;
    un(await (d.id ? sb.from('meetings').update(row).eq('id', d.id) : sb.from('meetings').insert(row)));
    return 1;
  },
  async delMeeting(d) {
    un(await sb.from('meetings').delete().eq('id', d.id));
    return 1;
  }
};

async function api(action, data) {
  if (S.user && Date.now() - last > IDLE) { doLogout(1); throw new Error(''); }
  load(1);
  try { return await H[action](data || {}); }
  catch (e) {
    if (S.user && /JWT|refresh token|not authenticated/i.test(e.message || '')) {
      doLogout(1, 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่');
      throw new Error('');
    }
    throw e;
  } finally { load(0); }
}
