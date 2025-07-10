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



const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
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

async function createSecret() {
  const secretConfig = {
    replication: {
      automatic: {},
    },
  };

  // Add TTL to the secret configuration if provided
  if (ttl) {
    secretConfig.ttl = {
      seconds: parseInt(ttl.replace('s', ''), 10),
    };
    console.log(`Secret TTL set to ${ttl}`);
  }

  const [secret] = await client.createSecret({
    parent: parent,
    secretId: secretId,
    secret: secretConfig,
  });

  console.log(`Created secret ${secret.name}`);
}

createSecret();


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




