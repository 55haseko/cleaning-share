// backend/src/storage/local.js - ローカルストレージヘルパー
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * ディレクトリを再帰的に作成
 * @param {string} dirPath - 作成するディレクトリパス
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * 写真保存パスを生成
 * @param {string} facilityId - 施設ID
 * @param {string} date - 日付 (YYYY-MM-DD)
 * @returns {string} 保存ディレクトリパス
 */
function photosPath(facilityId, date) {
  const storageRoot = process.env.STORAGE_ROOT || './uploads_dev';
  return path.join(storageRoot, 'photos', facilityId.toString(), date);
}

/**
 * 領収書保存パスを生成
 * @param {string} facilityId - 施設ID
 * @param {string} month - 月 (YYYY-MM)
 * @returns {string} 保存ディレクトリパス
 */
function receiptsPath(facilityId, month) {
  const storageRoot = process.env.STORAGE_ROOT || './uploads_dev';
  return path.join(storageRoot, 'receipts', facilityId.toString(), month);
}

/**
 * 安全なファイル名を生成
 * @param {string} originalName - 元のファイル名
 * @returns {string} 安全なファイル名
 */
function generateSafeFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}${ext}`;
}

/**
 * ファイルの公開URLを生成
 * @param {string} filePath - ファイルパス
 * @returns {string} 公開URL
 */
function publicUrlFrom(filePath) {
  const baseUrl = process.env.PUBLIC_BASE_URL;
  const storageRoot = process.env.STORAGE_ROOT || './uploads_dev';
  
  const relativePath = path.relative(storageRoot, filePath);
  
  if (baseUrl) {
    return new URL(relativePath, baseUrl).toString();
  }
  
  // PUBLIC_BASE_URL未設定時は相対URL
  return `/${relativePath}`;
}

/**
 * MIMEタイプと拡張子の二重チェック
 * @param {string} mimetype - MIMEタイプ
 * @param {string} filename - ファイル名
 * @param {string} type - ファイルタイプ ('photo' | 'receipt')
 * @returns {boolean} 有効かどうか
 */
function validateFileType(mimetype, filename, type) {
  const ext = path.extname(filename).toLowerCase();
  
  if (type === 'photo') {
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const validExts = ['.jpg', '.jpeg', '.png', '.webp'];
    return validMimes.includes(mimetype) && validExts.includes(ext);
  }
  
  if (type === 'receipt') {
    return mimetype === 'application/pdf' && ext === '.pdf';
  }
  
  return false;
}

module.exports = {
  ensureDir,
  photosPath,
  receiptsPath,
  generateSafeFilename,
  publicUrlFrom,
  validateFileType
};