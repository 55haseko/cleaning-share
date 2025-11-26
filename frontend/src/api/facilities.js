// ===== frontend/src/api/facilities.js =====
// 施設関連API

import { apiClient } from './config.js';

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
  },

  // ===== 複数クライアント対応API =====

  // 施設に割り当てられたクライアント一覧を取得
  async getClients(facilityId) {
    return await apiClient.get(`/facilities/${facilityId}/clients`);
  },

  // クライアントを施設に割り当てる
  async addClient(facilityId, clientUserId) {
    return await apiClient.post(`/facilities/${facilityId}/clients`, {
      clientUserId
    });
  },

  // クライアントを施設から削除
  async removeClient(facilityId, clientUserId) {
    return await apiClient.delete(`/facilities/${facilityId}/clients/${clientUserId}`);
  }
};
