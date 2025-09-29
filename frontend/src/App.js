import React, { useState, useEffect, useRef } from 'react';
import { Upload, Camera, Calendar, Users, Building, Download, Eye, Trash2, Plus, Check, X, AlertCircle, FileText, Filter, LogOut, Home, Image, Clock, User, Shield, BarChart3, ChevronRight, Search, Settings, Lock, Key } from 'lucide-react';

// API設定
const API_BASE_URL = 'http://localhost:3001/api';

// APIクライアント
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
        ...(this.token && { Authorization: `Bearer ${this.token}` })
      }
    };

    // FormDataの場合はContent-Typeを削除
    if (!(options.body instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          window.location.reload();
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

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
}

const apiClient = new ApiClient();

// ログイン画面
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      const response = await apiClient.post('/auth/login', { email, password });
      apiClient.setToken(response.token);
      onLogin(response.user);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">清掃管理システム</h1>
          <p className="text-gray-600 mt-2">ログインしてください</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="example@email.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">デモ用：初回起動時はデータベース初期化が必要です</p>
        </div>
      </div>
    </div>
  );
};

// パスワード変更モーダル
const PasswordChangeModal = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (newPassword !== confirmPassword) {
      setError('新しいパスワードが一致しません');
      return;
    }

    if (newPassword.length < 6) {
      setError('パスワードは6文字以上である必要があります');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess(false);
      }, 2000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">パスワード変更</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-green-600">パスワードを変更しました</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">現在のパスワード</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '変更中...' : '変更'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// スタッフ画面
const StaffDashboard = ({ user, onLogout }) => {
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [monthlyCheck, setMonthlyCheck] = useState({ ventilation: false, airFilter: false });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const fileInputRef = useRef(null);
  const [photoType, setPhotoType] = useState('before');
  const [error, setError] = useState('');
  const [uploadedCount, setUploadedCount] = useState({ before: 0, after: 0 });

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({
      id: Date.now() + Math.random(),
      url: URL.createObjectURL(file),
      file: file,
      type: photoType
    }));

    if (photoType === 'before') {
      setBeforePhotos([...beforePhotos, ...newPhotos]);
    } else {
      setAfterPhotos([...afterPhotos, ...newPhotos]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFacility || (beforePhotos.length === 0 && afterPhotos.length === 0)) {
      setError('施設を選択し、写真を追加してください');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      // セッションを作成
      const sessionResponse = await apiClient.post('/sessions', {
        facilityId: selectedFacility.id,
        ventilationChecked: monthlyCheck.ventilation,
        airFilterChecked: monthlyCheck.airFilter
      });

      const sessionId = sessionResponse.id;
      let uploadedBefore = 0;
      let uploadedAfter = 0;

      // 清掃前の写真をアップロード
      if (beforePhotos.length > 0) {
        const formData = new FormData();
        formData.append('facilityId', selectedFacility.id);
        formData.append('sessionId', sessionId);
        formData.append('type', 'before');
        beforePhotos.forEach(photo => {
          formData.append('photos', photo.file);
        });

        await apiClient.post('/photos/upload', formData);
        uploadedBefore = beforePhotos.length;
        setUploadProgress(50);
      }

      // 清掃後の写真をアップロード
      if (afterPhotos.length > 0) {
        const formData = new FormData();
        formData.append('facilityId', selectedFacility.id);
        formData.append('sessionId', sessionId);
        formData.append('type', 'after');
        afterPhotos.forEach(photo => {
          formData.append('photos', photo.file);
        });

        await apiClient.post('/photos/upload', formData);
        uploadedAfter = afterPhotos.length;
      }

      setUploadProgress(100);
      setUploadedCount({ before: uploadedBefore, after: uploadedAfter });
      setIsUploading(false);
      setUploadComplete(true);
    } catch (error) {
      setError(error.message);
      setIsUploading(false);
    }
  };

  const handleBackToHome = () => {
    setUploadComplete(false);
    setSelectedFacility(null);
    setBeforePhotos([]);
    setAfterPhotos([]);
    setMonthlyCheck({ ventilation: false, airFilter: false });
    setUploadedCount({ before: 0, after: 0 });
  };

  const removePhoto = (id, type) => {
    if (type === 'before') {
      setBeforePhotos(beforePhotos.filter(p => p.id !== id));
    } else {
      setAfterPhotos(afterPhotos.filter(p => p.id !== id));
    }
  };

  if (uploadComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">アップロード完了</h2>
          <div className="space-y-2 text-gray-600 mb-6">
            <p>{selectedFacility?.name}</p>
            <p>清掃前: {uploadedCount.before}枚</p>
            <p>清掃後: {uploadedCount.after}枚</p>
            {(monthlyCheck.ventilation || monthlyCheck.airFilter) && (
              <p className="text-blue-600 font-medium">月次点検実施済み</p>
            )}
          </div>
          <button
            onClick={handleBackToHome}
            className="flex items-center gap-2 mx-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">スタッフダッシュボード</h1>
                <p className="text-sm text-gray-600">{user.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="パスワード変更"
              >
                <Key className="w-5 h-5" />
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedFacility ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">施設を選択</h2>
            <div className="grid gap-3">
              {user.facilities?.map(facility => (
                <button
                  key={facility.id}
                  onClick={() => setSelectedFacility(facility)}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Building className="w-5 h-5 text-gray-400" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{facility.name}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedFacility.name}</h2>
                  <p className="text-sm text-gray-600">{new Date().toLocaleDateString('ja-JP')}</p>
                </div>
                <button
                  onClick={() => setSelectedFacility(null)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  施設を変更
                </button>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 text-red-600 px-4 py-2 rounded-lg">
                  {error}
                </div>
              )}

              {isUploading ? (
                <div className="py-8">
                  <div className="mb-4">
                    <p className="text-center text-gray-600 mb-2">アップロード中...</p>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-500">{uploadProgress}%</p>
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">清掃前の写真</h3>
                        <span className="text-sm text-gray-500">{beforePhotos.length}枚</span>
                      </div>
                      <div 
                        onClick={() => {
                          setPhotoType('before');
                          fileInputRef.current?.click();
                        }}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                      >
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">クリックまたはドラッグ＆ドロップ</p>
                      </div>
                      {beforePhotos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          {beforePhotos.map(photo => (
                            <div key={photo.id} className="relative group">
                              <img src={photo.url} alt="" className="w-full h-20 object-cover rounded" />
                              <button
                                onClick={() => removePhoto(photo.id, 'before')}
                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">清掃後の写真</h3>
                        <span className="text-sm text-gray-500">{afterPhotos.length}枚</span>
                      </div>
                      <div 
                        onClick={() => {
                          setPhotoType('after');
                          fileInputRef.current?.click();
                        }}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                      >
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">クリックまたはドラッグ＆ドロップ</p>
                      </div>
                      {afterPhotos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          {afterPhotos.map(photo => (
                            <div key={photo.id} className="relative group">
                              <img src={photo.url} alt="" className="w-full h-20 object-cover rounded" />
                              <button
                                onClick={() => removePhoto(photo.id, 'after')}
                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-3">月1回点検項目</h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={monthlyCheck.ventilation}
                          onChange={(e) => setMonthlyCheck({...monthlyCheck, ventilation: e.target.checked})}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-gray-700">換気扇清掃</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={monthlyCheck.airFilter}
                          onChange={(e) => setMonthlyCheck({...monthlyCheck, airFilter: e.target.checked})}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-gray-700">エアコンフィルター清掃</span>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleUpload}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors mt-6"
                  >
                    アップロード
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <PasswordChangeModal 
        isOpen={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)} 
      />
    </div>
  );
};

// ユーザー作成・編集モーダル
const UserModal = ({ isOpen, onClose, onSave, user = null, facilities = [] }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
    facilityIds: []
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        password: '',
        role: user.role || 'staff',
        facilityIds: user.facilities?.map(f => f.id) || []
      });
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'staff',
        facilityIds: []
      });
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || (!user && !formData.password)) {
      setError('必須項目を入力してください');
      return;
    }

    if (!user && formData.password.length < 6) {
      setError('パスワードは6文字以上である必要があります');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await onSave(formData);
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFacility = (facilityId) => {
    setFormData(prev => ({
      ...prev,
      facilityIds: prev.facilityIds.includes(facilityId)
        ? prev.facilityIds.filter(id => id !== facilityId)
        : [...prev.facilityIds, facilityId]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {user ? 'ユーザー編集' : '新規ユーザー作成'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名前 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">初期パスワード *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">6文字以上で設定してください</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="staff">スタッフ</option>
              <option value="client">クライアント</option>
              <option value="admin">管理者</option>
            </select>
          </div>

          {formData.role !== 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">担当施設</label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                {facilities.map(facility => (
                  <label key={facility.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.facilityIds.includes(facility.id)}
                      onChange={() => toggleFacility(facility.id)}
                      className="w-4 h-4 text-blue-600"
                      disabled={loading}
                    />
                    <span className="text-sm text-gray-700">{facility.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 管理者画面
const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'overview') {
        const statsData = await apiClient.get('/stats/daily');
        setStats(statsData);
      } else if (activeTab === 'users') {
        const usersData = await apiClient.get('/users');
        setUsers(usersData);
      } else if (activeTab === 'facilities') {
        const facilitiesData = await apiClient.get('/facilities');
        setFacilities(facilitiesData);
      }

      // 施設データは常に取得（ユーザー作成時に必要）
      if (facilities.length === 0) {
        const facilitiesData = await apiClient.get('/facilities');
        setFacilities(facilitiesData);
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData) => {
    await apiClient.post('/users', userData);
    await fetchData();
  };

  const handleUpdateUser = async (userData) => {
    await apiClient.put(`/users/${selectedUser.id}`, userData);
    await fetchData();
    setSelectedUser(null);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">管理者ダッシュボード</h1>
                <p className="text-sm text-gray-600">システム管理</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="パスワード変更"
              >
                <Key className="w-5 h-5" />
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                概要
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                ユーザー管理
              </button>
              <button
                onClick={() => setActiveTab('facilities')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'facilities'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                施設管理
              </button>
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-600">読み込み中...</p>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-6">今日の活動状況</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <Upload className="w-8 h-8 text-blue-600" />
                          <div>
                            <p className="text-2xl font-bold text-gray-900">
                              {stats?.uploads || 0}
                            </p>
                            <p className="text-sm text-gray-600">アップロード</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <Building className="w-8 h-8 text-green-600" />
                          <div>
                            <p className="text-2xl font-bold text-gray-900">
                              {stats?.facilities || 0}
                            </p>
                            <p className="text-sm text-gray-600">施設</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <Image className="w-8 h-8 text-purple-600" />
                          <div>
                            <p className="text-2xl font-bold text-gray-900">
                              {stats?.photos || 0}
                            </p>
                            <p className="text-sm text-gray-600">写真</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-lg font-bold text-gray-900">ユーザー一覧</h2>
                      <button 
                        onClick={() => {
                          setSelectedUser(null);
                          setShowUserModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        <Plus className="w-4 h-4" />
                        ユーザーを追加
                      </button>
                    </div>
                    <div className="space-y-3">
                      {users.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              user.role === 'admin' ? 'bg-purple-100' :
                              user.role === 'client' ? 'bg-green-100' : 'bg-blue-100'
                            }`}>
                              <User className={`w-5 h-5 ${
                                user.role === 'admin' ? 'text-purple-600' :
                                user.role === 'client' ? 'text-green-600' : 'text-blue-600'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.name}</p>
                              <p className="text-sm text-gray-600">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              user.role === 'client' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {user.role === 'admin' ? '管理者' : user.role === 'client' ? 'クライアント' : 'スタッフ'}
                            </span>
                            <button 
                              onClick={() => handleEditUser(user)}
                              className="p-2 text-gray-600 hover:text-gray-900"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'facilities' && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-lg font-bold text-gray-900">施設一覧</h2>
                      <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                        <Plus className="w-4 h-4" />
                        施設を追加
                      </button>
                    </div>
                    <div className="space-y-3">
                      {facilities.map(facility => (
                        <div key={facility.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{facility.name}</p>
                            <p className="text-sm text-gray-600">{facility.address}</p>
                          </div>
                          <button className="p-2 text-gray-600 hover:text-gray-900">
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <UserModal
        isOpen={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setSelectedUser(null);
        }}
        onSave={selectedUser ? handleUpdateUser : handleCreateUser}
        user={selectedUser}
        facilities={facilities}
      />

      <PasswordChangeModal 
        isOpen={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)} 
      />
    </div>
  );
};

// クライアント画面（省略 - 必要に応じて同様に実装）
const ClientDashboard = ({ user, onLogout }) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                <Building className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">クライアントダッシュボード</h1>
                <p className="text-sm text-gray-600">{user.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="p-2 text-gray-600 hover:text-gray-900"
                title="パスワード変更"
              >
                <Key className="w-5 h-5" />
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">清掃記録を確認</h2>
          <p className="text-gray-600">施設の清掃記録を確認できます。</p>
        </div>
      </main>

      <PasswordChangeModal 
        isOpen={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)} 
      />
    </div>
  );
};

// メインアプリコンポーネント
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // トークンの検証
    const verifyAuth = async () => {
      try {
        if (apiClient.token) {
          const response = await apiClient.get('/auth/verify');
          if (response.ok) {
            setCurrentUser(response.user);
          }
        }
      } catch (error) {
        apiClient.clearToken();
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    apiClient.clearToken();
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  switch (currentUser.role) {
    case 'staff':
      return <StaffDashboard user={currentUser} onLogout={handleLogout} />;
    case 'client':
      return <ClientDashboard user={currentUser} onLogout={handleLogout} />;
    case 'admin':
      return <AdminDashboard onLogout={handleLogout} />;
    default:
      return <LoginScreen onLogin={handleLogin} />;
  }
}