#!/usr/bin/env npx tsx
/**
 * LinkedIn OAuth Helper Script
 *
 * Automates the OAuth 2.0 authorization code flow:
 * 1. Starts a local callback server
 * 2. Opens browser with LinkedIn authorization URL
 * 3. Captures the authorization code
 * 4. Exchanges code for access token
 * 5. Updates .envrc with the new token
 *
 * Usage: npm run auth
 */

import * as http from 'node:http';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

// Configuration
const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = ['r_ads', 'rw_ads', 'r_ads_reporting'];

// Get directory of this script
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENVRC_PATH = path.join(PROJECT_ROOT, '.envrc');

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
}

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    console.error(`❌ Missing environment variable: ${name}`);
    console.error(`   Make sure your .envrc is set up and run 'direnv allow'`);
    process.exit(1);
  }
  return value;
}

function buildAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    state: crypto.randomUUID(),
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${error}`);
  }

  return (await response.json()) as TokenResponse;
}

function updateEnvrc(accessToken: string, expiresIn: number): void {
  const expiryDate = new Date(Date.now() + expiresIn * 1000);

  let content = '';
  if (fs.existsSync(ENVRC_PATH)) {
    content = fs.readFileSync(ENVRC_PATH, 'utf-8');
  }

  // Remove existing LINKEDIN_ACCESS_TOKEN lines (including commented ones about the token)
  const lines = content.split('\n').filter((line) => {
    const trimmed = line.trim();
    return (
      !trimmed.startsWith('export LINKEDIN_ACCESS_TOKEN=') &&
      !trimmed.startsWith('# export LINKEDIN_ACCESS_TOKEN=') &&
      !trimmed.includes('Token expires:')
    );
  });

  // Add new token
  lines.push('');
  lines.push(`# Token expires: ${expiryDate.toISOString().split('T')[0]} (${Math.round(expiresIn / 86400)} days)`);
  lines.push(`export LINKEDIN_ACCESS_TOKEN="${accessToken}"`);

  fs.writeFileSync(ENVRC_PATH, lines.join('\n').trim() + '\n');
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  let command: string;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  await execAsync(command);
}

async function main(): Promise<void> {
  console.log('🔐 LinkedIn OAuth Helper\n');

  // Load credentials from environment
  const clientId = getEnvVar('LINKEDIN_CLIENT_ID');
  const clientSecret = getEnvVar('LINKEDIN_CLIENT_SECRET');

  console.log(`📋 Client ID: ${clientId}`);
  console.log(`🔗 Redirect URI: ${REDIRECT_URI}`);
  console.log(`📝 Scopes: ${SCOPES.join(', ')}\n`);

  console.log('⚠️  Make sure you have added this redirect URI to your LinkedIn app:');
  console.log(`   ${REDIRECT_URI}\n`);

  // Create promise to capture the authorization code
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  // Start local server
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error !== null) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>❌ Authorization Failed</h1>
              <p>${error}: ${errorDescription ?? 'Unknown error'}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        rejectCode(new Error(`${error}: ${errorDescription ?? 'Unknown error'}`));
        return;
      }

      if (code === null) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>❌ No Authorization Code</h1>
              <p>The response did not include an authorization code.</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        rejectCode(new Error('No authorization code received'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>✅ Authorization Successful!</h1>
            <p>Exchanging code for access token...</p>
            <p>You can close this window.</p>
          </body>
        </html>
      `);
      resolveCode(code);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(PORT, () => {
    console.log(`🌐 Callback server listening on port ${PORT}`);
  });

  // Build and open auth URL
  const authUrl = buildAuthUrl(clientId);
  console.log('\n🚀 Opening browser for authorization...\n');

  try {
    await openBrowser(authUrl);
  } catch {
    console.log('Could not open browser automatically. Please open this URL manually:');
    console.log(`\n${authUrl}\n`);
  }

  console.log('⏳ Waiting for authorization...\n');

  try {
    // Wait for the authorization code
    const code = await codePromise;
    console.log('✅ Authorization code received!');

    // Exchange code for token
    console.log('🔄 Exchanging code for access token...');
    const tokenResponse = await exchangeCodeForToken(code, clientId, clientSecret);

    console.log('✅ Access token received!');
    console.log(`   Expires in: ${Math.round(tokenResponse.expires_in / 86400)} days`);
    console.log(`   Scopes: ${tokenResponse.scope}`);

    // Update .envrc
    console.log('\n📝 Updating .envrc...');
    updateEnvrc(tokenResponse.access_token, tokenResponse.expires_in);
    console.log('✅ Token saved to .envrc');

    // Remind user to reload direnv
    console.log('\n🔄 Run this command to load the new token:');
    console.log('   direnv allow\n');

    console.log('🎉 Done! You can now use the LinkedIn Campaign Manager MCP server.\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    server.close();
  }
}

main().catch(console.error);
