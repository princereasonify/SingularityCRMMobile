/* eslint-disable */
// Professional User Manual HTML — shared as SingularityCRM_UserManual.html
// User can open in Chrome/Safari → Print → Save as PDF
export const MANUAL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<title>SingularityCRM — User Manual v1.0.0</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#eef0f4;color:#1f2937;font-size:14px;line-height:1.7}
a{color:inherit;text-decoration:none}

/* Print button */
.print-btn{position:fixed;bottom:22px;right:22px;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;border:none;border-radius:50px;padding:13px 24px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 18px rgba(13,148,136,.45);z-index:999;display:flex;align-items:center;gap:8px}
.print-btn:hover{transform:translateY(-2px)}

/* Cover */
.cover{background:linear-gradient(140deg,#0d9488 0%,#1d4ed8 100%);padding:56px 24px 52px;text-align:center;color:#fff}
.cover-logo{width:80px;height:80px;background:rgba(255,255,255,.18);border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 20px;border:2px solid rgba(255,255,255,.25)}
.cover h1{font-size:38px;font-weight:800;letter-spacing:-1px}
.cover .sub{font-size:16px;opacity:.85;margin-top:6px}
.cover-pills{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px}
.cover-pill{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:5px 16px;font-size:12px;font-weight:600}
.cover-meta{margin-top:28px;font-size:12px;opacity:.6}

/* Wrapper */
.wrap{max-width:900px;margin:0 auto;padding:0 16px 64px}

/* TOC */
.toc{background:#fff;border-radius:18px;margin:32px 0;box-shadow:0 2px 16px rgba(0,0,0,.07);overflow:hidden}
.toc-head{background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;padding:20px 28px}
.toc-head h2{font-size:17px;font-weight:700}
.toc-grid{display:grid;grid-template-columns:repeat(2,1fr);padding:8px}
.toc-link{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;color:#374151;font-size:13px;font-weight:500;transition:background .15s}
.toc-link:hover{background:#f0fdf4;color:#0d9488}
.toc-n{width:26px;height:26px;border-radius:7px;background:#f0fdf4;color:#0d9488;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}

/* Section */
.sec{background:#fff;border-radius:18px;margin-bottom:28px;box-shadow:0 2px 16px rgba(0,0,0,.07);overflow:hidden}
.sec-hdr{padding:24px 28px 18px;border-bottom:2px solid #f3f4f6;display:flex;align-items:flex-start;gap:16px}
.sec-ico{width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
.sec-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;opacity:.45;margin-bottom:4px}
.sec-hdr h2{font-size:23px;font-weight:800;color:#111827;line-height:1.25}
.sec-hdr p{color:#6b7280;font-size:14px;margin-top:5px}
.sec-body{padding:26px 28px}

/* Phone mockup */
.mw{display:flex;justify-content:center;margin:4px 0 28px}
.ph-device{width:256px;border-radius:30px;border:2px solid #d1d5db;background:#fff;overflow:hidden;box-shadow:0 10px 36px rgba(0,0,0,.16)}
.ph-notch{height:20px;background:#0f0f0f;display:flex;align-items:center;justify-content:center}
.ph-pill{width:58px;height:6px;background:#2a2a2a;border-radius:3px}
.ph-hdr{padding:11px 14px 9px;color:#fff}
.ph-hdr h4{font-size:15px;font-weight:800}
.ph-hdr small{font-size:9px;opacity:.78}
.ph-body{background:#f5f6f8}
.ph-field{margin:8px 10px 0}
.ph-label{font-size:8px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px}
.ph-input{width:100%;border:1.5px solid #e5e7eb;border-radius:8px;padding:7px 10px;font-size:11px;color:#111;background:#fff}
.ph-btn{margin:10px 10px 12px;border-radius:9px;padding:10px;text-align:center;font-weight:800;font-size:12px;color:#fff}
.kpi-row{display:flex;gap:6px;padding:8px}
.kpi-card{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:9px 5px;text-align:center;background:#fff}
.kpi-val{font-size:20px;font-weight:800;line-height:1}
.kpi-lbl{font-size:7.5px;color:#9ca3af;margin-top:3px;font-weight:600;text-transform:uppercase}
.bar-wrap{padding:0 10px 6px}
.bar-row{display:flex;justify-content:space-between;font-size:8.5px;color:#6b7280;font-weight:600;margin-bottom:3px}
.bar-bg{height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden}
.bar-fill{height:6px;border-radius:3px}
.tl-item{display:flex;gap:8px;align-items:center;padding:7px 10px;border-bottom:1px solid #f3f4f6}
.tl-dot{width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.tl-title{font-size:10px;font-weight:700;color:#111827}
.tl-sub{font-size:8.5px;color:#9ca3af;margin-top:1px}
.ph-search{margin:8px 10px;border:1.5px solid #e5e7eb;border-radius:8px;padding:7px 10px;font-size:10px;color:#9ca3af;background:#fff}
.chips{display:flex;gap:5px;padding:0 10px 7px;flex-wrap:wrap}
.chip{border-radius:20px;padding:3px 10px;font-size:9px;font-weight:700;border:1px solid #e5e7eb;color:#6b7280;background:#f3f4f6}
.chip.on{color:#fff;border-color:transparent}
.lead-card{border:1.5px solid #e5e7eb;border-radius:10px;padding:9px 11px;background:#fff;margin-bottom:6px;border-left-width:3px}
.lead-hot{font-size:8.5px;color:#d97706;font-weight:700;margin-bottom:2px}
.lead-title{font-size:11px;font-weight:700;color:#111827}
.lead-meta{font-size:8.5px;color:#9ca3af;margin-top:2px}
.lead-row{display:flex;justify-content:space-between;align-items:center;margin-top:6px}
.lead-val{font-size:11px;font-weight:700;color:#374151}
.score{border-radius:20px;padding:2px 8px;font-size:8.5px;font-weight:700}
.overdue{font-size:8.5px;color:#ef4444;margin-top:4px;font-weight:600}
.k-row{display:flex;gap:5px;padding:8px;overflow:hidden}
.k-col{width:80px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;flex-shrink:0}
.k-col-hdr{padding:5px 7px;background:#f3f4f6;display:flex;justify-content:space-between;align-items:center}
.k-title{font-size:7.5px;font-weight:700;color:#6b7280}
.k-badge{border-radius:10px;padding:1px 6px;font-size:7.5px;font-weight:700;color:#fff}
.k-body{padding:4px;display:flex;flex-direction:column;gap:3px}
.k-card{border:1px solid #e5e7eb;border-radius:6px;padding:5px 7px;background:#fff}
.k-card-t{font-size:8px;font-weight:700;color:#111}
.k-card-m{font-size:7px;color:#9ca3af;margin-top:1px}
.k-drop{border:2px dashed;border-radius:6px;padding:5px;text-align:center;font-size:7.5px;font-weight:700;margin-bottom:3px}
.ghost{margin:4px 10px 10px;border:1px solid #e5e7eb;border-radius:10px;padding:9px 11px;background:#fff;border-left:3px solid #7c3aed;box-shadow:0 6px 22px rgba(0,0,0,.18)}
.ghost-t{font-size:10px;font-weight:700;color:#111}
.ghost-m{font-size:8.5px;color:#9ca3af;margin-top:2px}
.sch-card{border:1.5px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#fff;margin-bottom:6px;border-left-width:3px;display:flex;justify-content:space-between;align-items:center}
.sch-name{font-size:11px;font-weight:700;color:#111827}
.sch-meta{font-size:8.5px;color:#9ca3af;margin-top:2px}
.sch-score{text-align:center}
.sch-score-val{font-size:22px;font-weight:800;line-height:1}
.sch-score-lbl{font-size:8px;font-weight:700}
.t-wrap{padding:10px}
.t-row{margin-bottom:10px}
.t-row-hdr{display:flex;justify-content:space-between;margin-bottom:4px;font-size:9px;font-weight:700}
.track-status{margin:8px 10px;border-radius:10px;padding:10px;background:#dcfce7;text-align:center}
.track-active{font-size:10.5px;font-weight:700;color:#16a34a}
.track-sub{font-size:8.5px;color:#15803d;margin-top:2px}
.track-btns{display:flex;gap:6px;margin:0 10px 8px}
.track-btn{flex:1;border-radius:8px;padding:9px;text-align:center;font-size:10px;font-weight:700;color:#fff}
.ai-item{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}
.ai-cb{width:18px;height:18px;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.ai-text{font-size:11px;line-height:1.5}
.set-row{display:flex;align-items:center;padding:9px 12px;border-bottom:1px solid #f3f4f6}
.set-lbl{font-size:10.5px;font-weight:600;color:#111827;flex:1}
.set-sub{font-size:8px;color:#9ca3af}
.set-arr{font-size:16px;color:#d1d5db;margin-left:8px}

/* Content */
.sub{margin-bottom:22px}
.sub:last-child{margin-bottom:0}
.sub-title{font-size:15px;font-weight:800;color:#111827;margin-bottom:13px;display:flex;align-items:center;gap:8px;padding-bottom:7px;border-bottom:2px solid #f3f4f6}
.sub-dot{width:9px;height:9px;border-radius:3px;flex-shrink:0}

/* Steps */
.steps{display:flex;flex-direction:column;gap:10px}
.step{display:flex;gap:14px;align-items:flex-start}
.step-n{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0;margin-top:2px}
.step-t{flex:1;font-size:14px;color:#374151;line-height:1.65;padding-top:3px}
.step-t strong{color:#111827}

/* Bullets */
.bullets{display:flex;flex-direction:column;gap:9px}
.bullet{display:flex;gap:10px;align-items:flex-start}
.bdot{width:7px;height:7px;border-radius:2px;flex-shrink:0;margin-top:6px}
.btext{flex:1;font-size:14px;color:#374151;line-height:1.65}

/* Table */
table.dt{width:100%;border-collapse:separate;border-spacing:0;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;margin:4px 0}
table.dt thead tr{background:#f9fafb}
table.dt th{padding:10px 14px;font-size:10.5px;font-weight:700;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #e5e7eb}
table.dt td{padding:11px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;line-height:1.5}
table.dt tbody tr:last-child td{border-bottom:none}
table.dt tbody tr:nth-child(even) td{background:#fafafa}

/* Callout boxes */
.box{border-radius:11px;padding:13px 16px;margin:16px 0;display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.6}
.box-ico{font-size:16px;flex-shrink:0;margin-top:2px}
.box-body strong{display:block;font-weight:700;margin-bottom:2px}
.box.info{background:#eff6ff;border-left:4px solid #2563eb;color:#1e3a8a}
.box.tip{background:#f0fdf4;border-left:4px solid #16a34a;color:#14532d}
.box.warn{background:#fffbeb;border-left:4px solid #f59e0b;color:#78350f}
.box.danger{background:#fef2f2;border-left:4px solid #dc2626;color:#7f1d1d}

/* Role badges */
.rbadge{display:inline-flex;align-items:center;gap:5px;border-radius:20px;padding:5px 14px;font-size:12px;font-weight:700;margin:3px}
.rbadges{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px}

/* Feature grid */
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
.fcell{border:1px solid #e5e7eb;border-radius:12px;padding:15px;background:#fafafa}
.fcell h4{font-size:13px;font-weight:700;color:#111827;margin-bottom:5px}
.fcell p{font-size:12px;color:#6b7280;line-height:1.55}

hr.div{border:none;border-top:2px solid #f3f4f6;margin:22px 0}

/* Footer */
.footer{text-align:center;padding:36px 24px;color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;margin-top:16px}

/* Print */
@media print{
  body{background:#fff}
  .print-btn{display:none}
  .cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sec{box-shadow:none;border:1px solid #e5e7eb;break-inside:avoid}
  .mw{display:none}
  .toc{box-shadow:none;border:1px solid #e5e7eb}
}

/* Mobile */
@media(max-width:600px){
  .toc-grid{grid-template-columns:1fr}
  .fgrid{grid-template-columns:1fr}
  .cover h1{font-size:28px}
  .sec-hdr{padding:18px 20px 14px}
  .sec-body{padding:18px 20px}
}
</style>
</head>
<body>

<button class="print-btn" onclick="window.print()">⬇ Save as PDF</button>

<!-- ═══ COVER ═══ -->
<div class="cover">
  <div class="cover-logo">📊</div>
  <h1>SingularityCRM</h1>
  <p class="sub">EduCRM Sales Portal &nbsp;·&nbsp; Mobile Application</p>
  <div class="cover-pills">
    <span class="cover-pill">📱 User Manual</span>
    <span class="cover-pill">v 1.0.0</span>
    <span class="cover-pill">14 Sections</span>
    <span class="cover-pill">React Native</span>
  </div>
  <p class="cover-meta">For Field Officers · Zone Heads · Regional Heads · Sales Heads</p>
</div>

<div class="wrap">

<!-- ═══ TABLE OF CONTENTS ═══ -->
<div class="toc">
  <div class="toc-head"><h2>📋 &nbsp;Table of Contents</h2></div>
  <div class="toc-grid">
    <a href="#s1" class="toc-link"><span class="toc-n">1</span>Login</a>
    <a href="#s2" class="toc-link"><span class="toc-n">2</span>User Roles</a>
    <a href="#s3" class="toc-link"><span class="toc-n">3</span>Dashboard</a>
    <a href="#s4" class="toc-link"><span class="toc-n">4</span>Leads Management</a>
    <a href="#s5" class="toc-link"><span class="toc-n">5</span>Pipeline (Kanban)</a>
    <a href="#s6" class="toc-link"><span class="toc-n">6</span>Schools</a>
    <a href="#s7" class="toc-link"><span class="toc-n">7</span>Contacts</a>
    <a href="#s8" class="toc-link"><span class="toc-n">8</span>Activities</a>
    <a href="#s9" class="toc-link"><span class="toc-n">9</span>Targets</a>
    <a href="#s10" class="toc-link"><span class="toc-n">10</span>Location Tracking</a>
    <a href="#s11" class="toc-link"><span class="toc-n">11</span>AI Features</a>
    <a href="#s12" class="toc-link"><span class="toc-n">12</span>Settings</a>
    <a href="#s13" class="toc-link"><span class="toc-n">13</span>Offline Mode</a>
    <a href="#s14" class="toc-link"><span class="toc-n">14</span>Audit History</a>
  </div>
</div>

<!-- ═══ SECTION 1 — LOGIN ═══ -->
<div class="sec" id="s1">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#e6fffa">🔐</div>
    <div>
      <div class="sec-label">Section 01</div>
      <h2>Login</h2>
      <p>Access the app with your registered email and password. Sessions remain active for 7 days.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="mw">
      <div class="ph-device">
        <div class="ph-notch"><div class="ph-pill"></div></div>
        <div style="text-align:center;padding:22px 18px 8px;background:#fff">
          <div style="font-size:34px;margin-bottom:8px">◉</div>
          <div style="font-weight:800;font-size:17px;color:#0d9488">SingularityCRM</div>
          <div style="font-size:10px;color:#9ca3af;margin-top:3px">EduCRM Sales Portal</div>
        </div>
        <div class="ph-field"><span class="ph-label">Email Address</span><div class="ph-input">rajesh@educrm.in</div></div>
        <div class="ph-field" style="margin-bottom:0"><span class="ph-label">Password</span><div class="ph-input">••••••••</div></div>
        <div class="ph-btn" style="background:#0d9488">Login →</div>
        <div style="text-align:center;font-size:9px;color:#9ca3af;padding-bottom:14px">Forgot password? &nbsp;|&nbsp; v1.0.0</div>
      </div>
    </div>

    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#0d9488"></div>Steps to Log In</div>
      <div class="steps">
        <div class="step"><div class="step-n" style="background:#0d9488">1</div><div class="step-t">Open the app and wait for the login screen.</div></div>
        <div class="step"><div class="step-n" style="background:#0d9488">2</div><div class="step-t">Enter your <strong>official Email Address</strong> given by your administrator.</div></div>
        <div class="step"><div class="step-n" style="background:#0d9488">3</div><div class="step-t">Enter your <strong>Password</strong>. Tap the eye icon to show or hide it.</div></div>
        <div class="step"><div class="step-n" style="background:#0d9488">4</div><div class="step-t">Tap <strong>Login</strong> — your dashboard loads based on your assigned role.</div></div>
      </div>
    </div>

    <div class="box tip"><span class="box-ico">✅</span><div class="box-body"><strong>Session Duration</strong>You stay logged in for 7 days. You won't be asked to log in again unless you manually log out or your session expires.</div></div>
    <div class="box warn"><span class="box-ico">⚠️</span><div class="box-body"><strong>Forgot Password?</strong>Contact your system administrator to reset your password. Self-service reset is not available.</div></div>

    <hr class="div">
    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#dc2626"></div>Common Login Errors</div>
      <table class="dt">
        <thead><tr><th>Error</th><th>Cause</th><th>Solution</th></tr></thead>
        <tbody>
          <tr><td><strong>Invalid credentials</strong></td><td>Wrong email or password</td><td>Re-enter carefully or contact admin</td></tr>
          <tr><td><strong>Network Error</strong></td><td>No internet connection</td><td>Check Wi-Fi or mobile data</td></tr>
          <tr><td><strong>Account inactive</strong></td><td>Account disabled by admin</td><td>Contact your administrator</td></tr>
          <tr><td><strong>Server Unavailable</strong></td><td>Backend temporarily down</td><td>Wait 5 min and try again</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- ═══ SECTION 2 — ROLES ═══ -->
<div class="sec" id="s2">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#ede9fe">👥</div>
    <div>
      <div class="sec-label">Section 02</div>
      <h2>User Roles</h2>
      <p>Four roles, each with a unique colour theme, tab set, and access level.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="rbadges">
      <span class="rbadge" style="background:#e6fffa;color:#0d9488">● FO — Field Officer</span>
      <span class="rbadge" style="background:#ede9fe;color:#7c3aed">● ZH — Zone Head</span>
      <span class="rbadge" style="background:#fff7ed;color:#ea580c">● RH — Regional Head</span>
      <span class="rbadge" style="background:#eff6ff;color:#2563eb">● SH — Sales Head</span>
    </div>
    <table class="dt">
      <thead><tr><th>Role</th><th>Full Name</th><th>Colour</th><th>Key Access</th></tr></thead>
      <tbody>
        <tr><td><strong style="color:#0d9488">FO</strong></td><td>Field Officer</td><td>🟢 Teal</td><td>Own leads, schools, tracking, targets</td></tr>
        <tr><td><strong style="color:#7c3aed">ZH</strong></td><td>Zone Head</td><td>🟣 Purple</td><td>Zone leads, pipeline, live tracking, users</td></tr>
        <tr><td><strong style="color:#ea580c">RH</strong></td><td>Regional Head</td><td>🟠 Orange</td><td>Regional pipeline, reports, team tracking</td></tr>
        <tr><td><strong style="color:#2563eb">SH</strong></td><td>Sales Head</td><td>🔵 Blue</td><td>All regions, full reports, pipeline overview</td></tr>
      </tbody>
    </table>
    <div class="box info" style="margin-top:16px"><span class="box-ico">ℹ️</span><div class="box-body"><strong>Role-based UI</strong>The app header colour, available tabs, and features change based on your role. FO users see fewer tabs; SH users see the full suite.</div></div>
  </div>
</div>

<!-- ═══ SECTION 3 — DASHBOARD ═══ -->
<div class="sec" id="s3">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#e6fffa">📊</div>
    <div>
      <div class="sec-label">Section 03</div>
      <h2>Dashboard</h2>
      <p>Your command centre — KPIs, monthly target, today's AI plan, and team timeline at a glance.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="mw">
      <div class="ph-device">
        <div class="ph-notch"><div class="ph-pill"></div></div>
        <div class="ph-hdr" style="background:#0d9488"><h4>Good Morning, Ravi! 🌤</h4><small>Monday, 24 March 2026</small></div>
        <div class="ph-body">
          <div class="kpi-row">
            <div class="kpi-card"><div class="kpi-val" style="color:#0d9488">3</div><div class="kpi-lbl">Visits</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color:#2563eb">7</div><div class="kpi-lbl">Calls</div></div>
            <div class="kpi-card"><div class="kpi-val" style="color:#ea580c">24</div><div class="kpi-lbl">Leads</div></div>
          </div>
          <div class="bar-wrap">
            <div class="bar-row"><span style="color:#111;font-weight:700">Monthly Revenue</span><span style="color:#dc2626">40% · Behind</span></div>
            <div class="bar-bg"><div class="bar-fill" style="width:40%;background:#dc2626"></div></div>
          </div>
          <div style="padding:8px 10px 4px;font-size:9px;font-weight:700;color:#374151;margin-top:4px">Today's Plan</div>
          <div class="tl-item"><div class="tl-dot" style="background:#dcfce7">🏫</div><div><div class="tl-title">Delhi Public School</div><div class="tl-sub">9:00 AM · Visit</div></div></div>
          <div class="tl-item" style="border-bottom:none"><div class="tl-dot" style="background:#eff6ff">📞</div><div><div class="tl-title">Modern Academy</div><div class="tl-sub">11:00 AM · Call</div></div></div>
        </div>
      </div>
    </div>

    <div class="fgrid">
      <div class="fcell"><h4>📈 KPI Cards</h4><p>Daily visits, calls, and active lead counts. Tap any card for a detailed breakdown.</p></div>
      <div class="fcell"><h4>🎯 Target Bar</h4><p>Monthly revenue progress with colour-coded status: green / amber / red.</p></div>
      <div class="fcell"><h4>📅 Today's Plan</h4><p>AI-generated schedule of priority visits, calls, and follow-ups for today.</p></div>
      <div class="fcell"><h4>🔄 Pull to Refresh</h4><p>Drag the screen downward to reload the latest data from the server.</p></div>
    </div>
    <div class="box tip" style="margin-top:14px"><span class="box-ico">💡</span><div class="box-body"><strong>Customise Your Dashboard</strong>Go to <strong>Settings → Dashboard → Customize Dashboard</strong> to toggle widgets on/off and reorder them to match your workflow.</div></div>
  </div>
</div>

<!-- ═══ SECTION 4 — LEADS ═══ -->
<div class="sec" id="s4">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#e6fffa">📋</div>
    <div>
      <div class="sec-label">Section 04</div>
      <h2>Leads Management</h2>
      <p>Create, search, filter, and manage the full lifecycle of school sales leads.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="mw">
      <div class="ph-device">
        <div class="ph-notch"><div class="ph-pill"></div></div>
        <div class="ph-hdr" style="background:#0d9488"><h4>Leads</h4><small>47 leads · ₹1,24,50,000</small></div>
        <div class="ph-body">
          <div class="ph-search">🔍 Search school or city...</div>
          <div class="chips">
            <div class="chip on" style="background:#0d9488">All</div>
            <div class="chip">New</div><div class="chip">Demo</div><div class="chip">Won</div>
          </div>
          <div style="padding:0 8px 10px">
            <div class="lead-card" style="border-left-color:#f59e0b">
              <div class="lead-hot">🔥 Hot</div>
              <div class="lead-title">Delhi Public School</div>
              <div class="lead-meta">Dwarka · CBSE · Demo Done</div>
              <div class="lead-row"><span class="lead-val">₹2,40,000</span><span class="score" style="background:#dcfce7;color:#16a34a">82</span></div>
            </div>
            <div class="lead-card" style="border-left-color:#ef4444;margin-bottom:0">
              <div class="lead-title">Modern Academy</div>
              <div class="lead-meta">Rohini · ICSE · Contacted</div>
              <div class="lead-row"><span class="lead-val">₹1,80,000</span><span class="score" style="background:#fef3c7;color:#d97706">54</span></div>
              <div class="overdue">⚠ No activity in 6 days</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#0d9488"></div>Adding a New Lead</div>
      <div class="steps">
        <div class="step"><div class="step-n" style="background:#0d9488">1</div><div class="step-t">Tap the <strong>+ button</strong> at the top-right of the Leads screen.</div></div>
        <div class="step"><div class="step-n" style="background:#0d9488">2</div><div class="step-t">Fill in <strong>School Name, City, Board, Source,</strong> and <strong>Estimated Value</strong>.</div></div>
        <div class="step"><div class="step-n" style="background:#0d9488">3</div><div class="step-t">A <strong>real-time duplicate check</strong> runs as you type — a yellow banner appears if a match is found.</div></div>
        <div class="step"><div class="step-n" style="background:#0d9488">4</div><div class="step-t">Tap <strong>Add Lead</strong> to save. The lead appears in your list immediately.</div></div>
      </div>
    </div>

    <hr class="div">
    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#f59e0b"></div>Lead Card Indicators</div>
      <table class="dt">
        <thead><tr><th>Indicator</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td>🔥 <strong>Hot badge</strong> + amber border</td><td>AI score ≥ 70 — high chance of conversion</td></tr>
          <tr><td>🔴 <strong>Red left border</strong></td><td>Overdue — no activity logged in 5+ days</td></tr>
          <tr><td><span style="background:#dcfce7;color:#16a34a;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700">82</span></td><td>Green score (70–100) — high probability</td></tr>
          <tr><td><span style="background:#fef3c7;color:#d97706;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700">54</span></td><td>Amber score (40–69) — moderate probability</td></tr>
          <tr><td><span style="background:#fee2e2;color:#dc2626;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700">28</span></td><td>Red score (0–39) — low probability</td></tr>
        </tbody>
      </table>
    </div>

    <hr class="div">
    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#ea580c"></div>Lead Stages</div>
      <table class="dt">
        <thead><tr><th>Stage</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><strong>New Lead</strong></td><td>Created — not yet contacted</td></tr>
          <tr><td><strong>Contacted</strong></td><td>First contact made via call or visit</td></tr>
          <tr><td><strong>Qualified</strong></td><td>Budget confirmed, decision-maker identified</td></tr>
          <tr><td><strong>Demo Stage</strong></td><td>Product demo scheduled</td></tr>
          <tr><td><strong>Demo Done</strong></td><td>Demo completed successfully</td></tr>
          <tr><td><strong>Proposal Sent</strong></td><td>Commercial proposal delivered</td></tr>
          <tr><td><strong>Negotiation</strong></td><td>Terms under active discussion</td></tr>
          <tr><td><strong>Contract Sent</strong></td><td>Agreement shared for signing</td></tr>
          <tr><td><strong>Won ✅</strong></td><td>Deal closed and signed</td></tr>
          <tr><td><strong>Implementation</strong></td><td>Onboarding in progress</td></tr>
          <tr><td><strong>Lost ❌</strong></td><td>Deal not progressed — reason logged</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- ═══ SECTION 5 — PIPELINE ═══ -->
<div class="sec" id="s5">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#ede9fe">🗂</div>
    <div>
      <div class="sec-label">Section 05</div>
      <h2>Pipeline (Kanban Board)</h2>
      <p>Visual board with pinch-to-zoom, two-finger pan, and drag-and-drop card movement between stages.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="mw">
      <div class="ph-device">
        <div class="ph-notch"><div class="ph-pill"></div></div>
        <div class="ph-hdr" style="background:#7c3aed;display:flex;justify-content:space-between;align-items:center">
          <div><h4>Pipeline</h4><small>47 leads</small></div>
          <div style="display:flex;gap:5px">
            <div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff">−</div>
            <div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff">+</div>
          </div>
        </div>
        <div class="ph-body">
          <div style="background:#ede9fe;padding:4px 8px;text-align:center;font-size:8px;color:#6d28d9;font-weight:600">🤏 Pinch · ✌ Pan · 👆 Long press card to move</div>
          <div class="k-row">
            <div class="k-col"><div class="k-col-hdr"><span class="k-title">NEW</span><div class="k-badge" style="background:#7c3aed">12</div></div><div class="k-body"><div class="k-card"><div class="k-card-t">DPS Dwarka</div><div class="k-card-m">₹2.4L · 82</div></div><div class="k-card"><div class="k-card-t">Bloom Int'l</div><div class="k-card-m">₹1.6L · 45</div></div></div></div>
            <div class="k-col"><div class="k-col-hdr"><span class="k-title">QUALIFIED</span><div class="k-badge" style="background:#7c3aed">8</div></div><div class="k-body"><div class="k-card"><div class="k-card-t">GD Goenka</div><div class="k-card-m">₹2.1L · 61</div></div></div></div>
            <div class="k-col" style="border:2px solid #7c3aed"><div class="k-col-hdr" style="background:#ede9fe"><span class="k-title" style="color:#7c3aed">DEMO</span><div class="k-badge" style="background:#7c3aed">11</div></div><div class="k-body"><div class="k-drop" style="border-color:#7c3aed;color:#7c3aed">↓ Drop here</div><div class="k-card"><div class="k-card-t">Oxford Int'l</div><div class="k-card-m">₹2.8L</div></div></div></div>
          </div>
          <div class="ghost"><div class="ghost-t">🔥 Sunrise Int'l <span style="font-size:8px;color:#7c3aed;font-weight:700">[Dragging]</span></div><div class="ghost-m">₹4,50,000 · Score: 76</div></div>
        </div>
      </div>
    </div>

    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#7c3aed"></div>How to Drag &amp; Drop a Card</div>
      <div class="steps">
        <div class="step"><div class="step-n" style="background:#7c3aed">1</div><div class="step-t"><strong>Long press</strong> any lead card for about 0.4 seconds — a ghost copy appears under your finger.</div></div>
        <div class="step"><div class="step-n" style="background:#7c3aed">2</div><div class="step-t"><strong>Keep finger down and drag</strong> to the target column — it highlights with a dashed "↓ Drop here" zone.</div></div>
        <div class="step"><div class="step-n" style="background:#7c3aed">3</div><div class="step-t"><strong>Lift your finger</strong> to drop. The card moves instantly (optimistic update).</div></div>
        <div class="step"><div class="step-n" style="background:#7c3aed">4</div><div class="step-t">The change syncs to server. If the sync fails, the card automatically reverts.</div></div>
      </div>
    </div>

    <div class="box info"><span class="box-ico">ℹ️</span><div class="box-body"><strong>Zoom &amp; Pan lock during drag</strong>Pinch-zoom and two-finger pan are disabled while a card is being dragged. A short tap (&lt;0.4 s) opens Lead Detail as usual.</div></div>

    <hr class="div">
    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#7c3aed"></div>Board Controls Reference</div>
      <table class="dt">
        <thead><tr><th>Gesture / Button</th><th>Action</th></tr></thead>
        <tbody>
          <tr><td>👌 Pinch in / out</td><td>Zoom the board in or out</td></tr>
          <tr><td>✌️ Two-finger drag</td><td>Pan the board in any direction</td></tr>
          <tr><td>− button</td><td>Zoom out by 20%</td></tr>
          <tr><td>+ button</td><td>Zoom in by 20%</td></tr>
          <tr><td>⊡ Reset button</td><td>Reset zoom and pan to default</td></tr>
          <tr><td>☝️ Single-finger scroll</td><td>Scroll cards up/down within a column</td></tr>
          <tr><td>👆 Short tap (&lt; 0.4 s)</td><td>Open Lead Detail screen</td></tr>
          <tr><td>👆 Long press (≥ 0.4 s)</td><td>Activate drag mode</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- ═══ SECTION 6 — SCHOOLS ═══ -->
<div class="sec" id="s6">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#fff7ed">🏫</div>
    <div>
      <div class="sec-label">Section 06</div>
      <h2>Schools</h2>
      <p>School database with AI priority scoring and real-time duplicate detection.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="mw">
      <div class="ph-device">
        <div class="ph-notch"><div class="ph-pill"></div></div>
        <div class="ph-hdr" style="background:#0d9488"><h4>Schools</h4><small>63 schools</small></div>
        <div class="ph-body">
          <div class="ph-search">🔍 Search schools...</div>
          <div class="chips">
            <div class="chip">All</div>
            <div class="chip on" style="background:#ea580c">Priority 🔥</div>
          </div>
          <div style="padding:0 8px 10px">
            <div class="sch-card" style="border-left-color:#ea580c">
              <div><div class="sch-name">Delhi Public School</div><div class="sch-meta">Dwarka · CBSE · Private</div></div>
              <div class="sch-score"><div class="sch-score-val" style="color:#ea580c">94</div><div class="sch-score-lbl" style="color:#ea580c">HIGH</div></div>
            </div>
            <div class="sch-card" style="border-left-color:#d97706;margin-bottom:0">
              <div><div class="sch-name">Sunrise International</div><div class="sch-meta">Gurgaon · IB</div></div>
              <div class="sch-score"><div class="sch-score-val" style="color:#d97706">72</div><div class="sch-score-lbl" style="color:#d97706">MEDIUM</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#ea580c"></div>Priority Levels</div>
      <table class="dt">
        <thead><tr><th>Priority</th><th>Score</th><th>Recommended Action</th></tr></thead>
        <tbody>
          <tr><td><strong style="color:#ea580c">🔴 HIGH</strong></td><td>80 – 100</td><td>Visit this week — at risk of going cold</td></tr>
          <tr><td><strong style="color:#d97706">🟡 MEDIUM</strong></td><td>50 – 79</td><td>Visit within the next 2 weeks</td></tr>
          <tr><td><strong style="color:#16a34a">🟢 LOW</strong></td><td>0 – 49</td><td>On track — no urgent action needed</td></tr>
        </tbody>
      </table>
    </div>

    <hr class="div">
    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#ea580c"></div>Duplicate Detection</div>
      <div class="steps">
        <div class="step"><div class="step-n" style="background:#ea580c">1</div><div class="step-t">As you type the School Name and City in the Add School form, matching runs automatically.</div></div>
        <div class="step"><div class="step-n" style="background:#ea580c">2</div><div class="step-t">A <strong>yellow warning banner</strong> shows how many potential duplicates were found.</div></div>
        <div class="step"><div class="step-n" style="background:#ea580c">3</div><div class="step-t">On submit, a modal lists matches as: <strong>Definite · Probable · Possible</strong>.</div></div>
        <div class="step"><div class="step-n" style="background:#ea580c">4</div><div class="step-t">Tap <strong>View Existing</strong> to review, or <strong>Create Anyway</strong> if it is a different school.</div></div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SECTION 7 — CONTACTS ═══ -->
<div class="sec" id="s7">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#e6fffa">👤</div>
    <div>
      <div class="sec-label">Section 07</div>
      <h2>Contacts</h2>
      <p>Manage key people at each school — principals, finance heads, coordinators, and decision-makers.</p>
    </div>
  </div>
  <div class="sec-body">
    <table class="dt">
      <thead><tr><th>Relationship Stage</th><th>Meaning</th><th>How to Progress</th></tr></thead>
      <tbody>
        <tr><td><strong>New</strong></td><td>First contact — no relationship yet</td><td>Introduction call or school visit</td></tr>
        <tr><td><strong>Warm</strong></td><td>Shows interest after conversations</td><td>Follow up with value-added content</td></tr>
        <tr><td><strong>Strong</strong></td><td>Trusts the FO — regular interaction</td><td>Demo scheduling and proposal</td></tr>
        <tr><td><strong>Champion</strong></td><td>Advocates for the product internally</td><td>Empower with collateral and support</td></tr>
        <tr><td><strong>Detractor</strong></td><td>Opposed or resistant</td><td>Escalate to manager — handle with care</td></tr>
      </tbody>
    </table>
    <div class="box tip" style="margin-top:16px"><span class="box-ico">💬</span><div class="box-body"><strong>WhatsApp Integration</strong>Open any Contact Detail and tap the <strong>WhatsApp button</strong> to start a direct chat. Requires WhatsApp to be installed on the device.</div></div>
  </div>
</div>

<!-- ═══ SECTION 8 — ACTIVITIES ═══ -->
<div class="sec" id="s8">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#e6fffa">📝</div>
    <div>
      <div class="sec-label">Section 08</div>
      <h2>Activities</h2>
      <p>Log every customer interaction to maintain a complete history and keep lead scores updated.</p>
    </div>
  </div>
  <div class="sec-body">
    <table class="dt">
      <thead><tr><th>Type</th><th>When to Use</th><th>Suggested Next Action</th></tr></thead>
      <tbody>
        <tr><td>🏫 <strong>Visit</strong></td><td>In-person school visit</td><td>Log observations, set follow-up date</td></tr>
        <tr><td>📞 <strong>Call</strong></td><td>Phone or video call</td><td>Note key discussion points</td></tr>
        <tr><td>🖥 <strong>Demo</strong></td><td>Product demonstration</td><td>Record feedback, move lead stage</td></tr>
        <tr><td>📄 <strong>Proposal</strong></td><td>Proposal presented or sent</td><td>Set follow-up for decision</td></tr>
        <tr><td>🔄 <strong>FollowUp</strong></td><td>Follow-up after any interaction</td><td>Update contact relationship stage</td></tr>
        <tr><td>📑 <strong>Contract</strong></td><td>Contract discussion or signing</td><td>Move lead to Won or Negotiation</td></tr>
      </tbody>
    </table>
    <div class="box info" style="margin-top:16px"><span class="box-ico">ℹ️</span><div class="box-body"><strong>Activity affects Lead Score</strong>Logging activities regularly keeps the AI score updated. Leads with no activity in 5+ days are flagged overdue with a red border.</div></div>
  </div>
</div>

<!-- ═══ SECTION 9 — TARGETS ═══ -->
<div class="sec" id="s9">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#e6fffa">🎯</div>
    <div>
      <div class="sec-label">Section 09</div>
      <h2>Targets</h2>
      <p>Monthly sales targets vs. actual performance with colour-coded progress bars.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="mw">
      <div class="ph-device">
        <div class="ph-notch"><div class="ph-pill"></div></div>
        <div class="ph-hdr" style="background:#0d9488"><h4>Targets</h4><small>March 2026</small></div>
        <div class="ph-body">
          <div class="t-wrap">
            <div class="t-row"><div class="t-row-hdr"><span style="color:#111;font-weight:700">Revenue</span><span style="color:#dc2626">₹4.8L / ₹12L · 40%</span></div><div class="bar-bg"><div class="bar-fill" style="width:40%;background:#dc2626"></div></div><div style="font-size:8px;color:#dc2626;margin-top:2px;font-weight:600">● Behind</div></div>
            <div class="t-row"><div class="t-row-hdr"><span style="color:#111;font-weight:700">Visits</span><span style="color:#f59e0b">18 / 30 · 60%</span></div><div class="bar-bg"><div class="bar-fill" style="width:60%;background:#f59e0b"></div></div><div style="font-size:8px;color:#f59e0b;margin-top:2px;font-weight:600">● At Risk</div></div>
            <div class="t-row"><div class="t-row-hdr"><span style="color:#111;font-weight:700">New Leads</span><span style="color:#16a34a">14 / 20 · 70%</span></div><div class="bar-bg"><div class="bar-fill" style="width:70%;background:#16a34a"></div></div><div style="font-size:8px;color:#16a34a;margin-top:2px;font-weight:600">● On Track</div></div>
          </div>
        </div>
      </div>
    </div>

    <table class="dt">
      <thead><tr><th>Colour</th><th>Status</th><th>Achievement Level</th></tr></thead>
      <tbody>
        <tr><td><span style="color:#16a34a;font-weight:700">🟢 Green</span></td><td><strong>On Track</strong></td><td>≥ 66% of target achieved</td></tr>
        <tr><td><span style="color:#f59e0b;font-weight:700">🟡 Amber</span></td><td><strong>At Risk</strong></td><td>33% – 65% of target achieved</td></tr>
        <tr><td><span style="color:#dc2626;font-weight:700">🔴 Red</span></td><td><strong>Behind</strong></td><td>&lt; 33% of target achieved</td></tr>
      </tbody>
    </table>
    <div class="box info" style="margin-top:14px"><span class="box-ico">ℹ️</span><div class="box-body"><strong>Targets are set by your manager.</strong> You cannot edit your own targets. Contact your Zone Head or Regional Head if targets appear incorrect.</div></div>
  </div>
</div>

<!-- ═══ SECTION 10 — TRACKING ═══ -->
<div class="sec" id="s10">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#e6fffa">📍</div>
    <div>
      <div class="sec-label">Section 10</div>
      <h2>Location Tracking</h2>
      <p>GPS work-day tracking for Field Officers, with live visibility for Zone Heads and above.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="mw">
      <div class="ph-device">
        <div class="ph-notch"><div class="ph-pill"></div></div>
        <div class="ph-hdr" style="background:#0d9488"><h4>My Day</h4><small>GPS Tracking Active</small></div>
        <div class="ph-body" style="padding:10px">
          <div class="track-status"><div class="track-active">● Day Active — 4h 12m</div><div class="track-sub">GPS pings every 60 seconds</div></div>
          <div class="track-btns" style="margin-top:8px">
            <div class="track-btn" style="background:#0d9488">Start Visit</div>
            <div class="track-btn" style="background:#dc2626">End My Day</div>
          </div>
          <div style="font-size:9px;font-weight:700;color:#374151;margin:4px 0 6px">Today's Stops</div>
          <div style="font-size:9px;color:#6b7280"><div style="display:flex;gap:6px;margin-bottom:5px"><div style="width:6px;height:6px;border-radius:2px;background:#0d9488;flex-shrink:0;margin-top:3px"></div>9:14 AM — Delhi Public School · 42 min</div><div style="display:flex;gap:6px"><div style="width:6px;height:6px;border-radius:2px;background:#0d9488;flex-shrink:0;margin-top:3px"></div>11:20 AM — Modern Academy · 35 min</div></div>
        </div>
      </div>
    </div>

    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#0d9488"></div>My Day Workflow</div>
      <table class="dt">
        <thead><tr><th>Button</th><th>Action</th><th>When to Tap</th></tr></thead>
        <tbody>
          <tr><td>🟢 <strong>Start My Day</strong></td><td>Begins GPS tracking session</td><td>When you leave home / office</td></tr>
          <tr><td>📍 <strong>Start Visit</strong></td><td>Marks arrival at a school</td><td>When you arrive at the school gate</td></tr>
          <tr><td>✅ <strong>End Visit</strong></td><td>Marks departure — prompts visit report</td><td>When you leave the school</td></tr>
          <tr><td>🔴 <strong>End My Day</strong></td><td>Stops tracking, closes session</td><td>When you return home / end of shift</td></tr>
        </tbody>
      </table>
    </div>

    <hr class="div">
    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#dc2626"></div>Required Device Setup</div>
      <div class="bullets">
        <div class="bullet"><div class="bdot" style="background:#2563eb"></div><div class="btext"><strong>iOS:</strong> Settings → SingularityCRM → Location → select <strong>Always</strong> (not "While Using"). Required for background tracking.</div></div>
        <div class="bullet"><div class="bdot" style="background:#ea580c"></div><div class="btext"><strong>Android:</strong> Settings → Battery → App Battery Management → SingularityCRM → set to <strong>Unrestricted</strong>.</div></div>
        <div class="bullet"><div class="bdot" style="background:#0d9488"></div><div class="btext">GPS pings every <strong>60 seconds</strong> while active, including when the app is in the background or closed.</div></div>
        <div class="bullet"><div class="bdot" style="background:#0d9488"></div><div class="btext">If offline, pings are <strong>queued locally</strong> and uploaded automatically when internet is restored.</div></div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SECTION 11 — AI ═══ -->
<div class="sec" id="s11">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#ede9fe">⚡</div>
    <div>
      <div class="sec-label">Section 11</div>
      <h2>AI Features</h2>
      <p>AI-powered daily plans, end-of-day reports, lead insights, and probability score breakdowns.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="mw">
      <div class="ph-device">
        <div class="ph-notch"><div class="ph-pill"></div></div>
        <div class="ph-hdr" style="background:#7c3aed"><h4>AI Daily Plan ✨</h4><small>Mon 24 Mar · 3 items</small></div>
        <div class="ph-body" style="padding:10px">
          <div class="ai-item"><div class="ai-cb" style="background:#7c3aed"><span style="font-size:10px;color:#fff">✓</span></div><div class="ai-text" style="color:#9ca3af;text-decoration:line-through">Visit Delhi Public School (overdue 3d)</div></div>
          <div class="ai-item"><div class="ai-cb" style="border:2px solid #e5e7eb"></div><div class="ai-text" style="color:#374151">Call Modern Academy re: proposal</div></div>
          <div class="ai-item"><div class="ai-cb" style="border:2px solid #e5e7eb"></div><div class="ai-text" style="color:#374151">Follow up: GD Goenka contract</div></div>
          <div class="ph-btn" style="background:#7c3aed;margin-top:8px">✓ Accept Plan</div>
        </div>
      </div>
    </div>

    <div class="fgrid">
      <div class="fcell"><h4>📅 Daily Plan</h4><p>Generated each morning. Prioritises overdue leads and hot prospects. Accept or regenerate.</p></div>
      <div class="fcell"><h4>📊 Daily Report</h4><p>End-of-day summary of visits, calls, and revenue progress. Shared with your manager.</p></div>
      <div class="fcell"><h4>💡 AI Insights</h4><p>Lead-level insights: score breakdown, risk factors, and recommended next actions.</p></div>
      <div class="fcell"><h4>🔄 Regenerate</h4><p>Tap the refresh icon to regenerate. Limited daily uses — see quota table below.</p></div>
    </div>

    <hr class="div">
    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#7c3aed"></div>Daily Usage Quotas</div>
      <table class="dt">
        <thead><tr><th>AI Feature</th><th>Daily Limit</th><th>Resets At</th></tr></thead>
        <tbody>
          <tr><td>Daily Plan regenerations</td><td><strong>3 per day</strong></td><td>Midnight IST</td></tr>
          <tr><td>Daily Report generations</td><td><strong>2 per day</strong></td><td>Midnight IST</td></tr>
          <tr><td>AI Insights refreshes</td><td><strong>5 per day</strong></td><td>Midnight IST</td></tr>
        </tbody>
      </table>
      <div class="box tip" style="margin-top:12px"><span class="box-ico">💡</span><div class="box-body">Current usage vs. limit is visible in <strong>Settings → AI Usage Today</strong>.</div></div>
    </div>
  </div>
</div>

<!-- ═══ SECTION 12 — SETTINGS ═══ -->
<div class="sec" id="s12">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#e6fffa">⚙️</div>
    <div>
      <div class="sec-label">Section 12</div>
      <h2>Settings</h2>
      <p>Language, notifications, offline sync, AI quota, dashboard customisation, and your account.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="mw">
      <div class="ph-device">
        <div class="ph-notch"><div class="ph-pill"></div></div>
        <div class="ph-hdr" style="background:#0d9488"><h4>Settings</h4></div>
        <div class="ph-body">
          <div class="set-row"><div><div class="set-lbl">🌐 Language</div><div class="set-sub">English / हिंदी</div></div><span class="set-arr">›</span></div>
          <div class="set-row"><div><div class="set-lbl">🔔 Notifications</div><div class="set-sub">WhatsApp · Push</div></div><span class="set-arr">›</span></div>
          <div class="set-row"><div><div class="set-lbl">📶 Offline Mode</div><div class="set-sub">Online · 0 queued</div></div><span class="set-arr">›</span></div>
          <div class="set-row"><div><div class="set-lbl">🤖 AI Usage Today</div><div class="set-sub">3/3 Plans · 1/2 Reports</div></div><span class="set-arr">›</span></div>
          <div class="set-row"><div><div class="set-lbl">🖥 Dashboard</div><div class="set-sub">Customize widgets</div></div><span class="set-arr">›</span></div>
          <div class="set-row" style="border-bottom:none"><div><div class="set-lbl">📖 User Manual</div><div class="set-sub">This guide</div></div><span class="set-arr">›</span></div>
        </div>
      </div>
    </div>

    <table class="dt">
      <thead><tr><th>Section</th><th>What You Can Do</th></tr></thead>
      <tbody>
        <tr><td><strong>🌐 Language</strong></td><td>Switch between English and हिंदी (Hindi)</td></tr>
        <tr><td><strong>🔔 Notifications</strong></td><td>Toggle WhatsApp alerts and push notifications on/off</td></tr>
        <tr><td><strong>📶 Offline Mode</strong></td><td>View pending sync queue, sync manually, clear local cache</td></tr>
        <tr><td><strong>🤖 AI Usage</strong></td><td>See today's usage vs. daily quota for each AI feature</td></tr>
        <tr><td><strong>🖥 Dashboard</strong></td><td>Reorder and toggle widgets for your home dashboard</td></tr>
        <tr><td><strong>📖 User Manual</strong></td><td>Share or export this guide</td></tr>
        <tr><td><strong>👤 Account</strong></td><td>View your profile and log out</td></tr>
      </tbody>
    </table>
  </div>
</div>

<!-- ═══ SECTION 13 — OFFLINE ═══ -->
<div class="sec" id="s13">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#f3f4f6">📵</div>
    <div>
      <div class="sec-label">Section 13</div>
      <h2>Offline Mode</h2>
      <p>The app works without internet. Actions queue locally and sync automatically when you reconnect.</p>
    </div>
  </div>
  <div class="sec-body">
    <table class="dt">
      <thead><tr><th>Feature</th><th>Available Offline?</th></tr></thead>
      <tbody>
        <tr><td>View cached leads and schools</td><td>✅ <strong>Yes — Offline</strong></td></tr>
        <tr><td>Log activities (queued)</td><td>✅ <strong>Yes — Queued</strong></td></tr>
        <tr><td>GPS pings (queued)</td><td>✅ <strong>Yes — Queued</strong></td></tr>
        <tr><td>Create new leads (queued)</td><td>✅ <strong>Yes — Queued</strong></td></tr>
        <tr><td>Load fresh data from server</td><td>🌐 <strong>Online only</strong></td></tr>
        <tr><td>AI features</td><td>🌐 <strong>Online only</strong></td></tr>
        <tr><td>Reports and analytics</td><td>🌐 <strong>Online only</strong></td></tr>
      </tbody>
    </table>
    <div class="box warn" style="margin-top:16px"><span class="box-ico">⚠️</span><div class="box-body"><strong>Red banner = Offline mode active</strong>A red "No internet" banner appears at the top of every screen when offline, showing the number of queued actions. Tap <strong>Sync Now</strong> in Settings as soon as you reconnect.</div></div>
  </div>
</div>

<!-- ═══ SECTION 14 — AUDIT ═══ -->
<div class="sec" id="s14">
  <div class="sec-hdr">
    <div class="sec-ico" style="background:#e6fffa">🕐</div>
    <div>
      <div class="sec-label">Section 14</div>
      <h2>Audit History</h2>
      <p>An immutable change log for every lead, school, and contact — who changed what and when.</p>
    </div>
  </div>
  <div class="sec-body">
    <div class="sub">
      <div class="sub-title"><div class="sub-dot" style="background:#0d9488"></div>How to Access</div>
      <div class="bullets">
        <div class="bullet"><div class="bdot" style="background:#0d9488"></div><div class="btext"><strong>Lead History:</strong> Open Lead Detail → tap the 🕐 icon in the top-right header.</div></div>
        <div class="bullet"><div class="bdot" style="background:#0d9488"></div><div class="btext"><strong>School History:</strong> Open School Detail → tap the 🕐 icon in the top-right header.</div></div>
        <div class="bullet"><div class="bdot" style="background:#0d9488"></div><div class="btext"><strong>Contact History:</strong> Open Contact Detail → tap the 🕐 icon in the top-right header.</div></div>
      </div>
    </div>
    <hr class="div">
    <table class="dt">
      <thead><tr><th>Entry Type</th><th>Colour</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><strong>Created</strong></td><td>🟢 Green</td><td>Record was first created</td></tr>
        <tr><td><strong>Updated</strong></td><td>🔵 Blue</td><td>A field changed — shows old → new value</td></tr>
        <tr><td><strong>Deleted</strong></td><td>🔴 Red</td><td>Record or related item was removed</td></tr>
      </tbody>
    </table>
    <div class="box info" style="margin-top:14px"><span class="box-ico">ℹ️</span><div class="box-body"><strong>Audit entries are permanent.</strong> They cannot be edited or deleted. The log is used for compliance and accountability.</div></div>
  </div>
</div>

<!-- ═══ FOOTER ═══ -->
<div class="footer">
  <strong>SingularityCRM</strong> &nbsp;·&nbsp; EduCRM Sales Portal &nbsp;·&nbsp; User Manual v1.0.0<br>
  <span style="display:block;margin-top:5px">For support, contact your system administrator.</span>
</div>

</div><!-- /wrap -->
</body>
</html>`;
