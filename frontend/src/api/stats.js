// ===== frontend/src/api/stats.js =====
// 統計関連API

import { apiClient } from './config.js';

export const statsApi = {
  // 日次統計（管理者のみ）
  async getDaily() {
    return await apiClient.get('/stats/daily');
  },

  // 最近のアップロード履歴（管理者のみ）
  async getRecentUploads(limit = 10) {
    return await apiClient.get(`/stats/recent-uploads?limit=${limit}`);
  },

  // 月次統計（管理者のみ）
  async getMonthly(yearMonth) {
    return await apiClient.get(`/stats/monthly/${yearMonth}`);
  }
};
