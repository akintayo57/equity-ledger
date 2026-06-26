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

  console.log('Fetching all price documents from Firestore to identify simulated ones...');
  
  let allPriceDocs = [];
  let nextPageToken = '';
  
  // Firestore REST API allows listing documents. Let's paginate through all prices.
  try {
    do {
      let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/prices?pageSize=300`;
      if (nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
      }
      
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Failed to list prices: ${res.statusText} (${res.status})`);
      }
      
      const data = await res.json();
      if (data.documents) {
        allPriceDocs.push(...data.documents);
      }
      nextPageToken = data.nextPageToken || '';
    } while (nextPageToken);
    
    console.log(`Total price documents found in Firestore: ${allPriceDocs.length}`);
  } catch (err) {
    console.error('Error listing prices:', err);
    process.exit(1);
  }

  // Filter for simulated documents
  const docsToDelete = allPriceDocs.filter(doc => {
    // Document path format: projects/harbour-finance-902b/databases/(default)/documents/prices/px-sec-1-26
    const nameParts = doc.name.split('/');
    const docId = nameParts[nameParts.length - 1];
    
    const idParts = docId.split('-');
    // If it contains a 4-digit year starting with 20 (like 2025, 2026), it is a real price record.
    const hasYear = idParts.some(part => /^(20\d\d)$/.test(part));
    
    return !hasYear;
  });

  console.log(`Identified ${docsToDelete.length} simulated price documents to delete.`);
  
  if (docsToDelete.length === 0) {
    console.log('No simulated price documents found to delete.');
    process.exit(0);
  }

  // Firestore REST API does not support custom batch delete easily without transaction, 
  // but we can delete them via multiple HTTP DELETE requests or write a simple batch commit.
  // A batch commit POSTs to https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents:commit
  // with write requests. Let's do batch commits in chunks of 100 for safety and speed!
  const chunkSize = 100;
  let deletedCount = 0;
  
  for (let i = 0; i < docsToDelete.length; i += chunkSize) {
    const chunk = docsToDelete.slice(i, i + chunkSize);
    const writes = chunk.map(doc => ({
      delete: doc.name
    }));
    
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
    try {
      const res = await fetch(commitUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ writes })
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Commit failed: ${res.statusText} (${res.status}) - ${errorText}`);
      }
      
      deletedCount += chunk.length;
      console.log(`  Deleted chunk ${i + chunk.length}/${docsToDelete.length}`);
    } catch (err) {
      console.error(`Error deleting chunk starting at index ${i}:`, err);
    }
  }

  console.log(`Successfully purged ${deletedCount} simulated weekly prices from the Firestore database.`);
}

main();
