// ===== frontend/src/utils/imageCompression.js =====
// 画像圧縮ユーティリティ

import imageCompression from 'browser-image-compression';

/**
 * 画像を圧縮する
 * @param {File} file - 元の画像ファイル
 * @param {Object} options - 圧縮オプション
 * @returns {Promise<File>} 圧縮後の画像ファイル
 */
export async function compressImage(file, options = {}) {
  // デフォルトの圧縮設定
  const defaultOptions = {
    maxSizeMB: 0.3,          // 最大300KB
    maxWidthOrHeight: 1600,  // 長辺1600px
    useWebWorker: true,      // Web Workerで並列処理（UIブロック防止）
    fileType: 'image/jpeg',  // JPEG形式で統一（HEIC対応）
    initialQuality: 0.8,     // 初期品質0.8
    alwaysKeepResolution: false  // 解像度を必要に応じて調整
  };

  const compressionOptions = { ...defaultOptions, ...options };

  try {
    console.log(`[圧縮] 開始: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    const compressedFile = await imageCompression(file, compressionOptions);

    console.log(`[圧縮] 完了: ${compressedFile.name} (${(compressedFile.size / 1024).toFixed(2)}KB)`);
    console.log(`[圧縮] 削減率: ${(((file.size - compressedFile.size) / file.size) * 100).toFixed(1)}%`);

    return compressedFile;
  } catch (error) {
    console.error(`[圧縮] エラー: ${file.name}`, error);

    // 圧縮失敗時は元のファイルを返す（フォールバック）
    console.warn(`[圧縮] フォールバック: 元ファイルを使用します`);
    return file;
  }
}

/**
 * 複数の画像を並列で圧縮する
 * @param {File[]} files - 画像ファイルの配列
 * @param {Function} onProgress - 進捗コールバック (current, total)
 * @param {Object} options - 圧縮オプション
 * @returns {Promise<File[]>} 圧縮後の画像ファイルの配列
 */
export async function compressImages(files, onProgress = null, options = {}) {
  const BATCH_SIZE = 5; // 5枚ずつ並列処理（メモリとCPU負荷のバランス）
  const compressedFiles = [];

  console.log(`[一括圧縮] 開始: ${files.length}枚の画像を圧縮します`);
  const startTime = performance.now();

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length));

    // バッチ内の画像を並列で圧縮
    const batchCompressed = await Promise.all(
      batch.map(file => compressImage(file, options))
    );

    compressedFiles.push(...batchCompressed);

    // 進捗通知
    if (onProgress) {
      onProgress(compressedFiles.length, files.length);
    }

    // UIの応答性を保つため、少し待機（次のバッチ前）
    if (i + BATCH_SIZE < files.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  const endTime = performance.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  // 統計情報
  const originalSize = files.reduce((sum, f) => sum + f.size, 0);
  const compressedSize = compressedFiles.reduce((sum, f) => sum + f.size, 0);
  const reductionRate = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

  console.log(`[一括圧縮] 完了: ${files.length}枚 (${totalTime}秒)`);
  console.log(`[一括圧縮] 元サイズ: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`[一括圧縮] 圧縮後: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`[一括圧縮] 削減率: ${reductionRate}%`);

  return compressedFiles;
}

/**
 * ファイルが画像かどうかを判定
 * @param {File} file - ファイル
 * @returns {boolean} 画像の場合true
 */
export function isImageFile(file) {
  return file && file.type && file.type.startsWith('image/');
}

/**
 * ファイルサイズを人間が読める形式に変換
 * @param {number} bytes - バイト数
 * @returns {string} フォーマットされた文字列
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
