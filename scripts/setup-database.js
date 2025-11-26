#!/usr/bin/env node

// Script to create the 'hiha' user and 'arbitrage_bot' database
import pkg from 'pg';
import "dotenv/config";

const { Pool } = pkg;

console.log('🔧 Setting up RDS database and user...');

// Connect with master credentials first
const masterUrl = process.env.DATABASE_URL.replace('/arbitrage_bot', '/postgres');
console.log('Connecting with master credentials to postgres database...');

const pool = new Pool({
  connectionString: masterUrl,
  ssl: {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined
  }
});

async function setupDatabase() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected as master user');
    
    // Check if user hiha exists
    console.log('🔍 Checking if user "hiha" exists...');
    const userCheck = await client.query("SELECT 1 FROM pg_user WHERE usename = 'hiha'");
    
    if (userCheck.rows.length === 0) {
      console.log('👤 Creating user "hiha"...');
      await client.query("CREATE USER hiha WITH PASSWORD 'Aim@#123'");
      console.log('✅ User "hiha" created');
    } else {
      console.log('✅ User "hiha" already exists');
    }
    
    // Check if database exists
    console.log('🔍 Checking if database "arbitrage_bot" exists...');
    const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'arbitrage_bot'");
    
    if (dbCheck.rows.length === 0) {
      console.log('🗄️  Creating database "arbitrage_bot"...');
      await client.query('CREATE DATABASE arbitrage_bot');
      console.log('✅ Database "arbitrage_bot" created');
    } else {
      console.log('✅ Database "arbitrage_bot" already exists');
    }
    
    // Grant permissions
    console.log('🔑 Granting permissions to user "hiha"...');
    await client.query('GRANT ALL PRIVILEGES ON DATABASE arbitrage_bot TO hiha');
    console.log('✅ Permissions granted');
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 Database setup completed!');
    console.log('You can now use: postgresql://hiha:Aim%40%23123@...arbitrage_bot');
    
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    console.error('Make sure you\'re using the correct master username and password');
    await pool.end();
    process.exit(1);
  }
}

setupDatabase();
