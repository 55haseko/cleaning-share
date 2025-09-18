// ===== frontend/src/api/sessions.js =====
// 清掃セッション関連API

export const sessionsApi = {
  // セッション作成/更新
  async createOrUpdate(sessionData) {
    return await apiClient.post('/sessions', sessionData);
  },

  // 月次チェック更新
  async updateMonthlyCheck(sessionId, checkData) {
    return await apiClient.put(`/sessions/${sessionId}/monthly-check`, checkData);
  }
};
