import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleAuth } from 'google-auth-library';

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
      console.log(`✅ Created secret: ${secretName}`);
    } else {
      secretName = `${parent}/secrets/${secretId}`;
      console.log(`ℹ️ Secret exists: ${secretName}`);
    }

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
