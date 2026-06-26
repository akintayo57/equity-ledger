import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

async function patchDocument(projectId, collection, docId, fields, updateFields, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}?${updateFields.map(f => `updateMask.fieldPaths=${f}`).join('&')}`;
  
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
  
  const body = {
    fields: {}
  };
  
  for (const [key, val] of Object.entries(fields)) {
    body.fields[key] = { stringValue: val };
  }
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body)
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to patch document ${docId}: ${res.statusText} (${res.status}) - ${errText}`);
  }
  
  return await res.json();
}

async function main() {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    console.error('Config file not found');
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const accessToken = config.tokens.access_token;
  const projectId = 'harbour-finance-902b';

  console.log('--- Updating GBTI ticker to BTI in online Firestore ---');
  try {
    const res = await patchDocument(projectId, 'securities', 'sec-1', { ticker: 'BTI' }, ['ticker'], accessToken);
    console.log('Successfully updated sec-1 ticker to BTI');
  } catch (err) {
    console.error(err);
  }

  console.log('\n--- Marking GNCB, GTI, and NBI as INACTIVE in online Firestore ---');
  const defunctSecurities = ['sec-gncb', 'sec-gti', 'sec-nbi'];
  for (const docId of defunctSecurities) {
    try {
      const res = await patchDocument(projectId, 'securities', docId, { status: 'INACTIVE' }, ['status'], accessToken);
      console.log(`Successfully marked ${docId} as INACTIVE`);
    } catch (err) {
      console.error(err);
    }
  }
  
  console.log('\nUpdates complete.');
}

main();
