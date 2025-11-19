#!/usr/bin/env node

// Database Authentication Troubleshooter
import pkg from 'pg';
import "dotenv/config";

const { Pool } = pkg;

console.log('🔍 Database Authentication Troubleshooter');
console.log('==========================================\n');

// Parse DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
console.log('DATABASE_URL (sanitized):', dbUrl?.replace(/:[^:@]*@/, ':****@'));

try {
  const url = new URL(dbUrl);
  console.log('Parsed connection details:');
  console.log('- Host:', url.hostname);
  console.log('- Port:', url.port);
  console.log('- Database:', url.pathname.slice(1));
  console.log('- Username:', url.username);
  console.log('- Password:', url.password ? '****' : 'NOT SET');
  console.log('- SSL Mode:', url.searchParams.get('sslmode') || 'not specified');
  
  console.log('\n🔑 Testing authentication...');
  
  // Test with the provided credentials
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined
    },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  
  // Test basic connection
  console.log('✅ Authentication successful!');
  
  // Get database info
  const result = await client.query('SELECT current_user, current_database(), version()');
  console.log('\n📊 Connection details:');
  console.log('- Current user:', result.rows[0].current_user);
  console.log('- Current database:', result.rows[0].current_database);
  console.log('- PostgreSQL version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
  
  // Test permissions
  console.log('\n🔒 Testing permissions...');
  try {
    await client.query('CREATE TABLE IF NOT EXISTS test_permissions (id SERIAL PRIMARY KEY, created_at TIMESTAMP DEFAULT NOW())');
    await client.query('INSERT INTO test_permissions DEFAULT VALUES');
    const countResult = await client.query('SELECT COUNT(*) as count FROM test_permissions');
    console.log('✅ Write permissions: OK (test records:', countResult.rows[0].count + ')');
    await client.query('DROP TABLE test_permissions');
  } catch (permErr) {
    console.log('❌ Write permissions: FAILED -', permErr.message);
  }
  
  client.release();
  await pool.end();
  console.log('\n🎉 Database authentication test completed successfully!');
  
} catch (err) {
  console.error('\n❌ Authentication failed:', err.message);
  console.error('Error code:', err.code);
  
  if (err.code === '28P01') {
    console.log('\n🔧 Authentication troubleshooting steps:');
    console.log('1. Verify the username and password in AWS RDS Console');
    console.log('2. Check if the user exists: SELECT usename FROM pg_user;');
    console.log('3. Check if password is correct');
    console.log('4. Ensure user has permission to access the database');
    console.log('\n💡 Common solutions:');
    console.log('- Reset the RDS master password in AWS Console');
    console.log('- Use the master username instead of "hiha"');
    console.log('- Create the user "hiha" if it doesn\'t exist');
  } else if (err.code === '3D000') {
    console.log('\n🔧 Database "arbitrage_bot" does not exist');
    console.log('Create it with: CREATE DATABASE arbitrage_bot;');
  }
  
  process.exit(1);
}
