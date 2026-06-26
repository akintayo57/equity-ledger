import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const projectId = 'harbour-finance-902b';

function parseCSV(content: string): string[][] {
  const lines = content.split('\n');
  return lines.map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }).filter(line => line.length > 1);
}

function convertDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

async function main() {
  try {
    // 1. Analyze CSV
    const csvPath = path.resolve('collected_dataset/gse_history_all.csv');
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV not found at: ${csvPath}`);
      process.exit(1);
    }
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvContent);
    const headers = rows[0];
    const colMap: Record<string, number> = {};
    headers.forEach((h, idx) => { colMap[h.toLowerCase()] = idx; });

    let csvMinDate = '9999-99-99';
    let csvMaxDate = '0000-00-00';
    const csvSecurities = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < headers.length) continue;
      const symbol = row[colMap['symbol']].toUpperCase();
      const rawDateStr = row[colMap['session_date']];
      if (!rawDateStr) continue;
      try {
        const date = convertDate(rawDateStr);
        csvSecurities.add(symbol);
        if (date < csvMinDate) csvMinDate = date;
        if (date > csvMaxDate) csvMaxDate = date;
      } catch (e) {}
    }

    console.log('--- CSV Analysis ---');
    console.log(`Total rows: ${rows.length - 1}`);
    console.log(`Date range: ${csvMinDate} to ${csvMaxDate}`);
    console.log(`Unique symbols (${csvSecurities.size}): ${Array.from(csvSecurities).join(', ')}`);

    // 2. Query Firestore Cloud
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

    console.log('\n--- Firestore Cloud Query ---');
    console.log('Fetching price documents from Firestore...');

    // Let's do a run of structured query to verify the price documents exist
    // Querying the first 10 documents in prices collection
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    
    // Check total count of prices in Firestore using query
    const countBody = {
      structuredQuery: {
        from: [{ collectionId: 'prices' }],
        limit: 10
      }
    };

    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: headersRest,
      body: JSON.stringify(countBody)
    });

    if (!res.ok) {
      console.error(`Firestore query failed: ${res.statusText} (${res.status})`);
      process.exit(1);
    }

    const queryData = await res.json();
    console.log(`First few documents returned from prices collection: ${queryData.length}`);
    if (queryData.length > 0 && queryData[0].document) {
      console.log('Sample document path:', queryData[0].document.name);
      console.log('Sample document fields:', JSON.stringify(queryData[0].document.fields, null, 2));
    } else {
      console.log('No documents returned or empty response.');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
