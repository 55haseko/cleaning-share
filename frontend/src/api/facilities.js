// ===== frontend/src/api/facilities.js =====
// 施設関連API

export const facilitiesApi = {
  // 施設一覧取得
  async getList() {
    return await apiClient.get('/facilities');
  },

  // 施設作成（管理者のみ）
  async create(facilityData) {
    return await apiClient.post('/facilities', facilityData);
  },

  // 施設更新（管理者のみ）
  async update(facilityId, facilityData) {
    return await apiClient.put(`/facilities/${facilityId}`, facilityData);
  },

  // 施設削除（管理者のみ）
  async delete(facilityId) {
    return await apiClient.delete(`/facilities/${facilityId}`);
  }
};
