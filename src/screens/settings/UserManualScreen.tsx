import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import RNShare from 'react-native-share';
import { generatePDF } from 'react-native-html-to-pdf';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BookOpen, Download, ChevronDown, ChevronRight,
  LogIn, Users, LayoutDashboard, ClipboardList,
  GitBranch, Building2, Contact2, Activity,
  Target, MapPin, Zap, Settings, Wifi, Clock,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ROLE_COLORS } from '../../utils/constants';
import { rf } from '../../utils/responsive';
import { MANUAL_HTML } from '../../assets/manualHtml';

// ─── Phone mockup helpers ─────────────────────────────────────────────────────

const PhoneFrame = ({ headerBg, headerContent, children }: {
  headerBg: string;
  headerContent: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View style={phoneS.outer}>
    <View style={phoneS.frame}>
      <View style={phoneS.notchBar}><View style={phoneS.notchPill} /></View>
      <View style={{ backgroundColor: headerBg }}>{headerContent}</View>
      <View style={phoneS.phBody}>{children}</View>
    </View>
  </View>
);

const MockInput = ({ label, value, secure }: { label: string; value: string; secure?: boolean }) => (
  <View style={phoneS.fieldWrap}>
    <Text style={phoneS.fieldLabel}>{label}</Text>
    <View style={phoneS.fieldBox}>
      <Text style={phoneS.fieldValue}>{secure ? '••••••••' : value}</Text>
    </View>
  </View>
);

const MockBtn = ({ label, color }: { label: string; color: string }) => (
  <View style={[phoneS.mockBtn, { backgroundColor: color }]}>
    <Text style={phoneS.mockBtnText}>{label}</Text>
  </View>
);

const KpiCard = ({ value, label, color }: { value: string; label: string; color: string }) => (
  <View style={phoneS.kpiCard}>
    <Text style={[phoneS.kpiValue, { color }]}>{value}</Text>
    <Text style={phoneS.kpiLabel}>{label}</Text>
  </View>
);

const ProgressBar = ({ pct, color }: { pct: number; color: string }) => (
  <View style={phoneS.progressBg}>
    <View style={[phoneS.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
  </View>
);

const LeadCard = ({ school, city, stage, value, score, hot, overdue, borderColor }: any) => (
  <View style={[phoneS.leadCard, { borderLeftColor: borderColor }]}>
    {hot && <Text style={phoneS.hotBadge}>🔥 Hot</Text>}
    <Text style={phoneS.cardTitle}>{school}</Text>
    <Text style={phoneS.cardMeta}>{city} · {stage}</Text>
    <View style={phoneS.cardBottom}>
      <Text style={phoneS.cardValue}>{value}</Text>
      <View style={[phoneS.scoreChip, { backgroundColor: score >= 70 ? '#dcfce7' : score >= 40 ? '#fef3c7' : '#fee2e2' }]}>
        <Text style={[phoneS.scoreText, { color: score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626' }]}>{score}</Text>
      </View>
    </View>
    {overdue && <Text style={phoneS.overdueText}>⚠ No activity in 6 days</Text>}
  </View>
);

const KanbanCol = ({ title, count, cards, isTarget, colColor }: any) => (
  <View style={[phoneS.kCol, isTarget && { borderColor: colColor, borderWidth: 2 }]}>
    <View style={[phoneS.kColHeader, isTarget && { backgroundColor: colColor + '20' }]}>
      <Text style={[phoneS.kColTitle, isTarget && { color: colColor }]}>{title}</Text>
      <View style={[phoneS.kColBadge, { backgroundColor: colColor }]}>
        <Text style={phoneS.kColBadgeText}>{count}</Text>
      </View>
    </View>
    <View style={phoneS.kColBody}>
      {isTarget && (
        <View style={[phoneS.dropZone, { borderColor: colColor }]}>
          <Text style={[phoneS.dropText, { color: colColor }]}>↓ Drop</Text>
        </View>
      )}
      {cards.map((c: string, i: number) => (
        <View key={i} style={phoneS.kCard}>
          <Text style={phoneS.kCardText}>{c}</Text>
        </View>
      ))}
    </View>
  </View>
);

const renderMockup = (id: string) => {
  switch (id) {

    case 'login':
      return (
        <PhoneFrame
          headerBg="#fff"
          headerContent={
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 6 }}>
              <Text style={{ fontSize: rf(22) }}>◉</Text>
              <Text style={{ fontSize: rf(14), fontWeight: '800', color: '#0d9488' }}>SingularityCRM</Text>
              <Text style={{ fontSize: rf(9), color: '#9ca3af' }}>EduCRM Sales Portal</Text>
            </View>
          }
        >
          <MockInput label="Email Address" value="rajesh@educrm.in" />
          <MockInput label="Password" value="password" secure />
          <MockBtn label="Login" color="#0d9488" />
          <Text style={{ textAlign: 'center', fontSize: rf(9), color: '#9ca3af', marginTop: 6, marginBottom: 10 }}>
            Forgot password? · v1.0.0
          </Text>
        </PhoneFrame>
      );

    case 'dashboard':
      return (
        <PhoneFrame
          headerBg="#0d9488"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>Good Morning, Ravi! 🌤</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>Monday, 24 March 2026</Text>
            </View>
          }
        >
          <View style={{ flexDirection: 'row', gap: 5, padding: 8 }}>
            <KpiCard value="3" label="Visits" color="#0d9488" />
            <KpiCard value="7" label="Calls" color="#2563eb" />
            <KpiCard value="24" label="Leads" color="#ea580c" />
          </View>
          <View style={{ paddingHorizontal: 10, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
              <Text style={{ fontSize: rf(9), color: '#374151', fontWeight: '700' }}>Monthly Revenue</Text>
              <Text style={{ fontSize: rf(9), color: '#dc2626', fontWeight: '700' }}>40%</Text>
            </View>
            <ProgressBar pct={40} color="#dc2626" />
          </View>
          <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
            {[
              { emoji: '🏫', title: 'Delhi Public School', sub: '9:00 AM · Visit', bg: '#dcfce7' },
              { emoji: '📞', title: 'Modern Academy', sub: '11:00 AM · Call', bg: '#eff6ff' },
            ].map((t, i) => (
              <View key={i} style={phoneS.timelineItem}>
                <View style={[phoneS.timelineDot, { backgroundColor: t.bg }]}>
                  <Text style={{ fontSize: rf(10) }}>{t.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={phoneS.cardTitle}>{t.title}</Text>
                  <Text style={phoneS.cardMeta}>{t.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </PhoneFrame>
      );

    case 'leads':
      return (
        <PhoneFrame
          headerBg="#0d9488"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>Leads</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>47 leads · ₹1,24,50,000</Text>
            </View>
          }
        >
          <View style={{ margin: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 7, padding: 6 }}>
            <Text style={{ fontSize: rf(10), color: '#9ca3af' }}>🔍 Search school or city...</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 8, marginBottom: 6 }}>
            {['All', 'New', 'Demo', 'Won'].map((f, i) => (
              <View key={f} style={[phoneS.chipItem, i === 0 && { backgroundColor: '#0d9488', borderColor: '#0d9488' }]}>
                <Text style={[phoneS.chipText, i === 0 && { color: '#fff' }]}>{f}</Text>
              </View>
            ))}
          </View>
          <View style={{ gap: 5, paddingHorizontal: 8, paddingBottom: 10 }}>
            <LeadCard school="Delhi Public School" city="Dwarka" stage="Demo Done" value="₹2,40,000" score={82} hot borderColor="#f59e0b" />
            <LeadCard school="Modern Academy" city="Rohini" stage="Contacted" value="₹1,80,000" score={54} overdue borderColor="#ef4444" />
          </View>
        </PhoneFrame>
      );

    case 'pipeline':
      return (
        <PhoneFrame
          headerBg="#7c3aed"
          headerContent={
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 }}>
              <View>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>Pipeline</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>47 leads</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {['−', '+'].map(b => (
                  <View key={b} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: rf(12) }}>{b}</Text>
                  </View>
                ))}
              </View>
            </View>
          }
        >
          <View style={{ backgroundColor: '#e0e7ff', padding: 4 }}>
            <Text style={{ textAlign: 'center', fontSize: rf(8), color: '#4338ca' }}>🤏 Pinch · ✌ Drag · 👆 Long press to move</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 6 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <KanbanCol title="New" count={12} cards={['DPS Dwarka', 'Bloom Int\'l']} colColor="#7c3aed" />
              <KanbanCol title="Qualified" count={8} cards={['GD Goenka']} colColor="#7c3aed" />
              <KanbanCol title="Demo" count={11} cards={['Oxford Int\'l']} isTarget colColor="#7c3aed" />
            </View>
          </ScrollView>
          <View style={phoneS.ghostCard}>
            <Text style={phoneS.ghostSchool}>🔥 Sunrise Int'l</Text>
            <Text style={phoneS.ghostMeta}>Dragging... · ₹4,50,000</Text>
          </View>
        </PhoneFrame>
      );

    case 'schools':
      return (
        <PhoneFrame
          headerBg="#0d9488"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>Schools</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>63 schools</Text>
            </View>
          }
        >
          <View style={{ margin: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 7, padding: 6 }}>
            <Text style={{ fontSize: rf(10), color: '#9ca3af' }}>🔍 Search schools...</Text>
          </View>
          <View style={{ gap: 5, paddingHorizontal: 8, paddingBottom: 10 }}>
            {[
              { name: 'Delhi Public School', city: 'Dwarka · CBSE', score: 94, priority: 'HIGH', color: '#ea580c' },
              { name: 'Sunrise International', city: 'Gurgaon · IB', score: 72, priority: 'MEDIUM', color: '#d97706' },
              { name: 'Bloom Academy', city: 'Noida · ICSE', score: 38, priority: 'LOW', color: '#16a34a' },
            ].map((s, i) => (
              <View key={i} style={[phoneS.leadCard, { borderLeftColor: s.color }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={phoneS.cardTitle}>{s.name}</Text>
                    <Text style={phoneS.cardMeta}>{s.city}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: rf(16), fontWeight: '800', color: s.color }}>{s.score}</Text>
                    <Text style={{ fontSize: rf(8), color: s.color, fontWeight: '700' }}>{s.priority}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </PhoneFrame>
      );

    case 'contacts':
      return (
        <PhoneFrame
          headerBg="#0d9488"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>Contacts</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>Principal · Finance · Admin</Text>
            </View>
          }
        >
          <View style={{ padding: 8, gap: 6 }}>
            {[
              { name: 'Sunita Sharma', role: 'Principal', stage: 'Champion', color: '#16a34a' },
              { name: 'Arun Mehta', role: 'Finance Head', stage: 'Warm', color: '#d97706' },
              { name: 'Priya Singh', role: 'Coordinator', stage: 'New', color: '#6b7280' },
            ].map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[phoneS.contactAvatar, { backgroundColor: c.color + '20' }]}>
                  <Text style={{ color: c.color, fontWeight: '800', fontSize: rf(14) }}>{c.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={phoneS.cardTitle}>{c.name}</Text>
                  <Text style={phoneS.cardMeta}>{c.role} · {c.stage}</Text>
                </View>
                <View style={[phoneS.chipItem, { backgroundColor: '#25D366', borderColor: '#25D366', paddingHorizontal: 6 }]}>
                  <Text style={{ fontSize: rf(10) }}>💬</Text>
                </View>
              </View>
            ))}
          </View>
        </PhoneFrame>
      );

    case 'activities':
      return (
        <PhoneFrame
          headerBg="#0d9488"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>Activity Log</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>All interactions</Text>
            </View>
          }
        >
          <View style={{ padding: 8, gap: 7 }}>
            {[
              { type: 'Visit', school: 'Delhi Public School', time: 'Today 9:14 AM', color: '#0d9488' },
              { type: 'Call', school: 'Modern Academy', time: 'Today 11:30 AM', color: '#2563eb' },
              { type: 'Demo', school: 'Sunrise Int\'l', time: 'Yesterday 2:00 PM', color: '#7c3aed' },
              { type: 'Proposal', school: 'GD Goenka', time: '22 Mar 4:00 PM', color: '#ea580c' },
            ].map((a, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[phoneS.activityDot, { backgroundColor: a.color + '18', borderColor: a.color }]}>
                  <Text style={{ fontSize: rf(9), color: a.color, fontWeight: '800' }}>{a.type[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={phoneS.cardTitle}>{a.type} — {a.school}</Text>
                  <Text style={phoneS.cardMeta}>{a.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </PhoneFrame>
      );

    case 'targets':
      return (
        <PhoneFrame
          headerBg="#0d9488"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>Targets</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>March 2026</Text>
            </View>
          }
        >
          <View style={{ padding: 10, gap: 10 }}>
            {[
              { label: 'Revenue', current: '₹4.8L', target: '₹12L', pct: 40, color: '#dc2626', status: 'Behind' },
              { label: 'Visits', current: '18', target: '30', pct: 60, color: '#f59e0b', status: 'At Risk' },
              { label: 'New Leads', current: '14', target: '20', pct: 70, color: '#16a34a', status: 'On Track' },
            ].map(t => (
              <View key={t.label}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: rf(11), fontWeight: '700', color: '#111827' }}>{t.label}</Text>
                  <Text style={{ fontSize: rf(10), color: t.color, fontWeight: '700' }}>{t.current} / {t.target}</Text>
                </View>
                <ProgressBar pct={t.pct} color={t.color} />
                <Text style={{ fontSize: rf(8), color: t.color, marginTop: 2 }}>● {t.status}</Text>
              </View>
            ))}
          </View>
        </PhoneFrame>
      );

    case 'tracking':
      return (
        <PhoneFrame
          headerBg="#0d9488"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>My Day</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>GPS Tracking</Text>
            </View>
          }
        >
          <View style={{ padding: 10, gap: 8 }}>
            <View style={{ backgroundColor: '#dcfce7', borderRadius: 10, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: rf(11), fontWeight: '700', color: '#16a34a' }}>● Day Active — 4h 12m</Text>
              <Text style={{ fontSize: rf(9), color: '#16a34a', marginTop: 2 }}>GPS pings every 60s</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={[phoneS.trackBtn, { backgroundColor: '#0d9488' }]}>
                <Text style={{ color: '#fff', fontSize: rf(10), fontWeight: '700' }}>Start Visit</Text>
              </View>
              <View style={[phoneS.trackBtn, { backgroundColor: '#dc2626' }]}>
                <Text style={{ color: '#fff', fontSize: rf(10), fontWeight: '700' }}>End My Day</Text>
              </View>
            </View>
            <View style={{ gap: 5 }}>
              <Text style={{ fontSize: rf(10), fontWeight: '700', color: '#374151' }}>Today's Stops</Text>
              {['9:14 AM — Delhi Public School', '11:20 AM — Modern Academy'].map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#0d9488' }} />
                  <Text style={{ fontSize: rf(9), color: '#6b7280' }}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        </PhoneFrame>
      );

    case 'ai':
      return (
        <PhoneFrame
          headerBg="#7c3aed"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>AI Daily Plan ✨</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>Mon 24 Mar · 3 items</Text>
            </View>
          }
        >
          <View style={{ padding: 8, gap: 7 }}>
            {[
              { text: 'Visit Delhi Public School (overdue 3d)', checked: true },
              { text: 'Call Modern Academy re: proposal', checked: false },
              { text: 'Follow up: GD Goenka contract', checked: false },
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={[phoneS.checkbox, item.checked && { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}>
                  {item.checked && <Text style={{ color: '#fff', fontSize: rf(9) }}>✓</Text>}
                </View>
                <Text style={[{ flex: 1, fontSize: rf(11), color: '#374151', lineHeight: 18 }, item.checked && { color: '#9ca3af', textDecorationLine: 'line-through' }]}>
                  {item.text}
                </Text>
              </View>
            ))}
            <MockBtn label="✓ Accept Plan" color="#7c3aed" />
          </View>
        </PhoneFrame>
      );

    case 'settings':
      return (
        <PhoneFrame
          headerBg="#0d9488"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>Settings</Text>
            </View>
          }
        >
          <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
            {[
              { label: '🌐 Language', sub: 'English / हिंदी' },
              { label: '🔔 Notifications', sub: 'WhatsApp · Push' },
              { label: '📶 Offline Mode', sub: 'Sync queue · Clear cache' },
              { label: '🤖 AI Usage', sub: '3/3 Plans · 1/2 Reports' },
              { label: '🖥 Dashboard', sub: 'Customize widgets' },
              { label: '📖 User Manual', sub: 'This guide' },
            ].map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: rf(11), color: '#111827', fontWeight: '600' }}>{row.label}</Text>
                  <Text style={{ fontSize: rf(9), color: '#9ca3af' }}>{row.sub}</Text>
                </View>
                <Text style={{ fontSize: rf(13), color: '#9ca3af' }}>›</Text>
              </View>
            ))}
          </View>
        </PhoneFrame>
      );

    case 'offline':
      return (
        <PhoneFrame
          headerBg="#6b7280"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>Offline Mode</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>Offline · 3 queued</Text>
            </View>
          }
        >
          <View style={{ padding: 8, gap: 8 }}>
            <View style={{ backgroundColor: '#dc2626', borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: rf(10) }}>📵</Text>
              <Text style={{ color: '#fff', fontSize: rf(10), fontWeight: '700' }}>No internet — 3 actions queued</Text>
            </View>
            {[
              { label: 'View cached leads', status: '✅ Offline' },
              { label: 'Log activities (queued)', status: '✅ Offline' },
              { label: 'GPS pings (queued)', status: '✅ Offline' },
              { label: 'Load fresh data', status: '🌐 Online' },
              { label: 'AI features', status: '🌐 Online' },
            ].map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: rf(10), color: '#374151' }}>{r.label}</Text>
                <Text style={{ fontSize: rf(9), color: '#6b7280' }}>{r.status}</Text>
              </View>
            ))}
          </View>
        </PhoneFrame>
      );

    case 'audit':
      return (
        <PhoneFrame
          headerBg="#0d9488"
          headerContent={
            <View style={{ padding: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: rf(13) }}>Audit History</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: rf(9) }}>Change log</Text>
            </View>
          }
        >
          <View style={{ padding: 8, gap: 7 }}>
            {[
              { type: 'Updated', field: 'Stage → Demo Done', user: 'Ravi', time: 'Today 2:15 PM', color: '#2563eb' },
              { type: 'Created', field: 'Lead added', user: 'Ravi', time: 'Yesterday 9:00 AM', color: '#16a34a' },
              { type: 'Updated', field: 'Score: 54 → 82', user: 'System', time: '22 Mar 4:00 PM', color: '#2563eb' },
              { type: 'Deleted', field: 'Activity removed', user: 'Admin', time: '21 Mar 1:00 PM', color: '#dc2626' },
            ].map((e, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={[phoneS.activityDot, { backgroundColor: e.color + '18', borderColor: e.color }]}>
                  <Text style={{ fontSize: rf(8), color: e.color, fontWeight: '800' }}>{e.type[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={phoneS.cardTitle}>{e.type} — {e.field}</Text>
                  <Text style={phoneS.cardMeta}>by {e.user} · {e.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </PhoneFrame>
      );

    default:
      return null;
  }
};

// ─── Phone mockup styles ──────────────────────────────────────────────────────
const phoneS = StyleSheet.create({
  outer: { alignItems: 'center', marginBottom: 6 },
  frame: {
    width: 240, borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 22,
    overflow: 'hidden', backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  notchBar: { backgroundColor: '#111', height: 18, alignItems: 'center', justifyContent: 'center' },
  notchPill: { width: 60, height: 6, backgroundColor: '#333', borderRadius: 3 },
  phBody: { backgroundColor: '#f9fafb' },
  fieldWrap: { marginHorizontal: 10, marginTop: 7 },
  fieldLabel: { fontSize: rf(9), color: '#6b7280', fontWeight: '600', marginBottom: 2 },
  fieldBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#fafafa' },
  fieldValue: { fontSize: rf(11), color: '#111827' },
  mockBtn: { marginHorizontal: 10, marginTop: 8, marginBottom: 4, borderRadius: 7, paddingVertical: 9, alignItems: 'center' },
  mockBtnText: { color: '#fff', fontWeight: '700', fontSize: rf(12) },
  kpiCard: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, alignItems: 'center', backgroundColor: '#fff' },
  kpiValue: { fontSize: rf(16), fontWeight: '800' },
  kpiLabel: { fontSize: rf(8), color: '#9ca3af', marginTop: 1 },
  progressBg: { height: 5, backgroundColor: '#e5e7eb', borderRadius: 3 },
  progressFill: { height: 5, borderRadius: 3 },
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  timelineDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  leadCard: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 9, padding: 9, backgroundColor: '#fff', borderLeftWidth: 3 },
  hotBadge: { fontSize: rf(9), color: '#d97706', fontWeight: '700', marginBottom: 2 },
  cardTitle: { fontSize: rf(11), fontWeight: '700', color: '#111827' },
  cardMeta: { fontSize: rf(9), color: '#9ca3af', marginTop: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  cardValue: { fontSize: rf(11), fontWeight: '700', color: '#374151' },
  scoreChip: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  scoreText: { fontSize: rf(9), fontWeight: '700' },
  overdueText: { fontSize: rf(9), color: '#ef4444', marginTop: 3 },
  chipItem: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f3f4f6' },
  chipText: { fontSize: rf(9), color: '#6b7280', fontWeight: '600' },
  kCol: { width: 85, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 9, overflow: 'hidden' },
  kColHeader: { paddingHorizontal: 7, paddingVertical: 5, backgroundColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kColTitle: { fontSize: rf(9), fontWeight: '700', color: '#6b7280' },
  kColBadge: { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  kColBadgeText: { fontSize: rf(8), fontWeight: '700', color: '#fff' },
  kColBody: { padding: 4, gap: 3 },
  kCard: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, padding: 5, backgroundColor: '#fff' },
  kCardText: { fontSize: rf(8), color: '#111827', fontWeight: '600' },
  dropZone: { borderWidth: 2, borderRadius: 6, padding: 5, alignItems: 'center', marginBottom: 3 },
  dropText: { fontSize: rf(9), fontWeight: '700' },
  ghostCard: {
    marginHorizontal: 10, marginBottom: 8, padding: 8,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 9,
    backgroundColor: '#fff', borderLeftWidth: 3, borderLeftColor: '#7c3aed',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14, shadowRadius: 8, elevation: 6,
  },
  ghostSchool: { fontSize: rf(10), fontWeight: '700', color: '#111827' },
  ghostMeta: { fontSize: rf(9), color: '#9ca3af', marginTop: 2 },
  contactAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activityDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  trackBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});

// ─── Section data ─────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'login', icon: LogIn, title: '1. Login', color: '#0d9488',
    summary: 'Access the app with your registered email and password.',
    content: [
      { type: 'steps', title: 'Steps', items: [
        'Enter your official Email Address.',
        'Enter your Password.',
        'Tap Login — your dashboard loads based on your role.',
        'Sessions stay active for 7 days.',
      ]},
      { type: 'table', title: 'Common Errors', headers: ['Error', 'Solution'],
        rows: [
          ['Invalid credentials', 'Re-enter or contact admin'],
          ['Network Error', 'Check Wi-Fi / mobile data'],
          ['Account inactive', 'Contact your administrator'],
        ],
      },
    ],
  },
  {
    id: 'roles', icon: Users, title: '2. User Roles', color: '#7c3aed',
    summary: 'Four roles — FO, ZH, RH, SH — each with a unique colour theme and tab set.',
    content: [
      { type: 'table', title: 'Roles', headers: ['Role', 'Full Name', 'Access'],
        rows: [
          ['FO', 'Field Officer', 'Own leads, schools, tracking, targets'],
          ['ZH', 'Zone Head', 'Zone leads, pipeline, live tracking, users'],
          ['RH', 'Regional Head', 'Regional leads, pipeline, reports'],
          ['SH', 'Sales Head', 'All regions, full reports, pipeline'],
        ],
      },
    ],
  },
  {
    id: 'dashboard', icon: LayoutDashboard, title: '3. Dashboard', color: '#0d9488',
    summary: 'Role-specific KPIs, team status, today\'s plan, and quick actions.',
    content: [
      { type: 'bullets', title: 'Key Features', items: [
        'KPI cards — visits, calls, active leads at a glance',
        'Monthly target bar — green / amber / red status',
        'Today\'s Plan — AI-suggested schedule',
        'Pull to Refresh — drag screen down to reload',
        'Customize Dashboard — toggle and reorder widgets via Settings',
      ]},
    ],
  },
  {
    id: 'leads', icon: ClipboardList, title: '4. Leads Management', color: '#0d9488',
    summary: 'Create, search, filter, and manage the full lifecycle of school leads.',
    content: [
      { type: 'steps', title: 'Adding a Lead', items: [
        'Tap the + button on the Leads screen.',
        'Fill in School Name, City, Board, Source, Value.',
        'Duplicate check runs automatically as you type.',
        'Tap Add Lead to save.',
      ]},
      { type: 'table', title: 'Lead Stages', headers: ['Stage', 'Meaning'],
        rows: [
          ['New Lead', 'Created, not yet contacted'],
          ['Contacted', 'Initial contact made'],
          ['Qualified', 'Budget & decision-maker confirmed'],
          ['Demo Stage / Done', 'Demo scheduled or completed'],
          ['Proposal / Negotiation', 'Proposal sent, terms discussed'],
          ['Won', 'Deal signed ✅'],
          ['Lost', 'Deal lost — reason logged'],
        ],
      },
    ],
  },
  {
    id: 'pipeline', icon: GitBranch, title: '5. Pipeline (Kanban)', color: '#7c3aed',
    summary: 'Visual board with pinch-to-zoom and drag-and-drop card movement.',
    content: [
      { type: 'steps', title: 'Drag & Drop a Card', items: [
        'Long press a card for ~0.4 seconds — ghost card appears.',
        'Drag to the target column — it highlights with "↓ Drop here".',
        'Release — card moves instantly (optimistic update).',
        'Syncs to server; reverts automatically if server update fails.',
      ]},
      { type: 'table', title: 'Gestures & Controls', headers: ['Control', 'Action'],
        rows: [
          ['Pinch in / out', 'Zoom the board'],
          ['Two-finger drag', 'Pan the board'],
          ['− / + buttons', 'Zoom out / in by 20%'],
          ['⊡ button', 'Reset zoom and position'],
          ['Single-finger scroll', 'Scroll cards within a column'],
        ],
      },
    ],
  },
  {
    id: 'schools', icon: Building2, title: '6. Schools', color: '#0d9488',
    summary: 'School database with priority scoring and duplicate detection.',
    content: [
      { type: 'table', title: 'Priority Levels', headers: ['Level', 'Score', 'Action'],
        rows: [
          ['HIGH', '80–100', 'Visit this week'],
          ['MEDIUM', '50–79', 'Visit within 2 weeks'],
          ['LOW', '0–49', 'On track — no urgency'],
        ],
      },
      { type: 'steps', title: 'Duplicate Detection', items: [
        'As you type the name and city, real-time matching runs.',
        'A yellow banner shows the duplicate count.',
        'On submit, a modal lists matches with Definite / Probable / Possible labels.',
        'Tap View Existing to inspect, or Create Anyway to proceed.',
      ]},
    ],
  },
  {
    id: 'contacts', icon: Contact2, title: '7. Contacts', color: '#0d9488',
    summary: 'People at schools — decision makers, influencers, coordinators.',
    content: [
      { type: 'table', title: 'Relationship Stages', headers: ['Stage', 'Meaning'],
        rows: [
          ['New', 'First contact — no relationship yet'],
          ['Warm', 'Shows interest after conversations'],
          ['Strong', 'Trusts the FO — regular interaction'],
          ['Champion', 'Advocates for the product internally'],
          ['Detractor', 'Opposed — handle with caution'],
        ],
      },
      { type: 'bullets', title: 'WhatsApp Integration', items: [
        'Open Contact Detail → tap 💬 WhatsApp button.',
        'Opens a WhatsApp chat directly to that number.',
        'If WhatsApp is not installed, an alert is shown.',
      ]},
    ],
  },
  {
    id: 'activities', icon: Activity, title: '8. Activities', color: '#0d9488',
    summary: 'Log every interaction — visits, calls, demos, proposals, follow-ups.',
    content: [
      { type: 'table', title: 'Activity Types', headers: ['Type', 'When to use'],
        rows: [
          ['Visit', 'In-person school visit'],
          ['Call', 'Phone or video call'],
          ['Demo', 'Product demonstration'],
          ['Proposal', 'Proposal presented or sent'],
          ['FollowUp', 'Follow-up after any interaction'],
          ['Contract', 'Contract discussion or signing'],
        ],
      },
    ],
  },
  {
    id: 'targets', icon: Target, title: '9. Targets', color: '#0d9488',
    summary: 'Monthly sales targets vs. actual performance with colour-coded progress bars.',
    content: [
      { type: 'table', title: 'Progress Colours', headers: ['Colour', 'Status', 'Meaning'],
        rows: [
          ['🟢 Green', 'On Track', '≥ 66% of target achieved'],
          ['🟡 Amber', 'At Risk', '33%–65% achieved'],
          ['🔴 Red', 'Behind', '< 33% achieved'],
        ],
      },
    ],
  },
  {
    id: 'tracking', icon: MapPin, title: '10. Location Tracking', color: '#0d9488',
    summary: 'GPS-based work tracking for FOs and live visibility for managers.',
    content: [
      { type: 'table', title: 'My Day Buttons', headers: ['Button', 'Action'],
        rows: [
          ['Start My Day', 'Begins GPS tracking'],
          ['Start Visit', 'Marks arrival at a school'],
          ['End Visit', 'Marks departure — prompts visit report'],
          ['End My Day', 'Stops tracking, closes session'],
        ],
      },
      { type: 'bullets', title: 'Important Notes', items: [
        'GPS pings every 60 seconds while day is active.',
        'Tracking continues in background even when app is closed.',
        'Android: Disable battery optimisation for this app.',
        'iOS: Set Location permission to Always (not "While Using").',
      ]},
    ],
  },
  {
    id: 'ai', icon: Zap, title: '11. AI Features', color: '#7c3aed',
    summary: 'AI-generated daily plans, reports, lead insights, and score breakdowns.',
    content: [
      { type: 'steps', title: 'AI Daily Plan', items: [
        'Generated each morning based on overdue follow-ups and hot leads.',
        'Tap items to select / deselect from your agenda.',
        'Tap Accept Plan to confirm your schedule.',
        'Tap ↺ to regenerate (limited per day).',
      ]},
      { type: 'table', title: 'AI Quota Limits', headers: ['Feature', 'Daily Limit'],
        rows: [
          ['Daily Plan regenerations', '3 per day'],
          ['Daily Report generations', '2 per day'],
          ['AI Insights refreshes', '5 per day'],
        ],
      },
    ],
  },
  {
    id: 'settings', icon: Settings, title: '12. Settings', color: '#0d9488',
    summary: 'Language, notifications, offline mode, AI usage, dashboard customization.',
    content: [
      { type: 'table', title: 'Settings Overview', headers: ['Section', 'What you can do'],
        rows: [
          ['Language', 'Switch English ↔ हिंदी'],
          ['Notifications', 'Toggle WhatsApp and Push notifications'],
          ['Offline Mode', 'View sync queue, sync manually, clear cache'],
          ['AI Usage Today', 'See daily quota for each AI feature'],
          ['Dashboard', 'Customize widget layout'],
          ['Account', 'View profile and log out'],
        ],
      },
    ],
  },
  {
    id: 'offline', icon: Wifi, title: '13. Offline Mode', color: '#6b7280',
    summary: 'The app works without internet. Actions are queued and synced on reconnect.',
    content: [
      { type: 'table', title: 'Offline Capabilities', headers: ['Feature', 'Available'],
        rows: [
          ['View cached leads & schools', '✅ Offline'],
          ['Log activities (queued)', '✅ Offline'],
          ['GPS pings (queued)', '✅ Offline'],
          ['Load fresh data', '🌐 Online only'],
          ['AI features', '🌐 Online only'],
          ['Reports', '🌐 Online only'],
        ],
      },
    ],
  },
  {
    id: 'audit', icon: Clock, title: '14. Audit History', color: '#0d9488',
    summary: 'Full change log for every lead, school, and contact.',
    content: [
      { type: 'bullets', title: 'How to Access', items: [
        'Schools: Open School Detail → tap 🕐 History icon in header.',
        'Leads: Open Lead Detail → tap History icon.',
        'Contacts: Open Contact Detail → tap History icon.',
      ]},
      { type: 'table', title: 'Entry Types', headers: ['Type', 'Color'],
        rows: [
          ['Created', '🟢 Green'],
          ['Updated', '🔵 Blue'],
          ['Deleted', '🔴 Red'],
        ],
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export const UserManualScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const COLOR = ROLE_COLORS[(user?.role || 'FO') as keyof typeof ROLE_COLORS];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const handleShareManual = async () => {
    try {
      setGenerating(true);
      const result = await generatePDF({
        html: MANUAL_HTML,
        fileName: 'SingularityCRM_UserManual',
        directory: 'Documents',
        width: 595,
        height: 842,
        padding: 24,
      });
      setGenerating(false);
      await RNShare.open({
        url: `file://${result.filePath}`,
        type: 'application/pdf',
        filename: 'SingularityCRM_UserManual.pdf',
        title: 'SingularityCRM User Manual',
        subject: 'SingularityCRM User Manual v1.0.0',
        failOnCancel: false,
      });
    } catch {
      setGenerating(false);
      Alert.alert('Error', 'Could not generate PDF. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader
        title="User Manual"
        subtitle="SingularityCRM v1.0.0"
        color={COLOR.primary}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={handleShareManual} style={styles.shareBtn} disabled={generating}>
            {generating
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Download size={18} color="#FFF" />}
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Hero card */}
        <View style={[styles.hero, { backgroundColor: COLOR.primary + '12', borderColor: COLOR.primary + '30' }]}>
          <BookOpen size={28} color={COLOR.primary} />
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, { color: COLOR.primary }]}>SingularityCRM</Text>
            <Text style={styles.heroSub}>Complete User Manual · 14 sections · Version 1.0.0</Text>
          </View>
        </View>

        {/* Download PDF card */}
        <TouchableOpacity style={styles.downloadCard} onPress={handleShareManual} activeOpacity={0.8} disabled={generating}>
          {generating
            ? <ActivityIndicator size="small" color={COLOR.primary} />
            : <Download size={16} color={COLOR.primary} />}
          <View style={{ flex: 1 }}>
            <Text style={[styles.downloadTitle, { color: COLOR.primary }]}>
              {generating ? 'Generating PDF…' : 'Download as PDF'}
            </Text>
            <Text style={styles.downloadSub}>Tap to generate and share a professional PDF</Text>
          </View>
          {!generating && <ChevronRight size={16} color={COLOR.primary} />}
        </TouchableOpacity>

        {/* Sections */}
        {SECTIONS.map(section => {
          const Icon = section.icon;
          const isOpen = expandedId === section.id;

          return (
            <View key={section.id} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionRow}
                onPress={() => toggle(section.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: section.color + '18' }]}>
                  <Icon size={18} color={section.color} />
                </View>
                <View style={styles.sectionMeta}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionSummary} numberOfLines={isOpen ? undefined : 1}>
                    {section.summary}
                  </Text>
                </View>
                {isOpen
                  ? <ChevronDown size={18} color="#9CA3AF" />
                  : <ChevronRight size={18} color="#9CA3AF" />
                }
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.sectionBody}>
                  {/* Phone mockup snapshot */}
                  {renderMockup(section.id)}

                  {section.content.map((block, bi) => (
                    <View key={bi} style={styles.block}>
                      <Text style={[styles.blockTitle, { color: section.color }]}>{block.title}</Text>

                      {block.type === 'steps' && (
                        <View style={styles.stepsList}>
                          {(block.items as string[]).map((item, ii) => (
                            <View key={ii} style={styles.stepItem}>
                              <View style={[styles.stepNum, { backgroundColor: section.color }]}>
                                <Text style={styles.stepNumText}>{ii + 1}</Text>
                              </View>
                              <Text style={styles.stepText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {block.type === 'bullets' && (
                        <View style={styles.bulletList}>
                          {(block.items as string[]).map((item, ii) => (
                            <View key={ii} style={styles.bulletItem}>
                              <View style={[styles.bullet, { backgroundColor: section.color }]} />
                              <Text style={styles.bulletText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {block.type === 'table' && (
                        <View style={styles.table}>
                          <View style={styles.tableHeader}>
                            {(block.headers as string[]).map((h, hi) => (
                              <Text key={hi} style={[styles.tableHeaderCell, { flex: hi === 0 ? 1 : 1.4 }]}>{h.toUpperCase()}</Text>
                            ))}
                          </View>
                          {(block.rows as string[][]).map((row, ri) => (
                            <View key={ri} style={[styles.tableRow, ri % 2 === 0 && styles.tableRowAlt]}>
                              {row.map((cell, ci) => (
                                <Text key={ci} style={[styles.tableCell, { flex: ci === 0 ? 1 : 1.4 }]}>{cell}</Text>
                              ))}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.footer}>SingularityCRM · EduCRM Sales Portal · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },

  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, padding: 18, borderWidth: 1,
  },
  heroText: { flex: 1 },
  heroTitle: { fontSize: rf(18), fontWeight: '800' },
  heroSub: { fontSize: rf(12), color: '#6B7280', marginTop: 2 },

  downloadCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  downloadTitle: { fontSize: rf(14), fontWeight: '700' },
  downloadSub: { fontSize: rf(11), color: '#9CA3AF', marginTop: 2 },

  sectionCard: {
    backgroundColor: '#FFF', borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    overflow: 'hidden',
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionMeta: { flex: 1 },
  sectionTitle: { fontSize: rf(14), fontWeight: '700', color: '#111827' },
  sectionSummary: { fontSize: rf(12), color: '#9CA3AF', marginTop: 2 },

  sectionBody: { borderTopWidth: 1, borderTopColor: '#F3F4F6', padding: 14, gap: 16 },
  block: { gap: 8 },
  blockTitle: { fontSize: rf(13), fontWeight: '700' },

  stepsList: { gap: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumText: { fontSize: rf(11), fontWeight: '700', color: '#FFF' },
  stepText: { flex: 1, fontSize: rf(13), color: '#374151', lineHeight: 20 },

  bulletList: { gap: 6 },
  bulletItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: rf(13), color: '#374151', lineHeight: 20 },

  table: { borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row', backgroundColor: '#F9FAFB',
    paddingHorizontal: 10, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  tableHeaderCell: { fontSize: rf(10), fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  tableCell: { fontSize: rf(12), color: '#374151', lineHeight: 18 },

  footer: { textAlign: 'center', fontSize: rf(11), color: '#D1D5DB', marginTop: 8 },
});
