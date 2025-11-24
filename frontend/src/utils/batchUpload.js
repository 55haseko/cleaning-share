// ===== frontend/src/utils/batchUpload.js =====
// バッチアップロードユーティリティ

import { photosApi } from '../api/photos.js';

/**
 * 複数の写真をバッチでアップロードする
 * @param {number} facilityId - 施設ID
 * @param {File[]} photos - 写真ファイルの配列
 * @param {string} type - 写真タイプ ('before' | 'after')
 * @param {Object} options - オプション
 * @param {string} options.date - 清掃日付 (YYYY-MM-DD)
 * @param {string} options.sessionId - セッションID
 * @param {Function} options.onProgress - 進捗コールバック (uploaded, total, currentBatch, totalBatches)
 * @param {Function} options.onBatchComplete - バッチ完了コールバック (batchIndex, result)
 * @param {Function} options.onError - エラーコールバック (batchIndex, error)
 * @returns {Promise<Object>} アップロード結果
 */
export async function batchUploadPhotos(facilityId, photos, type, options = {}) {
  const BATCH_SIZE = 10;        // 10枚ずつアップロード
  const MAX_PARALLEL = 5;       // 最大5バッチを並列処理
  const MAX_RETRIES = 3;        // 最大3回リトライ
  const RETRY_DELAY_BASE = 1000; // リトライ遅延のベース時間（ミリ秒）

  const {
    date,
    sessionId: initialSessionId,
    onProgress,
    onBatchComplete,
    onError
  } = options;

  // バッチに分割
  const batches = [];
  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    batches.push({
      index: Math.floor(i / BATCH_SIZE),
      photos: photos.slice(i, i + BATCH_SIZE),
      startIndex: i,
      endIndex: Math.min(i + BATCH_SIZE, photos.length)
    });
  }

  console.log(`[バッチアップロード] 開始: ${photos.length}枚を${batches.length}バッチで処理`);
  const startTime = performance.now();

  let uploadedCount = 0;
  let sessionId = initialSessionId;
  const results = [];
  const errors = [];

  // 最初のバッチはシリアルに実行してsessionIdを確定（重要！）
  if (batches.length > 0 && !sessionId) {
    const firstBatch = batches[0];
    let retries = 0;

    while (retries < MAX_RETRIES) {
      try {
        console.log(`[バッチ${firstBatch.index + 1}/${batches.length}] アップロード開始（シリアル）: ${firstBatch.photos.length}枚`);

        const result = await photosApi.upload(
          facilityId,
          firstBatch.photos,
          type,
          { date, sessionId }
        );

        // セッションIDを取得して保持
        if (result.sessionId) {
          sessionId = result.sessionId;
          console.log(`[バッチ${firstBatch.index + 1}/${batches.length}] sessionId確定: ${sessionId}`);
        }

        console.log(`[バッチ${firstBatch.index + 1}/${batches.length}] 完了: ${result.files?.length || 0}枚`);

        // バッチ完了コールバック
        if (onBatchComplete) {
          onBatchComplete(firstBatch.index, result);
        }

        // 進捗更新
        uploadedCount += firstBatch.photos.length;
        if (onProgress) {
          onProgress(uploadedCount, photos.length, 1, batches.length);
        }

        results.push({
          batchIndex: firstBatch.index,
          success: true,
          result
        });

        break;  // 成功したのでループを抜ける

      } catch (error) {
        retries++;
        console.error(`[バッチ${firstBatch.index + 1}/${batches.length}] エラー (試行${retries}/${MAX_RETRIES}):`, error);

        if (retries >= MAX_RETRIES) {
          console.error(`[バッチ${firstBatch.index + 1}/${batches.length}] 失敗: リトライ上限に達しました`);

          if (onError) {
            onError(firstBatch.index, error);
          }

          errors.push({
            batchIndex: firstBatch.index,
            photos: firstBatch.photos,
            error
          });

          break;
        }

        const delay = RETRY_DELAY_BASE * Math.pow(2, retries - 1);
        console.log(`[バッチ${firstBatch.index + 1}/${batches.length}] ${delay}ms後にリトライします...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 2番目以降のバッチを並列処理グループに分割
  const remainingBatches = batches.slice(1);  // 最初のバッチをスキップ
  for (let i = 0; i < remainingBatches.length; i += MAX_PARALLEL) {
    const parallelBatches = remainingBatches.slice(i, Math.min(i + MAX_PARALLEL, remainingBatches.length));

    // 重要: 次のグループに進む前に、sessionIdが確定していることを確認
    if (!sessionId) {
      console.error(`[致命的エラー] sessionIdが未定義のまま並列処理に進もうとしています`);
      throw new Error('sessionIdが確定されていません。最初のバッチのアップロードに失敗した可能性があります。');
    }

    console.log(`[バッチアップロード] 並列グループ${Math.floor(i / MAX_PARALLEL) + 2}を開始（sessionId: ${sessionId}）`);

    // 並列バッチの処理（既に sessionId が確定している）
    const batchResults = await Promise.allSettled(
      parallelBatches.map(async (batch) => {
        let retries = 0;

        while (retries < MAX_RETRIES) {
          try {
            console.log(`[バッチ${batch.index + 1}/${batches.length}] アップロード開始（並列）: ${batch.photos.length}枚、sessionId: ${sessionId}`);

            const result = await photosApi.upload(
              facilityId,
              batch.photos,
              type,
              { date, sessionId }  // ← 確定されたsessionIdを使用
            );

            // sessionIdの再確認（異なるsessionIdが返ってきた場合は警告）
            if (result.sessionId && result.sessionId !== sessionId) {
              console.warn(`[警告] バッチ${batch.index + 1}が異なるsessionIdを返しました: ${result.sessionId} (期待値: ${sessionId})`);
              // 既に確定したsessionIdを使い続ける
            }

            console.log(`[バッチ${batch.index + 1}/${batches.length}] 完了: ${result.files?.length || 0}枚`);

            // バッチ完了コールバック
            if (onBatchComplete) {
              onBatchComplete(batch.index, result);
            }

            // 進捗更新
            uploadedCount += batch.photos.length;
            if (onProgress) {
              onProgress(uploadedCount, photos.length, batch.index + 1, batches.length);
            }

            return {
              batchIndex: batch.index,
              success: true,
              result
            };

          } catch (error) {
            retries++;
            console.error(`[バッチ${batch.index + 1}/${batches.length}] エラー (試行${retries}/${MAX_RETRIES}):`, error);

            if (retries >= MAX_RETRIES) {
              // 最大リトライ回数に達した場合
              console.error(`[バッチ${batch.index + 1}/${batches.length}] 失敗: リトライ上限に達しました`);

              if (onError) {
                onError(batch.index, error);
              }

              throw error;
            }

            // 指数バックオフでリトライ
            const delay = RETRY_DELAY_BASE * Math.pow(2, retries - 1);
            console.log(`[バッチ${batch.index + 1}/${batches.length}] ${delay}ms後にリトライします...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      })
    );

    // 結果を集計
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const batch = parallelBatches[index];
        errors.push({
          batchIndex: batch.index,
          photos: batch.photos,
          error: result.reason
        });
      }
    });

    // 次の並列グループ前に少し待機（サーバー負荷軽減）
    if (i + MAX_PARALLEL < remainingBatches.length) {
      console.log(`[バッチアップロード] 次の並列グループ前に待機中...（確定sessionId: ${sessionId}）`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const endTime = performance.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  // 最終結果
  const successCount = results.length;
  const failureCount = errors.length;
  const totalBatches = batches.length;

  console.log(`[バッチアップロード] 完了: ${totalTime}秒`);
  console.log(`[バッチアップロード] 成功: ${successCount}/${totalBatches}バッチ`);
  console.log(`[バッチアップロード] 失敗: ${failureCount}/${totalBatches}バッチ`);

  // 進捗を100%に更新
  if (onProgress) {
    onProgress(uploadedCount, photos.length, batches.length, batches.length);
  }

  return {
    success: failureCount === 0,
    totalPhotos: photos.length,
    uploadedPhotos: uploadedCount,
    successBatches: successCount,
    failedBatches: failureCount,
    totalBatches,
    sessionId,
    results,
    errors,
    duration: totalTime
  };
}

/**
 * バッチアップロードの進捗を計算
 * @param {number} uploadedCount - アップロード済み枚数
 * @param {number} totalCount - 総枚数
 * @returns {Object} 進捗情報
 */
export function calculateProgress(uploadedCount, totalCount) {
  const percentage = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;

  return {
    percentage,
    uploaded: uploadedCount,
    total: totalCount,
    remaining: totalCount - uploadedCount
  };
}

/**
 * エラーメッセージを生成
 * @param {Object} uploadResult - アップロード結果
 * @returns {string} エラーメッセージ
 */
export function generateErrorMessage(uploadResult) {
  if (!uploadResult || uploadResult.success) {
    return '';
  }

  const { failedBatches, errors } = uploadResult;

  if (failedBatches === 0) {
    return '';
  }

  if (failedBatches === 1) {
    return `${errors[0].photos.length}枚のアップロードに失敗しました。`;
  }

  const totalFailedPhotos = errors.reduce((sum, err) => sum + err.photos.length, 0);
  return `${failedBatches}バッチ（合計${totalFailedPhotos}枚）のアップロードに失敗しました。`;
}

/**
 * 失敗したバッチを再試行
 * @param {number} facilityId - 施設ID
 * @param {Array} failedErrors - 失敗したエラー配列
 * @param {string} type - 写真タイプ ('before' | 'after')
 * @param {Object} options - オプション
 * @returns {Promise<Object>} 再試行結果
 */
export async function retryFailedBatches(facilityId, failedErrors, type, options = {}) {
  console.log(`[再試行] ${failedErrors.length}バッチを再試行します`);

  const retryResults = [];
  const stillFailedErrors = [];

  for (const errorBatch of failedErrors) {
    try {
      const result = await batchUploadPhotos(
        facilityId,
        errorBatch.photos,
        type,
        {
          ...options,
          onProgress: (uploaded, total, currentBatch, totalBatches) => {
            if (options.onProgress) {
              options.onProgress(uploaded, total, currentBatch, totalBatches);
            }
          }
        }
      );

      if (result.success) {
        retryResults.push({
          batchIndex: errorBatch.batchIndex,
          success: true,
          result
        });
        console.log(`[再試行] バッチ${errorBatch.batchIndex + 1}が成功しました`);
      } else {
        stillFailedErrors.push(errorBatch);
        console.warn(`[再試行] バッチ${errorBatch.batchIndex + 1}が再び失敗しました`);
      }
    } catch (error) {
      stillFailedErrors.push(errorBatch);
      console.error(`[再試行] バッチ${errorBatch.batchIndex + 1}でエラー:`, error);
    }
  }

  return {
    success: stillFailedErrors.length === 0,
    retryCount: failedErrors.length,
    successCount: retryResults.length,
    failedCount: stillFailedErrors.length,
    retryResults,
    stillFailedErrors
  };
}
