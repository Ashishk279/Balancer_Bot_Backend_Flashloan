#!/usr/bin/env node

// Quick database connection test
import pkg from 'pg';
import "dotenv/config";

const { Pool } = pkg;

console.log('🔍 Testing database connection...');
console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@'));

const isRDS = process.env.DATABASE_URL?.includes('rds.amazonaws.com');
console.log('Connection type:', isRDS ? 'AWS RDS' : 'Local');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRDS ? {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined
  } : false,
  connectionTimeoutMillis: 10000,
});

async function testConnection() {
  try {
    console.log('⏳ Attempting connection...');
    const client = await pool.connect();
    
    const result = await client.query('SELECT version(), now() as current_time');
    console.log('✅ Connection successful!');
    console.log('Database version:', result.rows[0].version.split(' ')[0]);
    console.log('Current time:', result.rows[0].current_time);
    
    client.release();
    await pool.end();
    console.log('🎉 Database connection test completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('Error code:', err.code);
    
    if (err.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.log('\n🔧 Certificate issue detected. Try these fixes:');
      console.log('1. Set NODE_TLS_REJECT_UNAUTHORIZED=0 in environment');
      console.log('2. Use sslmode=require in DATABASE_URL');
      console.log('3. Ensure SSL config has rejectUnauthorized: false');
    }
    
    await pool.end();
    process.exit(1);
  }
}

testConnection();
