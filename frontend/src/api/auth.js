// ===== frontend/src/api/auth.js =====
// 認証関連API

import { apiClient } from './config.js';

export const authApi = {
  // ログイン
  async login(email, password) {
    const response = await apiClient.post('/auth/login', { email, password });
    if (response.token) {
      apiClient.setToken(response.token);
    }
    return response;
  },

  // ログアウト
  logout() {
    apiClient.clearToken();
  },

  // トークンの有効性チェック
  async checkToken() {
    try {
      // 保護されたエンドポイントにアクセスしてトークンの有効性を確認
      await apiClient.get('/auth/me');
      return true;
    } catch (error) {
      return false;
    }
  },

  // 現在のユーザー情報を取得
  async getCurrentUser() {
    return await apiClient.get('/auth/me');
  }
};
