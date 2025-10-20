// ===== frontend/src/api/receipts.js =====
// 領収書API クライアント

import { apiClient, getFullUrl } from './config.js';

export const receiptsApi = {
  /**
   * 領収書をアップロード
   * @param {number} facilityId - 施設ID
   * @param {File[]} files - 領収書ファイル配列
   * @param {string} month - 対象月 (YYYY-MM形式)
   * @param {number} [sessionId] - 既存のセッションID（オプション）
   * @returns {Promise<Object>} アップロード結果
   */
  async upload(facilityId, files, month, sessionId = null) {
    const formData = new FormData();

    formData.append('facilityId', facilityId.toString());
    formData.append('month', month);

    if (sessionId) {
      formData.append('sessionId', sessionId.toString());
    }

    // 複数ファイルを追加
    files.forEach(file => {
      formData.append('receipts', file);
    });

    const response = await apiClient.post('/receipts/upload', formData);

    // URLを完全なURLに変換
    if (response.files) {
      response.files = response.files.map(file => ({
        ...file,
        url: getFullUrl(file.url)
      }));
    }

    return response;
  },

  /**
   * 施設の領収書一覧を取得
   * @param {number} facilityId - 施設ID
   * @param {string} [month] - 対象月 (YYYY-MM形式、省略可)
   * @returns {Promise<Object[]>} 領収書一覧
   */
  async getList(facilityId, month = null) {
    const endpoint = month
      ? `/receipts/${facilityId}?month=${month}`
      : `/receipts/${facilityId}`;

    const receipts = await apiClient.get(endpoint);

    // URLを完全なURLに変換
    return receipts.map(receipt => ({
      ...receipt,
      url: getFullUrl(receipt.url)
    }));
  },

  /**
   * 領収書を削除
   * @param {number} receiptId - 領収書ID
   * @returns {Promise<Object>} 削除結果
   */
  async delete(receiptId) {
    return await apiClient.delete(`/receipts/${receiptId}`);
  }
};
