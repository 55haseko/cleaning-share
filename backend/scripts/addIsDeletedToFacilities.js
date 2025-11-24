// マイグレーションスクリプト: facilitiesテーブルに is_deleted カラムを追加
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'cleaning_system'
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // is_deleted カラムが既に存在するかチェック
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'facilities' AND COLUMN_NAME = 'is_deleted'
    `);

    if (columns.length > 0) {
      console.log('is_deleted カラムは既に存在します');
      return;
    }

    // is_deleted カラムを追加
    await connection.execute(`
      ALTER TABLE facilities
      ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      ADD INDEX idx_is_deleted (is_deleted)
    `);

    console.log('✓ facilitiesテーブルに is_deleted カラムを追加しました');

  } catch (error) {
    console.error('マイグレーションエラー:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate().then(() => {
  console.log('マイグレーション完了');
  process.exit(0);
});
