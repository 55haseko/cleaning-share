// ===== frontend/src/api/monthlyCheck.js =====
// 月次点検API クライアント

import { apiClient } from './config.js';

export const monthlyCheckApi = {
  /**
   * 月次点検を保存
   * @param {number} facilityId - 施設ID
   * @param {Object} checks - 点検項目 { ventilation: boolean, airFilter: boolean }
   * @param {number} [sessionId] - 既存のセッションID（オプション）
   * @returns {Promise<Object>} 保存結果
   */
  async save(facilityId, checks, sessionId = null) {
    const data = {
      facilityId,
      ventilation: checks.ventilation || false,
      airFilter: checks.airFilter || false
    };

    if (sessionId) {
      data.sessionId = sessionId;
    }

    return await apiClient.post('/monthly-checks/save', data);
  },

  /**
   * 施設の月次点検状態を取得
   * @param {number} facilityId - 施設ID
   * @param {string} [month] - 対象月 (YYYY-MM形式、省略可)
   * @returns {Promise<Object>} 月次点検状態
   */
  async getStatus(facilityId, month = null) {
    const endpoint = month
      ? `/monthly-checks/${facilityId}?month=${month}`
      : `/monthly-checks/${facilityId}`;

    return await apiClient.get(endpoint);
  }
};
