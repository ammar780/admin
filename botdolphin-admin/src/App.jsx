import { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || localStorage.getItem('bd_admin_api') || 'https://30-production-9f14.up.railway.app';
const LOGO = import.meta.env.VITE_LOGO_URL || '';

function api(path, opts = {}) {
  const token = localStorage.getItem('bd_admin_token');
  return fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async r => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || d.error || 'Request failed');
    return d;
  });
}

function MiniChart({ data, color = '#4f46e5', height = 60 }) {
  if (!data || data.length === 0) return <div style={{height}} className="flex items-center justify-center text-gray-300 text-xs">No data yet</div>;
  const values = data.map(d => d.count || 0);
  const max = Math.max(...values, 1);
  const w = 100 / values.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }}>
      {values.map((v, i) => {
        const h = (v / max) * (height - 4);
        return <rect key={i} x={i * w + w * 0.15} y={height - h - 2} width={w * 0.7} height={h} rx="2" fill={color} opacity={0.8} />;
      })}
    </svg>
  );
}

function StatCard({ label, value, sub, color = 'indigo', icon }) {
  const colors = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    rose: 'bg-rose-50 border-rose-100 text-rose-700',
    cyan: 'bg-cyan-50 border-cyan-100 text-cyan-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    teal: 'bg-teal-50 border-teal-100 text-teal-700',
  };
  const iconColors = {
    indigo: 'text-indigo-500', green: 'text-emerald-500', purple: 'text-purple-500', amber: 'text-amber-500',
    rose: 'text-rose-500', cyan: 'text-cyan-500', blue: 'text-blue-500', teal: 'text-teal-500',
  };
  return (
    <div className={`${colors[color]} rounded-2xl p-5 border hover:shadow-lg transition-all hover:-translate-y-0.5`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-3xl ${iconColors[color]}`}>{icon}</span>
        {sub && <span className="text-[10px] font-semibold bg-white/60 rounded-full px-2.5 py-0.5 text-gray-500">{sub}</span>}
      </div>
      <p className="text-3xl font-black text-gray-800">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await fetch(API + '/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then(r => r.json());
      if (data.token) {
        localStorage.setItem('bd_admin_token', data.token);
        onLogin();
      } else { toast.error(data.error?.message || 'Login failed'); }
    } catch (e) { toast.error('Connection failed'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          {LOGO ? <img src={LOGO} alt="Logo" className="h-14 mx-auto mb-3" /> : <span className="text-5xl block mb-2">🐬</span>}
          <h1 className="text-2xl font-bold text-gray-800">BotDolphin Admin</h1>
          <p className="text-gray-400 text-sm">Sign in to your CEO dashboard</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin email" required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-200">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [signups, setSignups] = useState([]);
  const [convosDaily, setConvosDaily] = useState([]);
  const [leadsDaily, setLeadsDaily] = useState([]);
  const [funnel, setFunnel] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [topUsers, setTopUsers] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, su, cd, ld, f, r, tu, ru, au] = await Promise.all([
        api('/api/v1/admin/dashboard'),
        api('/api/v1/admin/signups-daily'),
        api('/api/v1/admin/conversations-daily'),
        api('/api/v1/admin/leads-daily'),
        api('/api/v1/admin/trial-funnel'),
        api('/api/v1/admin/revenue-breakdown'),
        api('/api/v1/admin/top-users'),
        api('/api/v1/admin/recent-signups'),
        api('/api/v1/admin/users'),
      ]);
      setStats(s); setSignups(su.data||[]); setConvosDaily(cd.data||[]);
      setLeadsDaily(ld.data||[]); setFunnel(f); setRevenue(r);
      setTopUsers(tu.users||[]); setRecentUsers(ru.users||[]);
      setAllUsers(au.users||[]);
    } catch (e) {
      toast.error('Failed to load: ' + e.message);
      if (e.message.includes('401') || e.message.includes('403') || e.message.includes('Admin')) {
        localStorage.removeItem('bd_admin_token'); window.location.reload();
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 60000); return () => clearInterval(iv); }, [load]);

  const changePlan = async (userId, plan) => {
    try { await api(`/api/v1/admin/users/${userId}/plan`, { method: 'PUT', body: { plan } }); toast.success('Plan updated'); load(); } catch (e) { toast.error(e.message); }
  };
  const extendTrial = async (userId, days) => {
    try { await api(`/api/v1/admin/users/${userId}/extend-trial`, { method: 'PUT', body: { days } }); toast.success('Trial extended'); load(); } catch (e) { toast.error(e.message); }
  };
  const deleteUser = async (userId, email) => {
    if (!confirm(`Delete ${email}? This cannot be undone.`)) return;
    try { await api(`/api/v1/admin/users/${userId}`, { method: 'DELETE' }); toast.success('User deleted'); load(); } catch (e) { toast.error(e.message); }
  };
  const logout = () => { localStorage.removeItem('bd_admin_token'); window.location.reload(); };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" /><p className="text-gray-400 mt-4 text-sm">Loading dashboard...</p></div>
    </div>
  );

  const filteredUsers = allUsers.filter(u =>
    !searchQuery || u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || u.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const planBadge = (plan) => {
    const c = { free: 'bg-gray-100 text-gray-600', basic: 'bg-blue-50 text-blue-700', launch: 'bg-indigo-50 text-indigo-700', professional: 'bg-purple-50 text-purple-700', enterprise: 'bg-amber-50 text-amber-700' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${c[plan] || c.free}`}>{plan || 'free'}</span>;
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'revenue', label: 'Revenue', icon: '💰' },
    { id: 'growth', label: 'Growth', icon: '📈' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {LOGO ? <img src={LOGO} alt="Logo" className="h-9" /> : <span className="text-2xl">🐬</span>}
            <div>
              <h1 className="text-base font-bold text-gray-800">BotDolphin</h1>
              <p className="text-[10px] text-gray-400 -mt-0.5">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-xl p-1">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <span className="mr-1">{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
            <button onClick={load} className="ml-2 p-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition text-gray-500 text-sm" title="Refresh">↻</button>
            <button onClick={logout} className="p-2.5 bg-gray-100 rounded-xl hover:bg-red-50 hover:text-red-500 transition text-gray-500 text-sm" title="Logout">⏻</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ═══ OVERVIEW ═══ */}
        {tab === 'overview' && stats && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon="👥" label="Total Users" value={stats.users.total} sub={`${stats.users.active7d} active`} color="indigo" />
              <StatCard icon="💳" label="Paid Users" value={stats.users.paid} sub={funnel ? `${funnel.conversion_rate}% conv.` : ''} color="green" />
              <StatCard icon="⏳" label="Free Trials" value={stats.users.freeTrials} sub={funnel ? `${funnel.active_trials} active` : ''} color="amber" />
              <StatCard icon="💰" label="MRR" value={`$${revenue?.mrr || 0}`} sub={`$${(revenue?.arr||0).toLocaleString()} ARR`} color="purple" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon="🤖" label="Chatbots" value={stats.chatbots.total} sub={`${stats.chatbots.active} active`} color="cyan" />
              <StatCard icon="💬" label="Conversations" value={stats.conversations.total.toLocaleString()} sub={`${stats.conversations.last7d} this week`} color="blue" />
              <StatCard icon="📧" label="Leads Captured" value={stats.leads.total.toLocaleString()} sub={`${stats.leads.last7d} this week`} color="teal" />
              <StatCard icon="📨" label="Messages" value={stats.messages.total.toLocaleString()} sub={`${stats.messages.last7d} this week`} color="rose" />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-4">Daily Signups (30d)</h3>
                <MiniChart data={signups} color="#6366f1" height={80} />
                <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                  <span>{signups[0]?.date?.split('T')[0]}</span><span>{signups[signups.length-1]?.date?.split('T')[0]}</span>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-4">Daily Conversations (30d)</h3>
                <MiniChart data={convosDaily} color="#10b981" height={80} />
                <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                  <span>{convosDaily[0]?.date?.split('T')[0]}</span><span>{convosDaily[convosDaily.length-1]?.date?.split('T')[0]}</span>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-4">Daily Leads (30d)</h3>
                <MiniChart data={leadsDaily} color="#f59e0b" height={80} />
                <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                  <span>{leadsDaily[0]?.date?.split('T')[0]}</span><span>{leadsDaily[leadsDaily.length-1]?.date?.split('T')[0]}</span>
                </div>
              </div>
            </div>

            {/* Funnel */}
            {funnel && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-6">Trial to Paid Conversion Funnel</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Total Signups', value: funnel.total_signups, color: 'bg-indigo-500', pct: 100 },
                    { label: 'Active Trials', value: funnel.active_trials, color: 'bg-amber-500', pct: funnel.total_signups > 0 ? (funnel.active_trials/funnel.total_signups*100) : 0 },
                    { label: 'Converted to Paid', value: funnel.converted_to_paid, color: 'bg-emerald-500', pct: funnel.total_signups > 0 ? (funnel.converted_to_paid/funnel.total_signups*100) : 0 },
                    { label: 'Expired / Churned', value: funnel.expired_trials, color: 'bg-red-400', pct: funnel.total_signups > 0 ? (funnel.expired_trials/funnel.total_signups*100) : 0 },
                  ].map((s, i) => (
                    <div key={i} className="text-center">
                      <div className="h-20 bg-gray-50 rounded-xl overflow-hidden relative border border-gray-100">
                        <div className={`${s.color} absolute bottom-0 left-0 right-0 rounded-b-xl transition-all`} style={{height:`${Math.max(s.pct, 5)}%`}} />
                        <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-black text-gray-800">{s.value}</span></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-center mt-5 text-sm text-gray-500">Conversion Rate: <span className="text-xl font-black text-emerald-600">{funnel.conversion_rate}%</span></p>
              </div>
            )}

            {/* Recent Signups */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-50"><h3 className="text-sm font-semibold text-gray-600">Recent Signups</h3></div>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-400 text-xs border-b border-gray-50 bg-gray-50/50">
                  <th className="text-left py-3 px-5 font-medium">Email</th><th className="text-left py-3 px-5 font-medium">Name</th>
                  <th className="text-left py-3 px-5 font-medium">Plan</th><th className="text-left py-3 px-5 font-medium">Chatbots</th>
                  <th className="text-left py-3 px-5 font-medium">Signed Up</th>
                </tr></thead>
                <tbody>{recentUsers.slice(0,10).map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-indigo-50/30 transition">
                    <td className="py-3 px-5 text-gray-700 font-medium">{u.email}</td>
                    <td className="py-3 px-5 text-gray-500">{u.name||'—'}</td>
                    <td className="py-3 px-5">{planBadge(u.plan)}</td>
                    <td className="py-3 px-5 text-gray-500">{u.chatbot_count}</td>
                    <td className="py-3 px-5 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ USERS ═══ */}
        {tab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-3.5 text-gray-400">🔍</span>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by email or name..." className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" />
              </div>
              <span className="text-gray-400 text-sm font-medium">{filteredUsers.length} users</span>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-400 text-xs border-b border-gray-100 bg-gray-50/80">
                  <th className="text-left py-3 px-4 font-medium">Email</th><th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Plan</th><th className="text-left py-3 px-4 font-medium">Trial Ends</th>
                  <th className="text-left py-3 px-4 font-medium">Joined</th><th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr></thead>
                <tbody>{filteredUsers.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-indigo-50/30 transition">
                    <td className="py-3 px-4 text-gray-700 font-medium">{u.email}</td>
                    <td className="py-3 px-4 text-gray-500">{u.name||'—'}</td>
                    <td className="py-3 px-4">
                      <select value={u.plan||'free'} onChange={e => changePlan(u.id, e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                        <option value="free">Free</option><option value="basic">Basic ($8)</option>
                        <option value="launch">Launch ($18)</option><option value="professional">Pro ($44)</option>
                        <option value="enterprise">Enterprise ($120)</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{u.trial_ends_at ? new Date(u.trial_ends_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button onClick={() => extendTrial(u.id, 7)} className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-semibold hover:bg-amber-100 transition" title="Extend trial 7 days">+7d</button>
                      <button onClick={() => extendTrial(u.id, 14)} className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition" title="Extend trial 14 days">+14d</button>
                      <button onClick={() => deleteUser(u.id, u.email)} className="px-2 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-100 transition" title="Delete user">Delete</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              {filteredUsers.length === 0 && <p className="py-12 text-center text-gray-400">No users found</p>}
            </div>
          </div>
        )}

        {/* ═══ REVENUE ═══ */}
        {tab === 'revenue' && revenue && (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-6">
              <StatCard icon="💰" label="Monthly Recurring Revenue" value={`$${revenue.mrr}`} color="green" />
              <StatCard icon="📅" label="Annual Run Rate" value={`$${revenue.arr.toLocaleString()}`} color="purple" />
              <StatCard icon="💳" label="Paid Subscribers" value={stats?.users.paid||0} sub={funnel?`${funnel.conversion_rate}% of total`:''} color="blue" />
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-600 mb-6">Revenue by Plan</h3>
              <div className="space-y-5">
                {revenue.breakdown.map((p, i) => {
                  const total = p.price_per_user * parseInt(p.count);
                  const pct = revenue.mrr > 0 ? Math.round((total / revenue.mrr) * 100) : 0;
                  const colors = { basic: '#3b82f6', launch: '#6366f1', professional: '#8b5cf6', enterprise: '#f59e0b' };
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-700 font-semibold capitalize">{p.plan} <span className="text-gray-400 font-normal">(${p.price_per_user}/mo × {p.count} users)</span></span>
                        <span className="font-bold text-gray-800">${total}/mo <span className="text-gray-400 text-xs ml-1">{pct}%</span></span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: colors[p.plan]||'#6366f1' }} />
                      </div>
                    </div>
                  );
                })}
                {revenue.breakdown.length === 0 && <p className="text-gray-400 text-center py-8">No paid subscribers yet</p>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-50"><h3 className="text-sm font-semibold text-gray-600">Top Users by Usage</h3></div>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-400 text-xs border-b border-gray-50 bg-gray-50/50">
                  <th className="text-left py-3 px-5 font-medium">#</th><th className="text-left py-3 px-5 font-medium">Email</th>
                  <th className="text-left py-3 px-5 font-medium">Plan</th><th className="text-right py-3 px-5 font-medium">Chatbots</th>
                  <th className="text-right py-3 px-5 font-medium">Convos</th><th className="text-right py-3 px-5 font-medium">Leads</th>
                </tr></thead>
                <tbody>{topUsers.slice(0,10).map((u, i) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-indigo-50/30 transition">
                    <td className="py-3 px-5 text-gray-400 font-bold">{i+1}</td>
                    <td className="py-3 px-5 text-gray-700 font-medium">{u.email}</td>
                    <td className="py-3 px-5">{planBadge(u.plan)}</td>
                    <td className="py-3 px-5 text-right text-gray-600">{u.chatbot_count}</td>
                    <td className="py-3 px-5 text-right text-gray-600">{u.conversation_count}</td>
                    <td className="py-3 px-5 text-right text-gray-600">{u.lead_count}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ GROWTH ═══ */}
        {tab === 'growth' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Signups (30 days)</h3>
                <p className="text-4xl font-black text-indigo-600 mb-4">{signups.reduce((a,b) => a+(b.count||0), 0)}</p>
                <MiniChart data={signups} color="#6366f1" height={100} />
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Conversations (30 days)</h3>
                <p className="text-4xl font-black text-emerald-600 mb-4">{convosDaily.reduce((a,b) => a+(b.count||0), 0)}</p>
                <MiniChart data={convosDaily} color="#10b981" height={100} />
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Leads Captured (30 days)</h3>
                <p className="text-4xl font-black text-amber-600 mb-4">{leadsDaily.reduce((a,b) => a+(b.count||0), 0)}</p>
                <MiniChart data={leadsDaily} color="#f59e0b" height={100} />
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Conversion Rate</h3>
                {funnel && <>
                  <p className="text-4xl font-black text-emerald-600 mb-4">{funnel.conversion_rate}%</p>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Total Signups</span><span className="text-gray-800 font-bold">{funnel.total_signups}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Active Trials</span><span className="text-amber-600 font-bold">{funnel.active_trials}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Converted</span><span className="text-emerald-600 font-bold">{funnel.converted_to_paid}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Churned</span><span className="text-red-500 font-bold">{funnel.expired_trials}</span></div>
                  </div>
                </>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('bd_admin_token'));
  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: '12px' } }} />
      {loggedIn ? <Dashboard /> : <LoginScreen onLogin={() => setLoggedIn(true)} />}
    </>
  );
}
