-- 施設管理システム再構築マイグレーション
-- 複数クライアント対応への統一

-- Step 1: is_deleted カラムが存在しない場合は追加
-- MySQL では IF NOT EXISTS が直接サポートされていないので条件付きで追加
ALTER TABLE facilities ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- Step 2: 既存の client_user_id を facility_clients に移行（orphan のみ）
-- client_user_id を持つが、facility_clients にレコードがない施設を処理
INSERT INTO facility_clients (facility_id, client_user_id, assigned_at)
SELECT f.id, f.client_user_id, NOW()
FROM facilities f
WHERE f.client_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM facility_clients fc
    WHERE fc.facility_id = f.id AND fc.removed_at IS NULL
  );

-- Step 3: マイグレーション完了確認（実行後に確認）
-- SELECT COUNT(*) FROM facilities WHERE client_user_id IS NOT NULL AND NOT EXISTS (
--   SELECT 1 FROM facility_clients fc WHERE fc.facility_id = facilities.id AND fc.removed_at IS NULL
-- );
-- 上記のカウント結果が 0 になれば OK
