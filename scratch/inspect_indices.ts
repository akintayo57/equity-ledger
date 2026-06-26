import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const projectId = 'harbour-finance-prod';

async function main() {
  try {
    const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
    if (!fs.existsSync(configPath)) {
      console.error('Firebase CLI config not found.');
      process.exit(1);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const accessToken = config.tokens?.access_token;
    if (!accessToken) {
      console.error('Access token not found in Firebase CLI config.');
      process.exit(1);
    }

    const headersRest = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    console.log(`Connecting to online Firestore project: ${projectId} via REST API...`);
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/indices`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: headersRest
    });

    if (!res.ok) {
      console.error(`Firestore GET failed: ${res.statusText} (${res.status})`);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`Fetched documents count: ${data.documents?.length || 0}`);
    if (data.documents) {
      data.documents.forEach((doc: any) => {
        const name = doc.name.split('/').pop();
        console.log(`\nDocument: ${name}`);
        console.log(JSON.stringify(doc.fields, null, 2));
      });
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
