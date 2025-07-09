import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const app = express();

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


app.get('/', (req, res) => {
  const name = process.env.NAME || 'World';
  res.send(`Hello ${name}!`);
});

const port = parseInt(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});




