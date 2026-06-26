import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

try {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  console.log('Reading config from:', configPath);
  if (fs.existsSync(configPath)) {
    const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Keys in config:', Object.keys(content));
    if (content.tokens) {
      console.log('Keys in tokens:', Object.keys(content.tokens));
      // Log some details without exposing sensitive info fully
      const user = content.user || {};
      console.log('User email:', user.email);
    }
  } else {
    console.log('Config file does not exist.');
  }
} catch (err) {
  console.error('Error reading config:', err);
}
