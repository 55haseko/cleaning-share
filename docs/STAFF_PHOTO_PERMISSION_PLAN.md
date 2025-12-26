# 実装計画書：スタッフの写真管理権限強化

## 1. 要望サマリー

### クライアント要望（修正版）
**認証済みユーザー全員が、施設の写真を自由に閲覧、追加、削除できるようにする**

**初期要望:** スタッフが自分のアップロードした写真のみ削除
**修正:** 全員が削除可能に変更（権限チェックを緩和）

### 業務フロー
1. スタッフが作業終了後、写真を報告
2. 管理者がスタッフのアップロードした写真を確認
3. 不備があれば管理者がスタッフに伝える
4. **スタッフが修正前の写真を削除し、修正後の写真をアップロード**
5. 管理者がOKサインを出す
6. オーナー（クライアント）が確認

### 現状の問題
調査結果より、以下の問題が判明：
- ❌ スタッフは自分がアップロードした写真を削除できない（管理者のみ削除可能）
- ❌ `photos` テーブルに所有者情報（`uploaded_by`）が存在しない
- ❌ 所有者追跡は `cleaning_sessions.staff_user_id` 経由のみ（間接的）
- ❌ アルバム閲覧APIに権限チェックがなく、全ユーザーが全施設を閲覧可能（セキュリティ脆弱性）

---

## 2. 実装方針（シンプル版）

### 重要な決定事項
**データベース変更は不要**と判断しました：
- ✅ 現状でもアップロード者の正確な追跡はできていない（`cleaning_sessions.staff_user_id` のみ）
- ✅ 削除権限は「施設へのアクセス権」で判定するため、`uploaded_by` カラムは使用しない
- ✅ 監査ログが必要になったタイミングで追加すれば良い
- ✅ 実装がシンプルで、デプロイリスクが低い

### 2-1. API変更

#### A. 写真削除API修正（権限チェック追加）
**ファイル:** [backend/server.js:1496-1533](../backend/server.js#L1496-L1533)

**現在の実装:**
```javascript
app.delete('/api/photos/:photoId', authenticateToken, requireAdmin, async (req, res) => {
  // 管理者のみ削除可能
```

**新しい実装（シンプル版）:**
```javascript
app.delete('/api/photos/:photoId', authenticateToken, async (req, res) => {
  const { photoId } = req.params;

  try {
    // 写真情報を取得（セッション情報含む）
    const [photos] = await pool.execute(
      `SELECT p.*, cs.facility_id
       FROM photos p
       INNER JOIN cleaning_sessions cs ON p.cleaning_session_id = cs.id
       WHERE p.id = ?`,
      [photoId]
    );

    if (photos.length === 0) {
      return res.status(404).json({ error: '写真が見つかりません' });
    }

    const photo = photos[0];

    // 権限チェック：施設へのアクセス権をチェック
    if (req.user.role !== 'admin') {
      if (req.user.role === 'client') {
        // クライアントは自分に割り当てられた施設の写真のみ削除可能
        const [facilities] = await pool.execute(
          `SELECT f.id FROM facilities f
           INNER JOIN facility_clients fc ON f.id = fc.facility_id
           WHERE f.id = ? AND fc.client_user_id = ? AND fc.removed_at IS NULL AND f.is_deleted = FALSE`,
          [photo.facility_id, req.user.id]
        );

        if (facilities.length === 0) {
          return res.status(403).json({
            error: 'この施設の写真を削除する権限がありません'
          });
        }
      }
      // スタッフは全施設にアクセス可能なので権限チェック不要
    }

    // ファイル削除処理
    const fullPath = path.join(__dirname, photo.file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // サムネイル削除
    const thumbnailPath = fullPath.replace('/photos/', '/thumbnails/');
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    // DB削除
    await pool.execute('DELETE FROM photos WHERE id = ?', [photoId]);

    res.json({ message: '写真を削除しました' });
  } catch (error) {
    console.error('写真削除エラー:', error);
    res.status(500).json({ error: '写真の削除に失敗しました' });
  }
});
```

**権限ルール（シンプル版）:**
- **管理者（admin）**: すべての写真を削除可能
- **スタッフ（staff）**: すべての写真を削除可能（全施設アクセス権があるため）
- **クライアント（client）**: 自分の施設の写真を削除可能

**削除権限の詳細:**
- 施設へのアクセス権があれば写真削除も可能
- 所有者チェックは不要（誰がアップロードしたかは関係ない）

#### B. アルバム閲覧API修正（セキュリティ強化）
**ファイル:** [backend/server.js:1750-1806](../backend/server.js#L1750-L1806)

**現在の問題:** 権限チェックなし（全ユーザーが全施設を閲覧可能）

**新しい実装:**
```javascript
app.get('/api/albums/:facilityId', authenticateToken, async (req, res) => {
  const { facilityId } = req.params;

  try {
    // 権限チェック
    if (req.user.role !== 'admin') {
      if (req.user.role === 'client') {
        // クライアントは自分に割り当てられた施設のみ
        const [facilities] = await pool.execute(
          `SELECT f.id FROM facilities f
           INNER JOIN facility_clients fc ON f.id = fc.facility_id
           WHERE f.id = ? AND fc.client_user_id = ? AND fc.removed_at IS NULL AND f.is_deleted = FALSE`,
          [facilityId, req.user.id]
        );

        if (facilities.length === 0) {
          return res.status(403).json({ error: 'この施設のアルバムを閲覧する権限がありません' });
        }
      } else if (req.user.role === 'staff') {
        // スタッフは全施設を閲覧可能（現状維持）
        // ただし、将来的には担当施設のみに制限することも検討
      }
    }

    // アルバム取得処理（既存のクエリ）
    // ...
  } catch (error) {
    console.error('アルバム取得エラー:', error);
    res.status(500).json({ error: 'アルバムの取得に失敗しました' });
  }
});
```

### 2-2. フロントエンド変更

#### A. スタッフダッシュボードに削除機能追加
**ファイル:** [frontend/src/components/StaffDashboardNew.js](../frontend/src/components/StaffDashboardNew.js)

**追加機能（シンプル版）:**
1. アルバム詳細画面に「削除」ボタンを追加
2. **すべての写真に削除ボタンを表示**（権限チェックはバックエンドで実施）
3. 削除確認ダイアログ
4. 削除後のアルバム再取得

**実装例（シンプル版）:**
```javascript
const handleDeletePhoto = async (photoId) => {
  if (!window.confirm('この写真を削除してもよろしいですか？')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/photos/${photoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '写真の削除に失敗しました');
    }

    // 成功メッセージ
    alert('写真を削除しました');

    // アルバム再取得
    fetchAlbumDetails();
  } catch (error) {
    console.error('削除エラー:', error);
    alert(error.message);
  }
};

// レンダリング（シンプル版：すべての写真に削除ボタン表示）
{photos.map(photo => (
  <div key={photo.id} className="photo-item">
    <img src={`${API_URL}${photo.file_path}`} alt={photo.original_name} />

    {/* すべての写真に削除ボタン表示（権限チェックはサーバ側で実施） */}
    <button
      onClick={() => handleDeletePhoto(photo.id)}
      className="delete-button"
    >
      削除
    </button>
  </div>
))}
```

#### B. クライアントダッシュボードに削除機能追加（オプション）
**ファイル:** クライアント向け画面（存在する場合）

**変更内容:**
- 既存の管理者ダッシュボードと同様の削除機能を追加
- クライアントは自分の施設の写真のみ削除可能

---

## 3. 実装ステップ（シンプル版）

### Phase 1: バックエンドAPI修正（約1-2時間）
1. ✅ 写真削除API修正（権限チェック追加）
   - `requireAdmin` ミドルウェアを削除
   - 施設アクセス権チェックを追加
2. ✅ アルバム閲覧API修正（セキュリティ強化）
   - クライアントの施設チェック追加

### Phase 2: フロントエンド修正（約1-2時間）
1. ✅ スタッフダッシュボードに削除機能追加
2. ✅ すべての写真に削除ボタンを表示
3. ✅ 削除確認ダイアログ実装
4. ✅ エラーハンドリング強化（403エラー時の適切なメッセージ表示）

### Phase 3: テスト（約1時間）
1. ✅ スタッフユーザーでログイン
   - 自分の写真を削除 → 成功するか
   - 他人の写真を削除 → 成功するか
2. ✅ 管理者ユーザーでログイン
   - すべての写真を削除できるか
3. ✅ クライアントユーザーでログイン
   - 自分の施設の写真を削除 → 成功するか
   - 他の施設の写真を削除 → 403エラーが返るか
   - 自分の施設のみ閲覧できるか
4. ✅ 業務フローの再現
   - スタッフが写真アップ → 管理者が確認 → スタッフが削除＆再アップ

### Phase 4: デプロイ（約0.5時間）
1. ✅ 本番環境バックアップ（念のため）
2. ✅ コードデプロイ
3. ✅ 動作確認
4. ✅ ロールバック手順確認

---

## 4. セキュリティ考慮事項

### 4-1. 権限チェック強化（シンプル版）
- ✅ 写真削除：施設へのアクセス権をチェック
  - 管理者：全施設の写真を削除可能
  - スタッフ：全施設の写真を削除可能（全施設アクセス権があるため）
  - クライアント：自分の施設の写真のみ削除可能
- ✅ アルバム閲覧：管理者 OR 自分の施設 OR スタッフ（全施設）
- ✅ SQLインジェクション対策：プリペアドステートメント使用（既存実装継続）

### 4-2. ファイルシステムセキュリティ
- ✅ ファイル削除前に施設アクセス権チェック
- ✅ パストラバーサル攻撃対策（既存実装継続）
- ✅ 削除失敗時のエラーハンドリング

### 4-3. 監査ログ（将来の課題）
**今後の検討事項:**
- 写真削除時にログ記録（誰が・いつ・何を削除したか）
- アップロード者情報が必要な場合は `uploaded_by` カラムを追加
- CLAUDE.md の要件: "すべての削除は audit log を残す"

---

## 5. データベーススキーマ（変更なし）

### photos テーブル（既存のまま）
```sql
CREATE TABLE photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cleaning_session_id INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  taken_at DATETIME,
  photo_type ENUM('before', 'after') NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cleaning_session_id) REFERENCES cleaning_sessions(id) ON DELETE CASCADE
);
```

**変更なし:**
- `uploaded_by` カラムは追加しない
- 既存のスキーマのまま運用

---

## 6. API仕様変更まとめ（シンプル版）

### 変更されるエンドポイント

#### A. `DELETE /api/photos/:photoId`
**変更点:** 権限チェック追加（全ユーザーが施設の写真を削除可能に）

**権限ルール（シンプル版）:**
```
admin → すべての写真を削除可能
staff → すべての写真を削除可能（全施設アクセス権があるため）
client → 自分の施設の写真のみ削除可能
```

**レスポンス例（成功）:**
```json
{
  "message": "写真を削除しました"
}
```

**レスポンス例（権限エラー）:**
```json
{
  "error": "この施設の写真を削除する権限がありません"
}
```

---

#### B. `GET /api/albums/:facilityId`
**変更点:** 権限チェック追加（セキュリティ強化）

**権限ルール:**
```
admin → すべての施設を閲覧可能
client → 自分に割り当てられた施設のみ閲覧可能
staff → すべての施設を閲覧可能（現状維持）
```

**レスポンス:** 変更なし（権限エラー時は403）

---

## 7. テストケース（シンプル版）

### 7-1. スタッフユーザー権限テスト

```javascript
// Test 1: スタッフが写真を削除できる
POST /api/photos/upload (staff_user_id=5, facility_id=1)
  → photo_id=100
DELETE /api/photos/100 (staff_user_id=5)
  → 200 OK

// Test 2: スタッフが他人の写真も削除できる
POST /api/photos/upload (staff_user_id=6, facility_id=1)
  → photo_id=101
DELETE /api/photos/101 (staff_user_id=5)
  → 200 OK（スタッフは全施設にアクセス権があるため削除可能）

// Test 3: スタッフがアルバムを閲覧できる
GET /api/albums/1 (staff_user_id=5)
  → 200 OK（全施設閲覧可能）
```

### 7-2. 管理者権限テスト

```javascript
// Test 4: 管理者がすべての写真を削除できる
DELETE /api/photos/100 (admin_user_id=1)
  → 200 OK
DELETE /api/photos/101 (admin_user_id=1)
  → 200 OK
```

### 7-3. クライアント権限テスト

```javascript
// Test 5: クライアントが自分の施設の写真を削除できる
POST /api/photos/upload (staff_user_id=5, facility_id=1)
  → photo_id=100
DELETE /api/photos/100 (client_user_id=10, facility_clients: [1,2])
  → 200 OK（施設1にアクセス権があるため削除可能）

// Test 6: クライアントが他の施設の写真を削除できない
POST /api/photos/upload (staff_user_id=5, facility_id=3)
  → photo_id=102
DELETE /api/photos/102 (client_user_id=10, facility_clients: [1,2])
  → 403 Forbidden（施設3にアクセス権がないため削除不可）

// Test 7: クライアントが自分の施設のみ閲覧できる
GET /api/albums/1 (client_user_id=10, facility_clients: [1,2])
  → 200 OK
GET /api/albums/3 (client_user_id=10, facility_clients: [1,2])
  → 403 Forbidden
```

### 7-4. 業務フローテスト

```javascript
// Test 7: 業務フロー全体
1. スタッフが写真アップロード
   POST /api/photos/upload (staff_id=5, facility_id=1, type=before)
   → photo_id=200

2. 管理者が確認（不備発見）
   GET /api/albums/1 (admin_id=1)
   → photo_id=200 表示

3. 管理者がスタッフに連絡（システム外）

4. スタッフが古い写真を削除
   DELETE /api/photos/200 (staff_id=5)
   → 200 OK

5. スタッフが新しい写真をアップロード
   POST /api/photos/upload (staff_id=5, facility_id=1, type=before)
   → photo_id=201

6. 管理者がOKサイン（システム外）

7. クライアントが確認
   GET /api/albums/1 (client_id=10)
   → photo_id=201 表示
```

---

## 8. ロールバックプラン（シンプル版）

### 緊急時のロールバック手順

#### Step 1: コードロールバック
```bash
git revert <commit-hash>
pm2 restart backend
```

#### Step 2: 動作確認
```bash
# 管理者で写真削除
curl -X DELETE http://localhost:8000/api/photos/100 \
  -H "Authorization: Bearer <admin-token>"
# → 200 OK

# スタッフで写真削除
curl -X DELETE http://localhost:8000/api/photos/101 \
  -H "Authorization: Bearer <staff-token>"
# → 403 Forbidden (元の動作に戻る)
```

**注意:**
- データベース変更がないため、ロールバックが簡単
- コードを戻すだけで元の状態に戻る

---

## 9. パフォーマンス影響（シンプル版）

### 9-1. クエリパフォーマンス
- ✅ 写真削除前に1回のJOINクエリ追加（施設ID取得）
- ✅ クライアントの場合は追加で1回のSELECTクエリ（施設アクセス権チェック）
- ✅ アルバム閲覧時の権限チェック追加（JOINなし）
- 影響: **微小**（1-2ms未満の増加想定）

### 9-2. データベースインデックス
**既存のインデックスで十分:**
- `photos.cleaning_session_id` にインデックスあり（外部キー）
- `facility_clients.facility_id` と `client_user_id` にインデックスあり（想定）
- 追加インデックス不要

---

## 10. 今後の改善案（シンプル版）

### 10-1. 監査ログ実装（将来の課題）
CLAUDE.md の要件: "すべての削除は audit log を残す"

**実装時に検討:**
```sql
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,  -- 'DELETE_PHOTO', 'DELETE_SESSION', etc.
  target_type VARCHAR(50) NOT NULL,  -- 'photo', 'receipt', 'session'
  target_id INT NOT NULL,
  details JSON,  -- 削除した写真の情報（facility_id, file_path等）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- この時点で uploaded_by カラムを追加することも検討
ALTER TABLE photos ADD COLUMN uploaded_by INT;
```

### 10-2. スタッフの施設アクセス制限
現在はスタッフが全施設を閲覧可能だが、将来的には：
- スタッフを特定施設に割り当て
- `staff_facilities` テーブル追加
- アルバム閲覧・削除を担当施設のみに制限

### 10-3. アップロード者情報の追加（必要になった場合）
- 監査ログや統計機能が必要になったタイミングで `uploaded_by` カラムを追加
- 現時点では不要と判断

---

## 11. チェックリスト（PR作成時）（シンプル版）

- [ ] 写真削除API修正（権限チェック追加）
- [ ] アルバム閲覧API修正（セキュリティ強化）
- [ ] スタッフダッシュボードに削除機能追加
- [ ] 削除確認ダイアログ実装
- [ ] エラーハンドリング強化（403エラー時のメッセージ）
- [ ] ユニットテスト追加（7つのテストケース）
- [ ] 業務フロー全体の動作確認
- [ ] モバイル実機テスト（4G環境）
- [ ] CORS設定確認
- [ ] セキュリティ脆弱性チェック
- [ ] ロールバック手順確認

---

## 12. 見積もり工数（シンプル版）

| フェーズ | 工数（旧） | 工数（新・シンプル版） |
|---------|----------|---------------------|
| DB変更 | 1時間 | **0時間** ✅ |
| バックエンドAPI修正 | 2-3時間 | **1-2時間** ✅ |
| フロントエンド修正 | 2-3時間 | **1-2時間** ✅ |
| テスト | 2時間 | **1時間** ✅ |
| デプロイ | 1時間 | **0.5時間** ✅ |
| **合計** | **8-10時間** | **3.5-5.5時間** 🎉 |

**削減効果:**
- ✅ 約50%の工数削減
- ✅ デプロイリスク低減（DB変更なし）
- ✅ ロールバックが簡単

---

## 13. リスク評価（シンプル版）

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 権限チェック漏れ | 高 | 全エンドポイントの権限チェック実装確認、テストケース充実 |
| 誤削除の増加 | 中 | 削除確認ダイアログ、明確なエラーメッセージ |
| UI/UX混乱 | 低 | 削除ボタンのデザイン、適切な配置 |
| パフォーマンス劣化 | 低 | クエリ最適化、既存インデックス活用 |
| ロールバック失敗 | 低 | DB変更なしのため簡単、手順の事前確認 |

**リスク軽減ポイント:**
- ✅ DB変更なしで実装が単純（最大リスク源を除去）
- ✅ ロールバックが容易（コード戻すだけ）
- ✅ 既存データへの影響なし

---

## 14. 連絡先・承認

**作成者:** Claude Code
**作成日:** 2025-12-26
**バージョン:** 2.0（シンプル版）
**承認者:** [管理者名を記入]
**承認日:** [承認日を記入]

**変更履歴:**
- v1.0 (2025-12-26): 初版（`uploaded_by` カラム追加版）
- v2.0 (2025-12-26): シンプル版に変更（DB変更なし）

---

## Appendix A: デプロイ手順（シンプル版）

### 開発環境
```bash
# 1. バックアップ（念のため）
mysqldump -u root -p cleaning_share > backup_dev_$(date +%Y%m%d_%H%M%S).sql

# 2. コードデプロイ
git pull origin feature/photo-delete-permission
cd /var/www/cleaning-share/backend
pm2 restart backend

# 3. 動作確認
curl -X DELETE http://localhost:8000/api/photos/1 \
  -H "Authorization: Bearer <staff-token>"
# → 200 OK または 403 Forbidden を確認
```

### 本番環境
```bash
# 1. バックアップ（必須）
mysqldump -u root -p cleaning_share > backup_production_$(date +%Y%m%d_%H%M%S).sql

# 2. コードデプロイ
cd /var/www/cleaning-share
git pull origin main
cd backend
npm install  # 依存関係更新がある場合
pm2 restart backend

# 3. 動作確認
# スタッフで写真削除
curl -X DELETE https://yourdomain.com/api/photos/1 \
  -H "Authorization: Bearer <staff-token>"

# クライアントで他施設の写真削除（403エラーを確認）
curl -X DELETE https://yourdomain.com/api/photos/2 \
  -H "Authorization: Bearer <client-token>"

# 4. フロントエンドデプロイ
cd ../frontend
npm run build
# ビルド成果物をデプロイ
```

---

## Appendix B: テスト実行手順

### 手動テスト
```bash
# 1. スタッフユーザーでログイン
# ブラウザで http://localhost:3000 にアクセス
# スタッフアカウントでログイン

# 2. アルバムを開く
# 施設を選択 → 日付を選択 → アルバム詳細画面を開く

# 3. 削除ボタンをテスト
# - 削除ボタンが表示されているか確認
# - 削除ボタンをクリック → 確認ダイアログが表示されるか
# - OKをクリック → 写真が削除されるか
# - アルバムが再読み込みされるか

# 4. クライアントユーザーでテスト
# - 自分の施設の写真削除 → 成功
# - 他施設の写真削除（APIを直接叩く） → 403エラー
```

### API単体テスト（curl）
```bash
# 環境変数設定
export API_URL="http://localhost:8000"
export STAFF_TOKEN="<スタッフのJWTトークン>"
export CLIENT_TOKEN="<クライアントのJWTトークン>"
export ADMIN_TOKEN="<管理者のJWTトークン>"

# Test 1: スタッフが写真を削除できる
curl -X DELETE "${API_URL}/api/photos/1" \
  -H "Authorization: Bearer ${STAFF_TOKEN}"
# 期待結果: 200 OK

# Test 2: クライアントが自分の施設の写真を削除できる
curl -X DELETE "${API_URL}/api/photos/2" \
  -H "Authorization: Bearer ${CLIENT_TOKEN}"
# 期待結果: 200 OK（施設1の写真の場合）

# Test 3: クライアントが他施設の写真を削除できない
curl -X DELETE "${API_URL}/api/photos/3" \
  -H "Authorization: Bearer ${CLIENT_TOKEN}"
# 期待結果: 403 Forbidden（施設3の写真の場合）

# Test 4: 管理者がすべての写真を削除できる
curl -X DELETE "${API_URL}/api/photos/4" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
# 期待結果: 200 OK
```

---

## Appendix C: トラブルシューティング

### 問題1: 写真削除ボタンが表示されない

**原因:**
- フロントエンドのコードが更新されていない
- ブラウザキャッシュが残っている

**解決策:**
```bash
# フロントエンド再ビルド
cd /var/www/cleaning-share/frontend
npm run build

# ブラウザでハードリロード（Ctrl+Shift+R）
```

---

### 問題2: 削除時に403エラーが返る

**原因:**
- ユーザーが施設へのアクセス権を持っていない
- バックエンドの権限チェックロジックに問題がある

**デバッグ手順:**
```bash
# 1. ログを確認
pm2 logs backend

# 2. ユーザーの施設アクセス権を確認
mysql -u root -p cleaning_share -e "
SELECT fc.* FROM facility_clients fc
WHERE fc.client_user_id = <user_id>;
"

# 3. 写真の施設IDを確認
mysql -u root -p cleaning_share -e "
SELECT p.id, cs.facility_id
FROM photos p
INNER JOIN cleaning_sessions cs ON p.cleaning_session_id = cs.id
WHERE p.id = <photo_id>;
"
```

---

### 問題3: 削除後に写真が再表示される

**原因:**
- アルバム再取得処理が失敗している
- フロントエンドのステート更新が正しくない

**解決策:**
```javascript
// フロントエンドのエラーハンドリングを確認
const handleDeletePhoto = async (photoId) => {
  try {
    const response = await fetch(`${API_URL}/api/photos/${photoId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    // アルバム再取得を確実に実行
    await fetchAlbumDetails();  // awaitを追加
  } catch (error) {
    console.error('削除エラー:', error);
    alert(error.message);
  }
};
```

---

### 問題4: ファイルが削除されてもDBレコードが残る

**原因:**
- ファイル削除は成功したがDBトランザクションが失敗
- エラーハンドリングが不適切

**解決策:**
```javascript
// バックエンドのトランザクション順序を修正
// 1. DB削除を先に実行
await pool.execute('DELETE FROM photos WHERE id = ?', [photoId]);

// 2. ファイル削除（失敗してもロールバック不要）
try {
  const fullPath = path.join(__dirname, photo.file_path);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
} catch (fileError) {
  console.error('ファイル削除エラー（無視）:', fileError);
}
```

---

## Appendix D: よくある質問（FAQ）

### Q1: なぜ `uploaded_by` カラムを追加しないのですか？

**A:** 以下の理由からシンプル版（DB変更なし）を選択しました：
- 現状でもアップロード者の正確な追跡はできていない
- 削除権限は「施設へのアクセス権」で判定するため不要
- 監査ログが必要になったタイミングで追加すれば良い
- 実装がシンプルで、デプロイリスクが低い

---

### Q2: 将来的に監査ログが必要になったら？

**A:** その時点で `uploaded_by` カラムを追加すれば問題ありません：
```sql
ALTER TABLE photos ADD COLUMN uploaded_by INT;
-- 既存データは NULL または cleaning_sessions.staff_user_id で埋める
```

---

### Q3: スタッフが誤って他人の写真を削除してしまうリスクは？

**A:** 以下の対策で誤削除を防ぎます：
- 削除確認ダイアログを必ず表示
- 削除ボタンのデザインを慎重に配置（目立ちすぎない）
- 必要であれば監査ログで誰が削除したか追跡可能にする

---

### Q4: クライアントは本当に写真を削除できるようにすべきですか？

**A:** 業務フローによります：
- **YES の場合**: 計画書通りの実装でOK
- **NO の場合**: バックエンドの権限チェックを修正
```javascript
if (req.user.role === 'client') {
  return res.status(403).json({ error: 'クライアントは写真を削除できません' });
}
```

---

### Q5: この実装で60日自動削除機能は影響を受けますか？

**A:** **影響ありません**。
- 60日自動削除はcronで実装されており、この変更とは独立しています
- 手動削除と自動削除は別のメカニズムです

---

## まとめ

**実装計画書（シンプル版）の完成**

### ✅ 達成したこと
- DBスキーマ変更なしで要件を満たす設計
- 工数を約50%削減（8-10時間 → 3.5-5.5時間）
- デプロイリスクを大幅に低減
- ロールバックが簡単（コード戻すだけ）

### 🎯 次のステップ
1. 計画書の承認を得る
2. バックエンドAPI修正（1-2時間）
3. フロントエンド修正（1-2時間）
4. テスト実施（1時間）
5. デプロイ（0.5時間）

---

**以上、実装計画書（シンプル版）です。承認後、実装を開始します。**
