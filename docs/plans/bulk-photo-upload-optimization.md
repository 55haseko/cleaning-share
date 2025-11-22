# 大量画像アップロード最適化プラン

**作成日:** 2025-11-22
**対象:** 清掃写真共有システム
**目的:** 200枚の大量画像アップロードを安定化・高速化する

---

## 目次

1. [現状の問題](#現状の問題)
2. [修正プラン](#修正プラン)
3. [実装優先順位](#実装優先順位)
4. [期待される効果](#期待される効果)
5. [技術詳細](#技術詳細)
6. [実装スケジュール](#実装スケジュール)

---

## 現状の問題

### 症状
- **15枚程度でもアプリがクラッシュ**することがある
- **200枚選択すると確実に落ちる**
- アップロード前のプレビュー表示に**長時間かかる**（10-30秒）
- プレビューが**正常に表示されない**ことがある

### 根本原因

#### 1. メモリ使用量の問題
**場所:** `frontend/src/components/PhotoSelector.js:59`

```javascript
// 問題のコード
const photosWithUrls = newPhotos.map(photo => ({
  ...photo,
  url: URL.createObjectURL(photo.file)  // 全画像を一度にメモリ展開
}));
```

**影響:**
- 200枚 × 平均5MB = **約1GB**のメモリ消費
- モバイルブラウザのメモリ上限（通常500MB-1GB）を超える
- → **クラッシュ**

#### 2. DOM描画の問題
**場所:** `frontend/src/components/PhotoSelector.js:221-274`

```javascript
// 問題のコード
{photos.map(photo => (
  <img src={photo.url} />  // 200個の<img>タグを同時レンダリング
))}
```

**影響:**
- 200枚の画像デコード処理が同時発生
- ブラウザのメインスレッドがブロック
- → **UIフリーズ**

#### 3. プレビュー表示の問題
- オリジナル画像をそのまま表示（4000px超の可能性）
- サムネイル生成なし
- → **表示遅延・メモリ圧迫**

#### 4. アップロード処理の問題
**場所:** `frontend/src/api/photos.js:25-27`

```javascript
// 問題のコード
photos.forEach(photo => {
  formData.append('photos', photo);  // 200枚を1つのFormDataに追加
});
```

**影響:**
- 1リクエストで数百MB〜数GBを送信
- サーバーのリクエストサイズ制限超過
- ネットワークタイムアウト
- → **アップロード失敗**

---

## 修正プラン

### フェーズ1: クライアント側の画像圧縮（最優先）

#### 1.1 ブラウザ内で画像を圧縮

**目的:** メモリ使用量を94%削減

**実装:**
- ライブラリ: [browser-image-compression](https://www.npmjs.com/package/browser-image-compression)
- 圧縮設定:
  - 長辺: 1600px
  - 品質: 0.8 (JPEG)
  - HEIC → JPEG 自動変換対応

**効果:**
```
Before: 5MB × 200枚 = 1,000MB (1GB)
After:  300KB × 200枚 = 60MB

削減率: 94%
```

**実装場所:**
- `frontend/src/components/PhotoSelector.js` の `handleFileSelect` 関数
- `frontend/src/utils/imageCompression.js` (新規作成)

**実装コード例:**
```javascript
import imageCompression from 'browser-image-compression';

async function compressImage(file) {
  const options = {
    maxSizeMB: 0.3,          // 300KB
    maxWidthOrHeight: 1600,  // 長辺1600px
    useWebWorker: true,      // Web Workerで並列処理
    fileType: 'image/jpeg'
  };

  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('圧縮エラー:', error);
    return file; // 失敗時は元ファイルを返す
  }
}
```

---

#### 1.2 遅延ローディング（Lazy Loading）

**目的:** 初期表示を80%高速化

**実装:**
- `IntersectionObserver` APIを使用
- 画面に表示される画像のみ読み込む
- スクロール時に段階的に読み込み

**効果:**
```
Before: 200枚すべてをメモリに展開
After:  画面上の20枚程度のみ展開

メモリ削減: 90%
初期表示時間: 10-30秒 → 2-3秒
```

**実装場所:**
- `frontend/src/components/PhotoSelector.js`
- `frontend/src/hooks/useLazyImage.js` (新規作成)

**実装コード例:**
```javascript
function useLazyImage(photo) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loaded) {
          setLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // 画面外100pxまで先読み
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [loaded]);

  return { imgRef, loaded };
}
```

---

### フェーズ2: バッチアップロード（並行処理）

#### 2.1 分割アップロード

**目的:** アップロード成功率を3倍以上向上（30% → 95%+）

**実装:**
- 10枚ずつバッチでアップロード
- 並列実行（最大5並列）
- 失敗時の自動リトライ（3回まで）

**効果:**
```
Before: 200枚を1リクエスト → タイムアウト
After:  10枚 × 20回（並列5） → 安定・高速
```

**実装場所:**
- `frontend/src/api/photos.js` の `upload` 関数を修正
- `frontend/src/components/StaffDashboardNew.js` の `handleUpload` 関数を修正
- `frontend/src/utils/batchUpload.js` (新規作成)

**実装コード例:**
```javascript
async function batchUpload(facilityId, photos, type, options = {}) {
  const BATCH_SIZE = 10;
  const MAX_PARALLEL = 5;
  const MAX_RETRIES = 3;

  const batches = [];
  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    batches.push(photos.slice(i, i + BATCH_SIZE));
  }

  const results = [];
  for (let i = 0; i < batches.length; i += MAX_PARALLEL) {
    const parallelBatches = batches.slice(i, i + MAX_PARALLEL);

    const batchResults = await Promise.allSettled(
      parallelBatches.map(async (batch, batchIndex) => {
        let retries = 0;
        while (retries < MAX_RETRIES) {
          try {
            return await photosApi.upload(facilityId, batch, type, options);
          } catch (error) {
            retries++;
            if (retries >= MAX_RETRIES) throw error;
            await new Promise(r => setTimeout(r, 1000 * retries)); // 指数バックオフ
          }
        }
      })
    );

    results.push(...batchResults);

    // 進捗通知
    const progress = Math.round(((i + parallelBatches.length) / batches.length) * 100);
    options.onProgress?.(progress);
  }

  return results;
}
```

---

### フェーズ3: UI/UXの改善

#### 3.1 仮想スクロール（Virtual Scrolling）

**目的:** レンダリングパフォーマンス向上

**実装:**
- ライブラリ: `react-window` または `react-virtualized`
- DOMノードを最小化（200個 → 20個程度）

**効果:**
```
Before: 200個の<img>タグをすべてレンダリング
After:  画面上の20個のみレンダリング

DOMノード削減: 90%
スクロール性能: スムーズに
```

**実装場所:**
- `frontend/src/components/PhotoSelector.js` のグリッド部分

**実装コード例:**
```javascript
import { FixedSizeGrid } from 'react-window';

function PhotoGrid({ photos, columnCount = 6, itemSize = 120 }) {
  const Cell = ({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * columnCount + columnIndex;
    if (index >= photos.length) return null;

    const photo = photos[index];
    return (
      <div style={style}>
        <img src={photo.url} alt="" />
      </div>
    );
  };

  return (
    <FixedSizeGrid
      columnCount={columnCount}
      columnWidth={itemSize}
      height={600}
      rowCount={Math.ceil(photos.length / columnCount)}
      rowHeight={itemSize}
      width="100%"
    >
      {Cell}
    </FixedSizeGrid>
  );
}
```

---

#### 3.2 プログレス表示の改善

**目的:** ユーザー体験向上（不安解消）

**実装:**
- 詳細な進捗情報を表示
- 失敗した画像の再試行UI

**表示内容:**
```
アップロード中: 50/200枚 (25%)
━━━━━━━━━━━━━━━━━━━━ 25%

✓ 完了: 48枚
⟳ 処理中: 10枚
✗ 失敗: 2枚 [再試行]

推定残り時間: 約3分
```

**実装場所:**
- `frontend/src/components/StaffDashboardNew.js` のプログレス表示部分
- `frontend/src/components/UploadProgress.js` (新規作成)

---

### フェーズ4: サーバー側の対応

#### 4.1 リクエストサイズ制限の調整

**実装場所:** `backend/src/server.js`

```javascript
// Before
app.use(express.json());

// After
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
```

#### 4.2 タイムアウト設定の延長

**実装場所:** `backend/src/server.js`

```javascript
// アップロード時間を考慮（10枚 × 2秒 = 20秒 + バッファ）
const server = app.listen(PORT);
server.timeout = 60000; // 60秒（バッチアップロードなので短めでOK）
```

#### 4.3 レート制限の調整

**実装場所:** `backend/src/middleware/rateLimit.js`

```javascript
// アップロードエンドポイントのレート制限を緩和
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 200, // 15分間に200リクエスト（20バッチ × 10リトライ想定）
  message: 'アップロードリクエストが多すぎます。しばらくお待ちください。'
});
```

---

## 実装優先順位

### 緊急対応（今すぐ実装） - Phase 1

| No | 対応項目 | ファイル | 工数 | 影響 |
|----|----------|----------|------|------|
| 1 | 画像圧縮 | `PhotoSelector.js`<br>`utils/imageCompression.js` (新規) | 4h | メモリクラッシュ防止 |
| 2 | バッチアップロード | `photos.js`<br>`StaffDashboardNew.js`<br>`utils/batchUpload.js` (新規) | 6h | タイムアウト・エラー防止 |
| 3 | サーバー設定調整 | `server.js`<br>`middleware/rateLimit.js` | 1h | リクエスト受け入れ |

**合計工数:** 11時間（1.5日）

---

### 重要（次に実装） - Phase 2

| No | 対応項目 | ファイル | 工数 | 影響 |
|----|----------|----------|------|------|
| 4 | 遅延ローディング | `PhotoSelector.js`<br>`hooks/useLazyImage.js` (新規) | 4h | 初期表示高速化 |
| 5 | エラーハンドリング強化 | `batchUpload.js`<br>`StaffDashboardNew.js` | 3h | 信頼性向上 |
| 6 | プログレス表示改善 | `StaffDashboardNew.js`<br>`components/UploadProgress.js` (新規) | 3h | UX向上 |

**合計工数:** 10時間（1.5日）

---

### 推奨（余裕があれば） - Phase 3

| No | 対応項目 | ファイル | 工数 | 影響 |
|----|----------|----------|------|------|
| 7 | 仮想スクロール | `PhotoSelector.js` | 6h | レンダリング性能向上 |
| 8 | オフライン対応 | `utils/uploadQueue.js` (新規)<br>`hooks/useUploadQueue.js` (新規) | 8h | ネットワーク不安定時の対応 |

**合計工数:** 14時間（2日）

---

## 期待される効果

### パフォーマンス改善

| 指標 | 改善前 | 改善後 | 改善率 |
|------|--------|--------|--------|
| **メモリ使用量** | ~1GB | ~60MB | **94%削減** |
| **初期表示時間** | 10-30秒 | 2-3秒 | **80%高速化** |
| **アップロード時間** | 60秒以上（失敗） | 30-40秒 | **安定化** |
| **アップロード成功率** | 30% | 95%+ | **3倍以上向上** |
| **クラッシュ率** | 頻発 | ほぼゼロ | **安定性大幅向上** |

### ユーザー体験改善

| 項目 | 改善前 | 改善後 |
|------|--------|--------|
| **操作感** | フリーズ・クラッシュ | スムーズ |
| **進捗確認** | 不明瞭 | 詳細表示 |
| **エラー回復** | 手動でやり直し | 自動リトライ |
| **ネットワーク** | 不安定で失敗 | 自動再送 |

---

## 技術詳細

### 使用ライブラリ

| ライブラリ | 用途 | バージョン | ライセンス |
|-----------|------|-----------|-----------|
| `browser-image-compression` | 画像圧縮 | ^2.0.2 | MIT |
| `react-window` | 仮想スクロール | ^1.8.10 | MIT |

### インストール

```bash
cd frontend
npm install browser-image-compression react-window
```

### メモリ使用量の計算

#### 改善前
```
オリジナル画像: 5MB × 200枚 = 1,000MB
ObjectURL展開: 1,000MB × 1.2倍 = 1,200MB
DOMメモリ: 200個 × 0.5MB = 100MB
---
合計: 約1,300MB (1.3GB)
```

#### 改善後
```
圧縮画像: 0.3MB × 200枚 = 60MB
遅延読み込み: 60MB ÷ 10 = 6MB (同時展開)
仮想スクロール: 20個 × 0.3MB = 6MB
---
合計: 約12MB
```

**削減率:** 99%削減（1,300MB → 12MB）

---

## 実装スケジュール

### Week 1: 緊急対応（Phase 1）

**Day 1-2:**
- [ ] 画像圧縮機能の実装
  - [ ] `utils/imageCompression.js` 作成
  - [ ] `PhotoSelector.js` に統合
  - [ ] テスト（10枚、50枚、100枚、200枚）
- [ ] バッチアップロード実装
  - [ ] `utils/batchUpload.js` 作成
  - [ ] `photos.js` API修正
  - [ ] `StaffDashboardNew.js` 統合

**Day 3:**
- [ ] サーバー側設定調整
  - [ ] `server.js` の設定変更
  - [ ] レート制限調整
- [ ] 統合テスト
  - [ ] 200枚アップロードの動作確認
  - [ ] エラーケースの確認

---

### Week 2: 重要対応（Phase 2）

**Day 4-5:**
- [ ] 遅延ローディング実装
  - [ ] `hooks/useLazyImage.js` 作成
  - [ ] `PhotoSelector.js` に統合
- [ ] エラーハンドリング強化
  - [ ] リトライロジック改善
  - [ ] エラー通知UI

**Day 6:**
- [ ] プログレス表示改善
  - [ ] `components/UploadProgress.js` 作成
  - [ ] 詳細進捗表示
- [ ] ユーザーテスト
  - [ ] 実機テスト（iPhone/Android）
  - [ ] 4G回線でのテスト

---

### Week 3: 推奨対応（Phase 3）

**Day 7-8:**
- [ ] 仮想スクロール実装
  - [ ] `react-window` 統合
  - [ ] グリッドレイアウト調整
- [ ] オフライン対応（オプション）
  - [ ] アップロードキュー実装
  - [ ] 再接続時の自動再開

**Day 9:**
- [ ] 最終テスト
- [ ] パフォーマンス計測
- [ ] ドキュメント更新

---

## テスト計画

### 単体テスト

```javascript
// utils/imageCompression.test.js
describe('imageCompression', () => {
  it('5MBの画像を300KB以下に圧縮できる', async () => {
    const file = createMockFile(5 * 1024 * 1024); // 5MB
    const compressed = await compressImage(file);
    expect(compressed.size).toBeLessThan(300 * 1024); // 300KB
  });
});

// utils/batchUpload.test.js
describe('batchUpload', () => {
  it('200枚を10枚ずつバッチでアップロードできる', async () => {
    const photos = createMockPhotos(200);
    const result = await batchUpload(1, photos, 'before');
    expect(result.length).toBe(20); // 20バッチ
  });

  it('失敗時に3回リトライする', async () => {
    mockApiFailure(2); // 最初2回失敗
    const photos = createMockPhotos(10);
    const result = await batchUpload(1, photos, 'before');
    expect(result[0].status).toBe('fulfilled');
  });
});
```

### 統合テスト

| テストケース | 期待結果 |
|-------------|---------|
| 200枚の画像を選択 | クラッシュせずプレビュー表示 |
| 200枚をアップロード | 成功率95%以上 |
| ネットワーク切断 → 再接続 | 自動再開 |
| 4G回線でのアップロード | 60秒以内に完了 |

### パフォーマンステスト

```javascript
// performance.test.js
describe('Performance', () => {
  it('200枚のプレビュー表示が5秒以内', async () => {
    const start = performance.now();
    await renderPhotoSelector(200);
    const end = performance.now();
    expect(end - start).toBeLessThan(5000);
  });

  it('メモリ使用量が100MB以下', async () => {
    await renderPhotoSelector(200);
    const memory = performance.memory.usedJSHeapSize;
    expect(memory).toBeLessThan(100 * 1024 * 1024);
  });
});
```

---

## リスクと対策

### リスク1: 圧縮による画質劣化

**影響:** ユーザーが画質低下に不満

**対策:**
- 圧縮前後のプレビューを表示
- 設定で圧縮品質を調整可能に（管理画面）
- 重要な写真は圧縮をスキップ（オプション）

### リスク2: バッチアップロードの複雑性

**影響:** 実装バグ・デバッグ困難

**対策:**
- 詳細なログ出力
- 各バッチの状態を追跡
- Sentry等でエラー監視

### リスク3: ブラウザ互換性

**影響:** 古いブラウザで動作しない

**対策:**
- Polyfillを追加（IntersectionObserver等）
- フォールバック処理（圧縮失敗時は元ファイル使用）
- サポート対象ブラウザを明記

---

## 関連ドキュメント

- [CLAUDE.md](../../CLAUDE.md) - プロジェクト要件
- [README.md](../../README.md) - システム概要
- [ARCHITECTURE.md](../ARCHITECTURE.md) - アーキテクチャ（作成予定）

---

## 変更履歴

| 日付 | 変更内容 | 担当 |
|------|---------|------|
| 2025-11-22 | 初版作成 | Claude |

---

## 承認

- [ ] 技術レビュー完了
- [ ] セキュリティレビュー完了
- [ ] 実装開始承認
