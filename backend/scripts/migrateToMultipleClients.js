// scripts/migrateToMultipleClients.js
// 既存の client_user_id をfacility_clients テーブルに移行するマイグレーションスクリプト

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'cleaning_system'
    });

    console.log('マイグレーション開始: client_user_id → facility_clients');

    // facility_clients テーブルが存在することを確認
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'facility_clients'"
    );

    if (tables.length === 0) {
      console.error('❌ facility_clients テーブルが存在しません');
      console.error('まず database_schema.sql を実行してください');
      process.exit(1);
    }

    // Step 1: 既存の client_user_id を facility_clients に移行
    console.log('\n📋 Step 1: 既存の施設-クライアント関連付けを移行中...');

    const [facilities] = await connection.execute(
      'SELECT id, client_user_id FROM facilities WHERE client_user_id IS NOT NULL'
    );

    let migratedCount = 0;
    for (const facility of facilities) {
      try {
        await connection.execute(
          'INSERT INTO facility_clients (facility_id, client_user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE removed_at = NULL',
          [facility.id, facility.client_user_id]
        );
        migratedCount++;
      } catch (error) {
        console.warn(`⚠️  施設ID ${facility.id} のクライアント移行に失敗: ${error.message}`);
      }
    }

    console.log(`✅ ${migratedCount} 件の施設-クライアント関連付けを移行完了`);

    // Step 2: facilities テーブルから client_user_id を削除（後方互換性のため一度は保持）
    console.log('\n📋 Step 2: 既存クライアント割当を確認中...');

    const [existingClients] = await connection.execute(
      'SELECT COUNT(*) as count FROM facility_clients WHERE removed_at IS NULL'
    );

    console.log(`✅ facility_clients テーブルに ${existingClients[0].count} 件の有効なクライアント割当を確認`);

    // Step 3: データベースの整合性チェック
    console.log('\n📋 Step 3: 整合性チェック中...');

    const [orphanFacilities] = await connection.execute(
      `SELECT f.id, f.name
       FROM facilities f
       LEFT JOIN facility_clients fc ON f.id = fc.facility_id AND fc.removed_at IS NULL
       WHERE fc.id IS NULL`
    );

    if (orphanFacilities.length > 0) {
      console.warn(`⚠️  クライアント割当のない施設が ${orphanFacilities.length} 件あります:`);
      orphanFacilities.forEach(f => {
        console.warn(`   - ID: ${f.id}, 名前: ${f.name}`);
      });
      console.log('   👉 これらの施設に対してクライアントを割り当ててください');
    } else {
      console.log('✅ すべての施設にクライアントが割り当てられています');
    }

    // Step 4: 複数クライアント割当の確認
    console.log('\n📋 Step 4: 複数クライアント割当を確認中...');

    const [multiClientFacilities] = await connection.execute(
      `SELECT facility_id, COUNT(*) as client_count
       FROM facility_clients
       WHERE removed_at IS NULL
       GROUP BY facility_id
       HAVING client_count > 1`
    );

    if (multiClientFacilities.length > 0) {
      console.log(`✅ ${multiClientFacilities.length} 件の施設に複数クライアントが割り当てられています`);
    } else {
      console.log('ℹ️  現在、複数クライアントが割り当てられた施設はありません');
    }

    console.log('\n✨ マイグレーション完了！');
    console.log('📌 注: facilities.client_user_id は後方互換性のため残していますが、');
    console.log('   今後は facility_clients テーブルを使用してください');

  } catch (error) {
    console.error('❌ マイグレーション中にエラーが発生しました:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
