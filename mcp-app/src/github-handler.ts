import { env as cfEnv } from 'cloudflare:workers';
import type { AuthRequest, OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { Hono } from 'hono';

const env = cfEnv as Env;

type HonoEnv = { Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } };

const app = new Hono<HonoEnv>();

app.get('/authorize', async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);

  const state = btoa(JSON.stringify({
    oauthReqInfo,
    timestamp: Date.now(),
  }));

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: new URL('/callback', c.req.url).href,
    scope: 'read:user user:email',
    state,
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

app.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.text('Missing code or state', 400);
  }

  let oauthReqInfo: AuthRequest;
  try {
    const parsed = JSON.parse(atob(state)) as { oauthReqInfo: AuthRequest };
    oauthReqInfo = parsed.oauthReqInfo;
  } catch {
    return c.text('Invalid state', 400);
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };

  if (!tokenData.access_token) {
    return c.text(`OAuth error: ${tokenData.error ?? 'unknown'}`, 400);
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'SimplePDF-MCP',
    },
  });

  const user = (await userResponse.json()) as { login: string; name?: string; email?: string };

  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: user.login,
    metadata: {
      label: user.name ?? user.login,
    },
    scope: oauthReqInfo.scope,
    props: {
      login: user.login,
      name: user.name ?? user.login,
      email: user.email ?? '',
      accessToken: tokenData.access_token,
    },
  });

  return c.redirect(redirectTo);
});

export { app as GitHubHandler };
