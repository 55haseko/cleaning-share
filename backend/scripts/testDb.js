// backend/scripts/testDb.js
require('dotenv').config({ path: __dirname + '/../.env' });
const mysql = require('mysql2/promise');

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('✅ DB OK: Connected to', process.env.DB_NAME, 'as', process.env.DB_USER);
    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ DB NG:', err.message);
    process.exit(1);
  }
})();
