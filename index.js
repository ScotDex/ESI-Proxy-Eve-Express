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

app.get('/', (req, res) => {
  const name = process.env.NAME || 'World';
  res.send(`Hello ${name}!`);
});





















const port = parseInt(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});




