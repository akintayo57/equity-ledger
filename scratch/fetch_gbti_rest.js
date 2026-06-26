import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

async function main() {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    console.error('Config file not found');
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const accessToken = config.tokens.access_token;
  const projectId = 'harbour-finance-902b';
  
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // 1. Fetch the security details
  console.log('--- Fetching GBTI security document ---');
  try {
    const secUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/securities/sec-1`;
    const res = await fetch(secUrl, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch security: ${res.statusText} (${res.status})`);
    }
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }

  // 2. Fetch the prices for sec-1
  console.log('\n--- Fetching prices for sec-1 ---');
  try {
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'prices' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'securityId' },
            op: 'EQUAL',
            value: { stringValue: 'sec-1' }
          }
        }
      }
    };
    
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(queryBody)
    });
    
    if (!res.ok) {
      throw new Error(`Query failed: ${res.statusText} (${res.status})`);
    }
    
    const results = await res.json();
    console.log(`Found ${results.length} results.`);
    
    const prices = results
      .filter((r) => r.document)
      .map((r) => {
        const fields = r.document.fields;
        // Map Firestore document format to a simpler JSON
        const price = {};
        for (const [key, val] of Object.entries(fields)) {
          if (val.stringValue !== undefined) price[key] = val.stringValue;
          else if (val.doubleValue !== undefined) price[key] = Number(val.doubleValue);
          else if (val.integerValue !== undefined) price[key] = parseInt(val.integerValue, 10);
        }
        return price;
      });
      
    // Sort by date ascending
    prices.sort((a, b) => a.date.localeCompare(b.date));
    console.log(JSON.stringify(prices, null, 2));
    
  } catch (err) {
    console.error(err);
  }
}

main();
