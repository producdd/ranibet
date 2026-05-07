const SUPABASE_URL = 'https://gdntslyfogqzvzevcbnl.supabase.co';

function isAuthorizedCron(req) {
  const configuredSecret = String(process.env.CRON_SECRET || '').trim();
  const authHeader = String(req.headers.authorization || '').trim();
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const vercelCron = String(req.headers['x-vercel-cron'] || '').trim();

  if (configuredSecret) {
    return bearerToken === configuredSecret;
  }

  return vercelCron === '1';
}

async function closeWeeklyRanking() {
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!serviceRoleKey) {
    throw new Error('missing_SUPABASE_SERVICE_ROLE_KEY');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/close_weekly_ranking_secure`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`close_weekly_failed_${response.status}:${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  return data;
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ error: 'unauthorized_cron' });
  }

  try {
    const result = await closeWeeklyRanking();
    return res.status(200).json({
      ok: true,
      automated: true,
      executedAt: new Date().toISOString(),
      result
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'weekly_close_failed',
      message: String(error?.message || 'unknown_error')
    });
  }
}
