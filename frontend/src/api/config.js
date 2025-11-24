// ===== frontend/src/api/config.js =====
// API設定ファイル

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const BACKEND_BASE_URL = API_BASE_URL.replace('/api', ''); // http://localhost:8000

// APIクライアント設定
class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('authToken');
  }

  // トークンを設定
  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  // トークンをクリア
  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // HTTPリクエスト共通処理
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

    // FormDataの場合はContent-Typeを削除
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }

        // エラーレスポンスをパース（JSON or テキスト）
        let errorMessage = 'APIエラーが発生しました';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error || error.message || errorMessage;
          } else {
            // JSONでない場合はテキストとして読み取る
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
        } catch (parseError) {
          console.error('エラーレスポンスのパースに失敗:', parseError);
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // GET リクエスト
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST リクエスト
  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data)
    });
  }

  // PUT リクエスト
  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // DELETE リクエスト
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// シングルトンインスタンス
const apiClient = new ApiClient();

/**
 * バックエンドの相対URLを完全なURLに変換
 * @param {string} path - 相対パス（例: "/uploads/photos/..."）
 * @returns {string} - 完全なURL（例: "http://localhost:4000/uploads/photos/..."）
 */
const getFullUrl = (path) => {
  if (!path) return path;
  // すでに完全なURLの場合はそのまま返す
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // 相対パスの場合はバックエンドのベースURLと結合
  return `${BACKEND_BASE_URL}${path}`;
};

export { apiClient, getFullUrl };






// ===== フロントエンドApp.jsへの統合例 =====
// 既存のApp.jsに以下のように統合

/*
import { authApi, photosApi, facilitiesApi, sessionsApi, statsApi } from './api';

// ログイン処理の例
const handleLogin = async () => {
  try {
    const response = await authApi.login(email, password);
    setCurrentUser(response.user);
    // トークンは自動的に保存される
  } catch (error) {
    setError(error.message);
  }
};

// 写真アップロードの例
const handleUpload = async () => {
  try {
    const response = await photosApi.upload(
      selectedFacility.id,
      [...beforePhotos, ...afterPhotos],
      'before', // or 'after'
      sessionId
    );
    setUploadComplete(true);
  } catch (error) {
    setError(error.message);
  }
};

// 施設一覧取得の例
useEffect(() => {
  const fetchFacilities = async () => {
    try {
      const facilities = await facilitiesApi.getList();
      setUserFacilities(facilities);
    } catch (error) {
      console.error('施設取得エラー:', error);
    }
  };
  
  if (currentUser) {
    fetchFacilities();
  }
}, [currentUser]);
*/