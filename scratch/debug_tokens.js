import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('tokens.scopes:', config.tokens.scopes);
  console.log('tokens.scope:', config.tokens.scope);
  console.log('token_type:', config.tokens.token_type);
} else {
  console.log('Config not found');
}
