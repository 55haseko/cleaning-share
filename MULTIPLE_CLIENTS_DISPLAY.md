# 複数クライアント表示機能 - 実装ガイド

**実装日:** 2025-11-26
**機能:** 施設管理画面で複数のクライアントを全員表示

## 概要

施設管理画面の施設一覧において、複数のクライアントが割り当てられている場合に、すべてのクライアントを表示するように修正しました。

以前は `facilities.client_user_id`（単一クライアント）のみを表示していましたが、現在は `facility_clients` テーブルから全クライアントを取得して表示します。

---

## 実装内容

### 1. バックエンド修正

**ファイル:** `backend/server.js` (Lines 721-765)

#### 修正内容

`GET /api/facilities` エンドポイントを修正し、各施設に割り当てられたすべてのクライアント情報を含める。

```javascript
// 修正前
const [facilities] = await pool.execute(query, params);
res.json(facilities);

// 修正後
const [facilities] = await pool.execute(query, params);

// 各施設のクライアント情報を追加（複数クライアント対応）
const facilitiesWithClients = await Promise.all(
  facilities.map(async (facility) => {
    const [clients] = await pool.execute(
      `SELECT u.id, u.email, u.name
       FROM facility_clients fc
       INNER JOIN users u ON fc.client_user_id = u.id
       WHERE fc.facility_id = ? AND fc.removed_at IS NULL
       ORDER BY u.name`,
      [facility.id]
    );
    return {
      ...facility,
      clients: clients || []
    };
  })
);

res.json(facilitiesWithClients);
```

#### 返却データ例

```json
[
  {
    "id": 1,
    "name": "施設A",
    "address": "東京都...",
    "client_user_id": 1,
    "clients": [
      {
        "id": 1,
        "name": "クライアント太郎",
        "email": "taro@example.com"
      },
      {
        "id": 2,
        "name": "クライアント花子",
        "email": "hanako@example.com"
      }
    ]
  }
]
```

### 2. フロントエンド修正

**ファイル:** `frontend/src/components/AdminDashboard.js` (Lines 685-724)

#### 施設カード表示の修正

複数クライアントをバッジ形式で表示：

```jsx
// 複数クライアント対応: facility.clients から割当クライアント一覧を取得
const facilityClients = facility.clients || [];

// 表示ロジック
{facilityClients.length > 0 ? (
  <div style={{ marginTop: '4px' }}>
    {facilityClients.map((client) => (
      <span key={client.id} style={{
        display: 'inline-block',
        marginRight: '6px',
        marginBottom: '4px',
        padding: '2px 8px',
        backgroundColor: '#e3f2fd',
        borderRadius: '4px',
        fontSize: '0.875rem'
      }}>
        {client.name}
      </span>
    ))}
  </div>
) : assignedClient ? (
  `${assignedClient.name}`  // 後方互換性
) : (
  '未割り当て'
)}
```

#### 表示パターン

| パターン | 表示内容 |
|---------|---------|
| **複数クライアント割当** | 各クライアント名をバッジで表示<br/>例: `クライアント太郎` `クライアント花子` |
| **単一クライアント割当** | 単一のテキスト表示<br/>例: `クライアント太郎` |
| **クライアント未割当** | `未割り当て` と表示 |

#### 視覚的なスタイリング

- **背景色:** ライトブルー (#e3f2fd)
- **パディング:** 2px 8px
- **フォントサイズ:** 0.875rem (14px)
- **丸み:** 4px border-radius
- **間隔:** 6px margin-right, 4px margin-bottom

---

## 動作フロー

```
管理者ダッシュボード
  ↓
[施設管理]タブをクリック
  ↓
GET /api/facilities (Admin用)
  ↓
Backend: 全施設を取得
  ↓
Backend: 各施設について facility_clients から全クライアントを取得
  ↓
Backend: facilities オブジェクトに clients 配列を追加
  ↓
Frontend: 施設カード表示
  ↓
  複数クライアント → バッジ表示
  単一クライアント → テキスト表示
  無し → 「未割り当て」表示
```

---

## 後方互換性

修正後も既存のコードとの互換性を保持しています：

1. **facilities.client_user_id** は引き続き使用可能
2. `facilities.clients` が空配列の場合、`client_user_id` を参照して表示
3. 古いクライアント（`client_user_id` のみ）でも表示可能

---

## テスト方法

### 1. 複数クライアント割当をテスト

1. **管理者ダッシュボード**にログイン
2. **施設管理**タブを開く
3. 任意の施設を編集
4. フォーム下部の **「📌 割当クライアント管理」** で複数クライアントを追加
5. フォームを保存
6. 施設一覧で複数クライアントがバッジで表示されることを確認

### 2. API 応答確認

```bash
# 施設一覧を取得（admin トークン使用）
curl -H "Authorization: Bearer {admin_token}" \
  http://localhost:8000/api/facilities | jq '.[0].clients'

# 出力例:
# [
#   { "id": 1, "name": "クライアント太郎", "email": "taro@example.com" },
#   { "id": 2, "name": "クライアント花子", "email": "hanako@example.com" }
# ]
```

### 3. ブラウザで確認

1. 管理者ダッシュボード → 施設管理
2. 複数クライアントが割り当てられた施設を確認
3. 「担当クライアント:」の下に複数のバッジが表示されることを確認

---

## パフォーマンス考慮事項

### データベースクエリ

現在の実装では、施設1件あたり1回のクエリで全クライアントを取得しています。

```javascript
// 施設が n 件ある場合の総クエリ数: n + 1
// 1. 施設一覧取得: 1回
// 2. 各施設のクライアント取得: n回
```

#### パフォーマンス最適化の検討（将来）

- `GROUP_CONCAT` を使用した単一クエリでの取得
- キャッシング機構の導入
- GraphQL への移行

---

## トラブルシューティング

### Q: 施設一覧が表示されない

**A:** ブラウザのコンソール（F12）でエラーを確認してください。
- バックエンドのログを確認: `pm2 logs cleaning-backend`
- API がクライアント情報を返しているか確認

### Q: クライアント情報が「未割り当て」と表示される

**A:** 以下を確認してください：
1. 施設編集時にクライアントが正しく割り当てられているか
2. `facility_clients` テーブルにレコードが存在するか
   ```sql
   SELECT * FROM facility_clients WHERE facility_id = {施設ID};
   ```
3. `removed_at` が NULL になっているか確認

### Q: 古いバージョンからの移行で表示されない

**A:** マイグレーションを実行してください：
```bash
npm run migrate:multi-clients
```

---

## 関連ドキュメント

- `MULTIPLE_CLIENTS_IMPLEMENTATION.md` - 複数クライアント対応の全体設計
- `IMPLEMENTATION_SUMMARY.md` - 実装サマリー
- `CLAUDE.md` - プロジェクト仕様書

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2025-11-26 | 複数クライアント表示機能を実装 |

---

**実装者:** Claude Code
