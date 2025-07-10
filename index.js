import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { storeToken, getProjectId, getValidToken } from './Service/tokenManager.js';
dotenv.config();

const app = express();
const secretClient = new SecretManagerServiceClient();

app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const scopes = [
    'esi-wallet.read_character_wallet.v1',
    'esi-location.read_location.v1',
    'esi-skills.read_skills.v1'
  ].join(' ');


  const authUrl = `https://login.eveonline.com/v2/oauth/authorize?` +
    `response_type=code&` +
    `client_id=${process.env.CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${state}`;

  res.redirect(authUrl);
});


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

    await storeToken(character.CharacterID, {
      access_token,
      refresh_token,
      expires_in,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('OAuth callback failed:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});




async function refreshAllTokens() {
  const projectId = await getProjectId();
  const [secrets] = await secretClient.listSecrets({
    parent: `projects/${projectId}`,
  });

  for (const secret of secrets) {
    if (!secret.name.includes('eve-token-')) continue;

    const characterID = secret.name.split('/').pop().replace('eve-token-', '');
    try {
      await getValidToken(characterID);
      console.log(`🔄 Refreshed token for character ${characterID}`);
    } catch (err) {
      console.error(`❌ Error refreshing token for ${characterID}: ${err.message}`);
    }
  }
}
const port = parseInt(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`Proxy listening on port ${port}`);
  refreshAllTokens().then(() => {
    console.log('✅ Initial token refresh completed.');
  });
});

// Periodically refresh all tokens
setInterval(refreshAllTokens, 18 * 60 * 1000); // every 18 minutes




