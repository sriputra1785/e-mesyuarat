/* auth.js — login, logout, idle timeout */
/* ========== Auth / Idle ========== */
async function doLogin(ev) {
  ev.preventDefault();
  const f = ev.target;
  const errEl = document.getElementById('lerr');
  if (errEl) errEl.textContent = '';
  try {
    await api('login', { username: f.u.value, password: f.p.value });
    f.reset();
    // แยกหน้า: หลังล็อกอินไปหน้าแอป
    if (!document.getElementById('app')) {
      location.href = 'app.html';
      return;
    }
    await boot();
    toast('ยินดีต้อนรับ ' + S.user.name);
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}

async function boot() {
  const r = await api('me');
  S.user = r.user;
  S.provinces = r.provinces;
  S.districts = r.districts;
  S.subdistricts = r.subdistricts;
  S.types = r.types;
  S.my = null;
  last = Date.now();
  const landing = document.getElementById('landing');
  const app = document.getElementById('app');
  if (landing) landing.hidden = true;
  if (app) app.hidden = false;
  const who = document.getElementById('who');
  if (who) who.textContent = S.user.name + ' (' + ROLE[S.user.role] + ')';
  const c = S.user.role === 'central';
  const nav = document.getElementById('nav');
  if (nav) nav.innerHTML = [
    ['dash', 'แดชบอร์ด'],
    ['meet', 'การประชุม'],
    ['mem', 'องค์ประชุม'],
    ...(c ? [['users', 'ผู้ใช้'], ['master', 'ข้อมูลหลัก']] : [])
  ].map(x => `<button data-v="${x[0]}" onclick="go('${x[0]}')">${x[1]}</button>`).join('');
  go('dash');
}

async function doLogout(auto, msg) {
  S.user = null;
  S.meetings = [];
  S.users = [];
  S.members = [];
  S.my = null;
  if (typeof closeM === 'function') closeM();
  // รอ signOut เสร็จก่อน ไม่งั้นหน้า login จะเห็น session เก่าแล้วเด้งกลับ app
  try {
    await sb.auth.signOut({ scope: 'local' });
  } catch (_) {}
  try {
    Object.keys(sessionStorage).forEach(k => {
      if (/supabase|sb-|auth/i.test(k)) sessionStorage.removeItem(k);
    });
  } catch (_) {}

  if (!document.getElementById('landing')) {
    const q = auto ? ('?msg=' + encodeURIComponent(msg || 'ออกจากระบบอัตโนมัติ เนื่องจากไม่มีการใช้งานเกิน 30 นาที')) : '';
    location.replace('index.html' + q);
    return;
  }
  const app = document.getElementById('app');
  const landing = document.getElementById('landing');
  if (app) app.hidden = true;
  if (landing) landing.hidden = false;
  if ($('#view')) $('#view').innerHTML = '';
  if ($('#lerr')) $('#lerr').textContent = auto ? (msg || 'ออกจากระบบอัตโนมัติ เนื่องจากไม่มีการใช้งานเกิน 30 นาที') : '';
  scrollTo(0, 0);
  if (auto) {
    Swal.fire({
      icon: 'info',
      title: 'ออกจากระบบอัตโนมัติ',
      text: msg || 'ไม่มีการใช้งานเกิน 30 นาที กรุณาเข้าสู่ระบบใหม่',
      confirmButtonText: 'ตกลง'
    });
  }
}

let warned = false;
['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(e =>
  addEventListener(e, () => {
    if (S.user) {
      last = Date.now();
      if (warned) { warned = false; Swal.close(); }
    }
  }, { passive: true })
);
setInterval(() => {
  if (!S.user) return;
  const idle = Date.now() - last;
  if (idle > IDLE) {
    warned = false;
    doLogout(1);
  } else if (idle > IDLE - 60000 && !warned) {
    warned = true;
    Swal.fire({
      icon: 'warning',
      title: 'ไม่มีการใช้งานนาน',
      html: 'ระบบจะออกจากระบบใน <b></b> วินาที',
      timer: Math.max(IDLE - idle, 1000),
      timerProgressBar: true,
      allowOutsideClick: false,
      confirmButtonText: 'ใช้งานต่อ',
      didOpen: () => {
        const b = Swal.getHtmlContainer().querySelector('b');
        const t = setInterval(() => { b.textContent = Math.ceil(Swal.getTimerLeft() / 1000); }, 250);
        Swal.getPopup()._t = t;
      },
      willClose: () => clearInterval(Swal.getPopup()._t)
    }).then(r => {
      if (r.isConfirmed) last = Date.now();
      warned = false;
    });
  }
}, 5000);
document.addEventListener('visibilitychange', () => {
  if (S.user && Date.now() - last > IDLE) doLogout(1);
});
sb.auth.getSession().then(async r => {
  const sess = r.data.session;
  const onApp = document.getElementById('app') && !document.getElementById('landing');
  const onLogin = !!document.getElementById('landing');
  if (!sess) {
    if (onApp) location.replace('index.html');
    return;
  }
  // ตรวจ session กับเซิร์ฟเวอร์อีกครั้ง กัน token ค้าง
  try {
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) {
      await sb.auth.signOut({ scope: 'local' }).catch(() => {});
      if (onApp) location.replace('index.html');
      return;
    }
  } catch (_) {
    if (onApp) location.replace('index.html');
    return;
  }
  if (onApp) {
    boot().catch(() => { location.replace('index.html'); });
  } else if (onLogin) {
    location.replace('app.html');
  }
});
