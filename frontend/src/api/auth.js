// ===== frontend/src/api/auth.js =====
// 認証関連API

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

  // トークン検証
  async verify() {
    return await apiClient.get('/auth/verify');
  }
};
