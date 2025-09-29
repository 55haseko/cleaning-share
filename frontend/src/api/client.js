// frontend/src/api/client.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` })
      }
    };

    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          throw new Error('認証エラー');
        }
        const error = await response.json();
        throw new Error(error.error || 'APIエラーが発生しました');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data)
    });
  }
}

const apiClient = new ApiClient();

export const authApi = {
  async login(email, password) {
    const response = await apiClient.post('/auth/login', { email, password });
    if (response.token) {
      apiClient.setToken(response.token);
    }
    return response;
  },

  logout() {
    apiClient.clearToken();
  }
};

export default apiClient;