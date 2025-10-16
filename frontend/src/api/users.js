// ===== frontend/src/api/users.js =====
// ユーザー管理API

import { apiClient } from './config.js';

export const usersApi = {
  // ユーザー一覧取得
  async getUsers() {
    return await apiClient.get('/users');
  },

  // ユーザー作成
  async createUser(userData) {
    return await apiClient.post('/users', userData);
  },

  // ユーザー更新
  async updateUser(userId, userData) {
    return await apiClient.put(`/users/${userId}`, userData);
  },

  // ユーザー削除
  async deleteUser(userId) {
    return await apiClient.delete(`/users/${userId}`);
  },

  // パスワードリセット
  async resetPassword(userId, newPassword) {
    return await apiClient.put(`/users/${userId}/reset-password`, {
      newPassword
    });
  },

  // 施設一覧取得（ユーザー作成時の選択肢用）
  async getFacilities() {
    return await apiClient.get('/facilities');
  }
};