import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
const client = new SecretManagerServiceClient();

export async function getProjectId() {
  const auth = new GoogleAuth();
  return await auth.getProjectId();
}

export async function storeToken(characterID, tokenData) {
  const projectId = await getProjectId();
  const secretId = `eve-token-${characterID}`;
  const parent = `projects/${projectId}`;
  const payload = JSON.stringify(tokenData);

  try {
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
      console.log(`Created secret: ${secretName}`);
    } else {
      secretName = `${parent}/secrets/${secretId}`;
      console.log(`ℹ Secret exists: ${secretName}`);
    }

    const [version] = await client.addSecretVersion({
      parent: secretName,
      payload: {
        data: Buffer.from(payload, 'utf8'),
      },
    });

    console.log(`Stored token for ${characterID} as version: ${version.name}`);
  } catch (err) {
    console.error(`Failed to store token for ${characterID}: ${err.message}`);
  }
}

export async function getValidToken(characterID) {
  const projectId = await getProjectId();
  const secretName = `projects/${projectId}/secrets/eve-token-${characterID}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name: secretName });
    const payload = JSON.parse(version.payload.data.toString('utf8'));

    const expiresAt = payload.timestamp + payload.expires_in * 1000;
    const now = Date.now();

    // Refresh if less than 2 minutes left
    if (now >= expiresAt - 2 * 60 * 1000) {
      console.log(`Token expired or near expiry. Refreshing for ${characterID}...`);
      const refreshed = await refreshToken(payload.refresh_token);
      await storeToken(characterID, refreshed);
      return refreshed.access_token;
    }

    return payload;
  } catch (err) {
    console.error(`Failed to retrieve or refresh token for ${characterID}: ${err.message}`);
    throw err;
  }
}

async function refreshToken(refresh_token) {
  const res = await axios.post(
    'https://login.eveonline.com/v2/oauth/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
    }),
    {
      headers: {
        'Authorization': 'Basic ' +
          Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_in: res.data.expires_in,
    timestamp: Date.now()
  };
}
