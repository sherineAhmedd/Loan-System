
import { config } from 'dotenv';


config();
let jwt: any;
try {
  jwt = require('jsonwebtoken');
} catch (error) {
  console.error('\n❌ Error: jsonwebtoken package not found.');
  console.error('Please install it first: npm install jsonwebtoken @types/jsonwebtoken\n');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || 'loan-system-secret-key-change-in-production';
const service = process.argv.find(arg => arg.startsWith('--service='))?.split('=')[1] || 'loan-system';
const expiresIn = process.argv.find(arg => arg.startsWith('--expires='))?.split('=')[1] || '24h';

const payload = {
  sub: service,
  service: service,
  iat: Math.floor(Date.now() / 1000),
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn });

console.log('\n=== JWT Token Generated ===');
console.log('Token:', token);
console.log('\n=== Token Details ===');
console.log('Service:', service);
console.log('Expires In:', expiresIn);
console.log('Secret Used:', JWT_SECRET.substring(0, 10) + '...');
console.log('\n=== Usage ===');
console.log('1. Add to frontend .env file: VITE_JWT_TOKEN=' + token);
console.log('2. Or use in Swagger UI: Click "Authorize" button and paste the token');
console.log('3. Or use in API requests: Authorization: Bearer ' + token);
console.log('\n');

