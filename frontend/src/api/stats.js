// ===== frontend/src/api/stats.js =====
// 統計関連API

export const statsApi = {
  // 日次統計（管理者のみ）
  async getDaily() {
    return await apiClient.get('/stats/daily');
  },

  // 月次統計（管理者のみ）
  async getMonthly(yearMonth) {
    return await apiClient.get(`/stats/monthly/${yearMonth}`);
  }
};
