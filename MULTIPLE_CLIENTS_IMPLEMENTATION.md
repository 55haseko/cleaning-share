# 複数クライアント対応実装ガイド

## 概要
このドキュメントは、施設に複数のクライアントを割り当てられる機能の実装内容をまとめています。

## 実装の概要

### 1. データベース設計の変更

#### 新しいテーブル: `facility_clients`
```sql
CREATE TABLE facility_clients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  facility_id INT NOT NULL,
  client_user_id INT NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP NULL,
  UNIQUE KEY unique_facility_client (facility_id, client_user_id),
  CONSTRAINT fk_fc_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_fc_client FOREIGN KEY (client_user_id) REFERENCES users(id),
  INDEX idx_fc_facility (facility_id),
  INDEX idx_fc_client (client_user_id)
);
```

**特徴:**
- **1施設 = 複数クライアント** に対応（多対多関係）
- `removed_at` による論理削除で削除履歴を保持
- `assigned_at` でクライアント割当日時を記録

#### 既存テーブル: `facilities`
- `client_user_id` カラムは**後方互換性のため残す**
- 新規割当は `facility_clients` テーブルで管理
- マイグレーション時に既存の `client_user_id` を `facility_clients` に移行

### 2. マイグレーション処理

**ファイル:** `backend/scripts/migrateToMultipleClients.js`

実行方法:
```bash
npm run migrate:multi-clients
```

処理内容:
1. 既存の `facilities.client_user_id` を `facility_clients` テーブルに移行
2. 整合性チェック（クライアント割当のない施設を検出）
3. 複数クライアント割当の確認

### 3. バックエンド API 変更

#### 修正されたエンドポイント

##### `GET /api/facilities` (クライアント用)
```javascript
// 修正前: SELECT * FROM facilities WHERE client_user_id = ?
// 修正後: SELECT DISTINCT f.* FROM facilities f
//        INNER JOIN facility_clients fc ON f.id = fc.facility_id
//        WHERE fc.client_user_id = ? AND fc.removed_at IS NULL
```

複数施設に対応。

##### `POST /api/facilities` (施設作成)
```javascript
// 新しいパラメータ:
{
  name: "施設名",
  address: "住所",
  client_user_id: 1,           // 後方互換性
  clientUserIds: [1, 2, 3]     // 複数クライアント（新）
}
```

#### 新規エンドポイント（複数クライアント管理用）

##### `GET /api/facilities/:facilityId/clients`
施設に割り当てられたクライアント一覧を取得

**レスポンス例:**
```json
[
  {
    "id": 1,
    "email": "client1@example.com",
    "name": "クライアント A",
    "assigned_at": "2025-11-26T00:00:00Z"
  },
  {
    "id": 2,
    "email": "client2@example.com",
    "name": "クライアント B",
    "assigned_at": "2025-11-26T01:30:00Z"
  }
]
```

##### `POST /api/facilities/:facilityId/clients`
クライアントを施設に割り当てる

**リクエスト:**
```json
{
  "clientUserId": 3
}
```

**バリデーション:**
- クライアントが既に割り当てられていないか確認
- クライアントロールであるか確認

##### `DELETE /api/facilities/:facilityId/clients/:clientUserId`
クライアントを施設から削除（論理削除）

**バリデーション:**
- 施設に最低1人のクライアントが残るか確認（削除不可な場合は 400 エラー）

### 4. フロントエンド実装

#### 新しいコンポーネント: `FacilityClientsManager`

**ファイル:** `frontend/src/components/FacilityClientsManager.js`

**機能:**
- 施設に割り当てられたクライアント一覧の表示
- クライアントの追加
- クライアントの削除（削除保護あり）

**使用例:**
```jsx
<FacilityClientsManager
  facilityId={facilityId}
  clientUsers={allClientUsers}
  onUpdate={() => {
    // 更新後の処理
  }}
/>
```

#### AdminDashboard 修正

- `FacilityClientsManager` を施設編集フォーム内に統合
- 施設を編集する際、割り当てクライアントを直感的に管理可能

#### ClientDashboard 対応

- 既に複数施設選択に対応済み
- クライアントがログイン後、割り当てられた複数施設から選択可能

#### API ラッパー修正

**ファイル:** `frontend/src/api/facilities.js`

新規メソッド:
```javascript
facilitiesApi.getClients(facilityId)        // クライアント一覧取得
facilitiesApi.addClient(facilityId, clientUserId)      // クライアント追加
facilitiesApi.removeClient(facilityId, clientUserId)   // クライアント削除
```

### 5. 権限チェックの統一

**`GET /api/facilities` の権限判定:**

| ロール | アクセス範囲 |
|--------|-------------|
| **admin** | 全施設 |
| **client** | `facility_clients` で割り当てられた施設のみ |
| **staff** | 全施設 |

### 6. データ移行パス

```
既存データ
  ↓
[facilities.client_user_id]
  ↓
マイグレーション実行
  ↓
[facility_clients テーブルに移行]
  ↓
新しいAPI（facility_clients 参照）を利用
```

### 7. 使用方法（管理者）

#### 1. 複数クライアントを施設に割り当てる

**管理者ダッシュボード** → **施設管理** → **施設を編集**

施設編集フォーム下部の「**📌 割当クライアント管理**」セクションで:
- 現在の割当クライアント一覧を表示
- ドロップダウンからクライアントを選択して「追加」ボタンを押す
- 割り当てられたクライアント横の「✕」ボタンで削除

#### 2. API 直接呼び出し（curl）

```bash
# 施設にクライアントを追加
curl -X POST http://localhost:8000/api/facilities/1/clients \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"clientUserId": 2}'

# 施設のクライアント一覧を取得
curl -X GET http://localhost:8000/api/facilities/1/clients \
  -H "Authorization: Bearer {token}"

# 施設からクライアントを削除
curl -X DELETE http://localhost:8000/api/facilities/1/clients/2 \
  -H "Authorization: Bearer {token}"
```

### 8. 後方互換性

- `facilities.client_user_id` は**廃止されていない**（後方互換性のため）
- 施設作成時に `client_user_id` パラメータを渡すと、自動的に `facility_clients` にも記録される
- 既存のコードは引き続き動作

### 9. トラブルシューティング

#### Q: 「施設には最低1人のクライアントが必要です」エラーが出た
**A:** 施設には最低1人のクライアントが割り当てられている必要があります。複数クライアントを割り当てた後に削除してください。

#### Q: 既存施設のクライアントが見つからない
**A:** マイグレーション実行が必要です。`npm run migrate:multi-clients` を実行してください。

#### Q: クライアントが他人の施設を見られる
**A:** バックエンド API で権限チェックを実施しています。`facility_clients` テーブルで確認し、権限を再割り当てしてください。

### 10. 今後の拡張予定

- [ ] クライアント削除時の自動割当解除
- [ ] 複数クライアント割当時のメール通知
- [ ] クライアント権限の粒度化（読み取り専用など）
- [ ] 監査ログの追加（誰が何を割り当てたか記録）

---

## テスト チェックリスト

### バックエンド
- [ ] マイグレーションスクリプトが正常に実行される
- [ ] 既存のクライアント割当が facility_clients に移行される
- [ ] `GET /api/facilities` でクライアント用に複数施設が返される
- [ ] `POST /api/facilities/:facilityId/clients` で新規割当が可能
- [ ] `DELETE /api/facilities/:facilityId/clients/:clientUserId` で削除保護が動作
- [ ] 権限チェックが正しく機能

### フロントエンド
- [ ] AdminDashboard で FacilityClientsManager が表示される
- [ ] クライアント追加が正常に動作
- [ ] クライアント削除が正常に動作
- [ ] ClientDashboard で複数施設が選択可能

---

**実装日:** 2025-11-26
**バージョン:** 1.0.0
