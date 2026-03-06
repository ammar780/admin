require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Database ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

// ── Auth Middleware ──
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'botdolphin-admin-2026';
const AUTH_TOKEN = Buffer.from(ADMIN_PASS).toString('base64');

function requireAuth(req, res, next) {
  const token = req.cookies?.admin_token || req.headers['x-admin-token'];
  if (token === AUTH_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Auth Routes ──
app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASS) {
    res.cookie('admin_token', AUTH_TOKEN, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Invalid password' });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

app.get('/api/check-auth', requireAuth, (req, res) => {
  res.json({ authenticated: true });
});

// ── Discovery: List all tables and their columns ──
app.get('/api/schema', requireAuth, async (req, res) => {
  try {
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const schema = {};
    for (const t of tables.rows) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [t.table_name]);
      schema[t.table_name] = cols.rows;
    }
    res.json(schema);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Generic table query with pagination, search, sort ──
app.get('/api/table/:name', requireAuth, async (req, res) => {
  try {
    const table = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const sortCol = (req.query.sort || 'id').replace(/[^a-zA-Z0-9_]/g, '');
    const sortDir = req.query.dir === 'asc' ? 'ASC' : 'DESC';

    // Get columns for this table
    const colResult = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_schema='public' AND table_name=$1
    `, [table]);
    const columns = colResult.rows;
    const colNames = columns.map(c => c.column_name);

    // Check if sort column exists
    const actualSort = colNames.includes(sortCol) ? sortCol : (colNames.includes('id') ? 'id' : colNames[0]);

    // Build search WHERE
    let where = '';
    const params = [];
    if (search) {
      const textCols = columns.filter(c => ['text', 'character varying', 'varchar'].includes(c.data_type)).map(c => c.column_name);
      if (textCols.length) {
        where = 'WHERE ' + textCols.map((c, i) => `CAST("${c}" AS TEXT) ILIKE $${i + 1}`).join(' OR ');
        textCols.forEach(() => params.push(`%${search}%`));
      }
    }

    const countQ = await pool.query(`SELECT COUNT(*) FROM "${table}" ${where}`, params);
    const total = parseInt(countQ.rows[0].count);

    const dataQ = await pool.query(
      `SELECT * FROM "${table}" ${where} ORDER BY "${actualSort}" ${sortDir} LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({ rows: dataQ.rows, total, page, limit, columns: colNames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CSV Export for any table ──
app.get('/api/export/:name', requireAuth, async (req, res) => {
  try {
    const table = req.params.name.replace(/[^a-zA-Z0-9_]/g, '');
    const cols = req.query.columns ? req.query.columns.split(',').map(c => `"${c.replace(/[^a-zA-Z0-9_]/g, '')}"`).join(',') : '*';
    const result = await pool.query(`SELECT ${cols} FROM "${table}" ORDER BY 1 DESC`);

    if (!result.rows.length) return res.status(404).send('No data');

    const headers = Object.keys(result.rows[0]);
    let csv = headers.join(',') + '\n';
    result.rows.forEach(row => {
      csv += headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${table}_export_${new Date().toISOString().slice(0,10)}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Dashboard Stats (auto-adapts to schema) ──
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const stats = {};

    // Discover what tables exist
    const tablesQ = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' AND table_type='BASE TABLE'
    `);
    const tableNames = tablesQ.rows.map(r => r.table_name);
    stats.tables = tableNames;

    // Count rows in key tables
    for (const t of tableNames) {
      try {
        const c = await pool.query(`SELECT COUNT(*) FROM "${t}"`);
        stats[`${t}_count`] = parseInt(c.rows[0].count);
      } catch (e) { /* skip */ }
    }

    // Try to get user stats (common table names)
    const userTable = tableNames.find(t => /^users?$/i.test(t)) || tableNames.find(t => t.includes('user'));
    if (userTable) {
      stats.user_table = userTable;

      // Get columns
      const colsQ = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [userTable]);
      const cols = colsQ.rows.map(r => r.column_name);
      stats.user_columns = cols;

      // Total users
      const total = await pool.query(`SELECT COUNT(*) FROM "${userTable}"`);
      stats.total_users = parseInt(total.rows[0].count);

      // Date column detection
      const dateCol = cols.find(c => /created_at|createdat|created|signup|registered/i.test(c));
      if (dateCol) {
        // Signups last 7 days
        try {
          const recent = await pool.query(`SELECT COUNT(*) FROM "${userTable}" WHERE "${dateCol}" >= NOW() - INTERVAL '7 days'`);
          stats.signups_7d = parseInt(recent.rows[0].count);
        } catch (e) {}

        // Signups last 30 days
        try {
          const monthly = await pool.query(`SELECT COUNT(*) FROM "${userTable}" WHERE "${dateCol}" >= NOW() - INTERVAL '30 days'`);
          stats.signups_30d = parseInt(monthly.rows[0].count);
        } catch (e) {}

        // Signups by day (last 30 days)
        try {
          const daily = await pool.query(`
            SELECT DATE("${dateCol}") as day, COUNT(*) as count 
            FROM "${userTable}" 
            WHERE "${dateCol}" >= NOW() - INTERVAL '30 days'
            GROUP BY DATE("${dateCol}") ORDER BY day
          `);
          stats.signups_daily = daily.rows;
        } catch (e) {}

        // Signups by month (last 12 months)
        try {
          const monthly = await pool.query(`
            SELECT TO_CHAR("${dateCol}", 'YYYY-MM') as month, COUNT(*) as count 
            FROM "${userTable}" 
            WHERE "${dateCol}" >= NOW() - INTERVAL '12 months'
            GROUP BY TO_CHAR("${dateCol}", 'YYYY-MM') ORDER BY month
          `);
          stats.signups_monthly = monthly.rows;
        } catch (e) {}
      }

      // Plan column detection
      const planCol = cols.find(c => /plan|subscription|tier|plan_name|plan_type|role/i.test(c));
      if (planCol) {
        try {
          const plans = await pool.query(`SELECT "${planCol}" as plan, COUNT(*) as count FROM "${userTable}" GROUP BY "${planCol}" ORDER BY count DESC`);
          stats.plans = plans.rows;
          stats.plan_column = planCol;
        } catch (e) {}
      }

      // Trial column
      const trialCol = cols.find(c => /trial|is_trial|on_trial|trial_end|trial_ends/i.test(c));
      if (trialCol) {
        try {
          const trials = await pool.query(`SELECT "${trialCol}" as val, COUNT(*) as count FROM "${userTable}" GROUP BY "${trialCol}"`);
          stats.trials = trials.rows;
          stats.trial_column = trialCol;
        } catch (e) {}
      }

      // Email column
      const emailCol = cols.find(c => /email/i.test(c));
      if (emailCol) {
        stats.email_column = emailCol;
      }

      // Last 10 signups
      try {
        const limitCols = cols.slice(0, 8).map(c => `"${c}"`).join(',');
        const order = dateCol ? `"${dateCol}" DESC` : '1 DESC';
        const latest = await pool.query(`SELECT ${limitCols} FROM "${userTable}" ORDER BY ${order} LIMIT 10`);
        stats.latest_users = latest.rows;
      } catch (e) {}
    }

    // Chatbots table
    const botTable = tableNames.find(t => /chatbot/i.test(t)) || tableNames.find(t => /bot/i.test(t));
    if (botTable) {
      stats.bot_table = botTable;
      const c = await pool.query(`SELECT COUNT(*) FROM "${botTable}"`);
      stats.total_chatbots = parseInt(c.rows[0].count);
    }

    // Messages / conversations
    const msgTable = tableNames.find(t => /message/i.test(t));
    if (msgTable) {
      stats.msg_table = msgTable;
      const c = await pool.query(`SELECT COUNT(*) FROM "${msgTable}"`);
      stats.total_messages = parseInt(c.rows[0].count);
    }

    const convTable = tableNames.find(t => /conversation/i.test(t));
    if (convTable) {
      stats.conv_table = convTable;
      const c = await pool.query(`SELECT COUNT(*) FROM "${convTable}"`);
      stats.total_conversations = parseInt(c.rows[0].count);
    }

    // Leads table
    const leadTable = tableNames.find(t => /lead/i.test(t));
    if (leadTable) {
      stats.lead_table = leadTable;
      const c = await pool.query(`SELECT COUNT(*) FROM "${leadTable}"`);
      stats.total_leads = parseInt(c.rows[0].count);
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Run custom SQL (read-only for safety) ──
app.post('/api/query', requireAuth, async (req, res) => {
  try {
    const sql = (req.body.sql || '').trim();
    if (!sql) return res.status(400).json({ error: 'No query provided' });

    // Only allow SELECT
    if (!/^SELECT/i.test(sql)) {
      return res.status(403).json({ error: 'Only SELECT queries allowed' });
    }
    // Block dangerous keywords
    if (/\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i.test(sql)) {
      return res.status(403).json({ error: 'Modification queries not allowed' });
    }

    const result = await pool.query(sql);
    res.json({ rows: result.rows, rowCount: result.rowCount, columns: result.fields?.map(f => f.name) || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SPA fallback ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🐬 BotDolphin Admin running on port ${PORT}`);
});
