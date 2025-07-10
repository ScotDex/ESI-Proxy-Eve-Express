/**
 * Express application for EVE Online SSO authentication.
 * 
 * Features:
 * - /auth/login: Redirects user to EVE Online OAuth2 authorization endpoint.
 * - /auth/callback: Handles OAuth2 callback, exchanges code for tokens, verifies character, and returns character info.
 * 
 * Environment Variables:
 * @env {string} CLIENT_ID - EVE Online application client ID.
 * @env {string} CLIENT_SECRET - EVE Online application client secret.
 * @env {string} REDIRECT_URI - OAuth2 redirect URI.
 * @env {string} [NAME] - Name to display on the root endpoint.
 * @env {string|number} [PORT=8080] - Port for the server to listen on.
 * 
 * Dependencies:
 * - express: Web framework.
 * - axios: HTTP client for API requests.
 * - dotenv: Loads environment variables.
 * - crypto: Generates random state for OAuth2.
 */
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
const client = new SecretManagerServiceClient();
const app = express();

app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const scopes = process.env.ESI_SCOPES;
  const authUrl = `https://login.eveonline.com/v2/oauth/authorize?` +
    `response_type=code&` +
    `client_id=${process.env.CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${state}`;

  res.redirect(authUrl);
});


async function storeTokenInSecretManager(characterID, tokenData) {
  const secretId = `eve-token-${characterID}`;
  const parent = `projects/${process.env.GCP_PROJECT_ID}`;
  const payload = JSON.stringify(tokenData);

  try {
    // Check if secret exists
    const [secrets] = await client.listSecrets({ parent });
    const exists = secrets.some(secret => secret.name.endsWith(`/secrets/${secretId}`));

    let secretName;
    if (!exists) {
      const [secret] = await client.createSecret({
        parent,
        secretId,
        secret: {
          replication: { automatic: {} },
        },
      });
      secretName = secret.name;
      console.log(`✅ Created secret: ${secretName}`);
    } else {
      secretName = `${parent}/secrets/${secretId}`;
      console.log(`ℹ️ Secret exists: ${secretName}`);
    }

    // Add a new secret version (i.e. update token)
    const [version] = await client.addSecretVersion({
      parent: secretName,
      payload: {
        data: Buffer.from(payload, 'utf8'),
      },
    });

    console.log(`✅ Stored token for ${characterID} as version: ${version.name}`);
  } catch (err) {
    console.error(`❌ Failed to store token for ${characterID}: ${err.message}`);
  }
}


app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post(
      'https://login.eveonline.com/v2/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI
      }),
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get character info
    const verifyResponse = await axios.get('https://login.eveonline.com/oauth/verify', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const character = verifyResponse.data;

  await storeTokenInSecretManager(character.CharacterID, {
  access_token,
  refresh_token,
  expires_in,
  timestamp: Date.now()
});


    // For now, just show the data in the browser
    res.json({
      character_name: character.CharacterName,
      character_id: character.CharacterID,
      access_token,
      refresh_token,
      expires_in
    });

  } catch (error) {
    console.error('OAuth callback failed:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});

const port = parseInt(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`Proxy listening on port ${port}`);
});




