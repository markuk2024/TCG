const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

// Migration runner
const runMigrations = async () => {
  try {
    console.log('🚀 Starting database migration...\n');
    
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split into individual statements
    const statements = schema.split(';').filter(s => s.trim().length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim() + ';';
      
      // Skip empty statements and comments
      if (!statement || statement.startsWith('--')) continue;
      
      try {
        await query(statement);
        process.stdout.write(`✅ Statement ${i + 1}/${statements.length}\r`);
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key')) {
          process.stdout.write(`⏭️  Statement ${i + 1}/${statements.length} (skipped)\r`);
        } else {
          console.error(`\n❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
    
    console.log(`\n\n✅ Migration completed successfully!`);
    console.log('\n📊 Database tables created:');
    const tables = [
      'users',
      'user_balances',
      'breaks',
      'break_spots',
      'vault_items',
      'fractional_shares',
      'user_shares',
      'marketplace_listings',
      'staking_positions',
      'staking_rewards',
      'user_staking_rewards',
      'payments',
      'treasury_transactions',
      'token_buybacks',
      'activity_logs',
      'audit_logs'
    ];
    
    tables.forEach(table => console.log(`   • ${table}`));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
