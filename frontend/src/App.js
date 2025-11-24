import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Calendar, Building, Download, Eye, Check, LogOut, AlertCircle, FileText } from 'lucide-react';
import { authApi } from './api/auth.js';
import { facilitiesApi } from './api/facilities.js';
import { albumsApi } from './api/albums.js';
import { receiptsApi } from './api/receipts.js';
import AdminDashboard from './components/AdminDashboard.js';
import StaffDashboardNew from './components/StaffDashboardNew.js';
import FacilitySelector from './components/FacilitySelector.js';
import ImageModal from './components/ImageModal.js';

// ログイン画面
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authApi.login(email, password);
      // レスポンスからユーザー情報を取得してonLoginに渡す
      onLogin(response.user);
    } catch (error) {
      setError(error.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
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
              placeholder="example@email.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      </div>
    </div>
  );
};

// 旧StaffDashboardコンポーネントは削除（StaffDashboardNewを使用）

// クライアント画面
const ClientDashboard = ({ user, onLogout }) => {
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('photos'); // 'photos' or 'receipts'

  const loadFacilities = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await facilitiesApi.getList();
      setFacilities(data);
    } catch (err) {
      setError('施設の読み込みに失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlbums = useCallback(async (facilityId) => {
    try {
      setAlbumsLoading(true);
      setError('');
      const data = await albumsApi.getByFacility(facilityId);
      setAlbums(data);
    } catch (err) {
      setError('清掃記録の読み込みに失敗しました: ' + err.message);
      setAlbums([]);
    } finally {
      setAlbumsLoading(false);
    }
  }, []);

  const loadReceipts = useCallback(async (facilityId) => {
    try {
      setReceiptsLoading(true);
      setError('');
      const data = await receiptsApi.getList(facilityId);
      setReceipts(data);
    } catch (err) {
      setError('領収書の読み込みに失敗しました: ' + err.message);
      setReceipts([]);
    } finally {
      setReceiptsLoading(false);
    }
  }, []);

  // アルバムの写真を一括ダウンロード
  const handleDownloadAlbum = async () => {
    if (!selectedAlbum || !selectedFacility) return;

    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
      const token = localStorage.getItem('authToken');

      const url = `${API_BASE_URL}/albums/${selectedFacility.id}/${selectedAlbum.id}/download`;
      console.log('ダウンロードURL:', url);
      console.log('facilityId:', selectedFacility.id, 'sessionId:', selectedAlbum.id);
      console.log('token:', token ? 'あり' : 'なし');

      // fetch APIでダウンロード
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ダウンロードエラー:', response.status, errorText);
        throw new Error(`ダウンロードに失敗しました (${response.status})`);
      }

      // Blobとしてデータを取得
      const blob = await response.blob();

      // Blobのサイズをチェック
      if (blob.size === 0) {
        throw new Error('ダウンロードしたファイルが空です');
      }

      // ファイル名を取得（Content-Dispositionヘッダーから）
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'photos.zip';
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = decodeURIComponent(matches[1].replace(/['"]/g, ''));
        }
      }

      // ダウンロードリンクを作成してクリック
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      console.log('ダウンロード成功:', filename, blob.size, 'bytes');
    } catch (err) {
      console.error('ダウンロードエラー:', err);
      setError('ダウンロードに失敗しました: ' + err.message);
    }
  };

  // 初期ロード：施設一覧を取得
  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  // 施設選択時：アルバムと領収書を取得
  useEffect(() => {
    if (selectedFacility) {
      loadAlbums(selectedFacility.id);
      loadReceipts(selectedFacility.id);
    }
  }, [selectedFacility, loadAlbums, loadReceipts]);

  // 画像クリック時のハンドラー
  const handlePhotoClick = (photo, allPhotos) => {
    const index = allPhotos.findIndex(p => p.id === photo.id);
    setCurrentPhotoIndex(index);
    setSelectedPhoto(allPhotos[index]);
  };

  // 前の画像へ
  const handlePreviousPhoto = () => {
    if (!selectedAlbum || !selectedAlbum.photos) return;
    const newIndex = currentPhotoIndex - 1;
    if (newIndex >= 0) {
      setCurrentPhotoIndex(newIndex);
      setSelectedPhoto(selectedAlbum.photos[newIndex]);
    }
  };

  // 次の画像へ
  const handleNextPhoto = () => {
    if (!selectedAlbum || !selectedAlbum.photos) return;
    const newIndex = currentPhotoIndex + 1;
    if (newIndex < selectedAlbum.photos.length) {
      setCurrentPhotoIndex(newIndex);
      setSelectedPhoto(selectedAlbum.photos[newIndex]);
    }
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setSelectedPhoto(null);
    setCurrentPhotoIndex(0);
  };

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
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* エラー表示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* 施設選択画面 */}
        {!selectedFacility ? (
          loading ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">施設を読み込み中...</p>
            </div>
          ) : (
            <FacilitySelector
              facilities={facilities}
              onSelect={setSelectedFacility}
              title="閲覧する施設を選択"
            />
          )
        ) : !selectedAlbum ? (
          /* アルバム・領収書一覧画面 */
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">{selectedFacility.name}</h2>
              <button
                onClick={() => {
                  setSelectedFacility(null);
                  setAlbums([]);
                  setReceipts([]);
                  setActiveTab('photos');
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                施設を変更
              </button>
            </div>

            {/* タブ切り替え */}
            <div className="mb-6 border-b border-gray-200">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('photos')}
                  className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
                    activeTab === 'photos'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    <span>清掃記録</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('receipts')}
                  className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
                    activeTab === 'receipts'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>領収書</span>
                  </div>
                </button>
              </div>
            </div>

            {/* タブコンテンツ */}
            {activeTab === 'photos' ? (
              albumsLoading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600">清掃記録を読み込み中...</p>
              </div>
            ) : albums.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">清掃記録がありません</h3>
                <p className="text-gray-600">この施設の清掃記録はまだ登録されていません。</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {albums.map(album => (
                  <button
                    key={album.id}
                    onClick={() => setSelectedAlbum(album)}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-gray-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">
                          {new Date(album.cleaning_date).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-600">
                            写真 {album.photo_count || album.photos?.length || 0}枚
                          </span>
                          {(album.ventilation_checked || album.air_filter_checked) && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              月次点検済
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Eye className="w-5 h-5 text-gray-400" />
                  </button>
                ))}
              </div>
            )
            ) : (
              /* 領収書タブ */
              receiptsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">領収書を読み込み中...</p>
                </div>
              ) : receipts.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">領収書がありません</h3>
                  <p className="text-gray-600">この施設の領収書はまだ登録されていません。</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 月別にグループ化して画像として表示 */}
                  {Object.entries(
                    receipts.reduce((acc, receipt) => {
                      const month = receipt.month;
                      if (!acc[month]) acc[month] = [];
                      acc[month].push(receipt);
                      return acc;
                    }, {})
                  )
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([month, monthReceipts]) => (
                      <div key={month}>
                        <h3 className="font-semibold text-gray-900 mb-3">
                          {new Date(month + '-01').toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long'
                          })}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {monthReceipts.map(receipt => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(receipt.original_name);
                            const isPDF = /\.pdf$/i.test(receipt.original_name);
                            return (
                              <div key={receipt.id} className="relative group">
                                {isImage ? (
                                  <img
                                    src={receipt.url}
                                    alt={receipt.original_name}
                                    onClick={() => window.open(receipt.url, '_blank')}
                                    className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  />
                                ) : isPDF ? (
                                  <div
                                    onClick={() => window.open(receipt.url, '_blank')}
                                    className="relative w-full h-32 rounded-lg overflow-hidden cursor-pointer"
                                  >
                                    <iframe
                                      src={`${receipt.url}#toolbar=0&navpanes=0&scrollbar=0`}
                                      className="w-full h-full border-none pointer-events-none"
                                      title={receipt.original_name}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-blue-600 bg-opacity-10 pointer-events-none">
                                      <div className="bg-black bg-opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
                                        📄 PDF
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <a
                                    href={receipt.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center justify-center w-full h-32 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                  >
                                    <FileText className="w-8 h-8 text-blue-600 mb-2" />
                                    <span className="text-xs text-gray-600 text-center px-2 truncate max-w-full">
                                      {receipt.original_name}
                                    </span>
                                  </a>
                                )}
                                <div className="absolute bottom-2 left-2 right-2">
                                  <div className="text-xs bg-black bg-opacity-50 text-white px-2 py-1 rounded truncate">
                                    {receipt.original_name}
                                  </div>
                                </div>
                                <div className="absolute top-2 right-2">
                                  <a
                                    href={receipt.url}
                                    download
                                    className="p-1 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Download className="w-4 h-4 text-white" />
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )
            )}
          </div>
        ) : (
          /* 写真詳細画面 */
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {new Date(selectedAlbum.cleaning_date).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h2>
                <p className="text-sm text-gray-600">{selectedFacility.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadAlbum}
                  className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                  title="写真を一括ダウンロード"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedAlbum(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  戻る
                </button>
              </div>
            </div>

            {(selectedAlbum.ventilation_checked || selectedAlbum.air_filter_checked) && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-900 mb-2">月次点検実施項目</p>
                <div className="flex gap-4">
                  {selectedAlbum.ventilation_checked && (
                    <span className="flex items-center gap-1 text-sm text-blue-700">
                      <Check className="w-4 h-4" /> 換気扇清掃
                    </span>
                  )}
                  {selectedAlbum.air_filter_checked && (
                    <span className="flex items-center gap-1 text-sm text-blue-700">
                      <Check className="w-4 h-4" /> エアコンフィルター
                    </span>
                  )}
                </div>
              </div>
            )}

            {selectedAlbum.photos && selectedAlbum.photos.length > 0 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">清掃前</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {selectedAlbum.photos.filter(p => p.type === 'before').map(photo => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.thumbnailUrl || photo.url}
                          alt="清掃前"
                          onClick={() => handlePhotoClick(photo, selectedAlbum.photos)}
                          className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        />
                        {photo.uploaded_at && (
                          <span className="absolute bottom-2 left-2 text-xs bg-black bg-opacity-50 text-white px-2 py-1 rounded">
                            {new Date(photo.uploaded_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-3">清掃後</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {selectedAlbum.photos.filter(p => p.type === 'after').map(photo => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.thumbnailUrl || photo.url}
                          alt="清掃後"
                          onClick={() => handlePhotoClick(photo, selectedAlbum.photos)}
                          className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        />
                        {photo.uploaded_at && (
                          <span className="absolute bottom-2 left-2 text-xs bg-black bg-opacity-50 text-white px-2 py-1 rounded">
                            {new Date(photo.uploaded_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Camera className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">写真がありません</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 画像モーダル */}
      {selectedPhoto && (
        <ImageModal
          photo={selectedPhoto}
          onClose={handleCloseModal}
          onPrevious={handlePreviousPhoto}
          onNext={handleNextPhoto}
          hasPrevious={currentPhotoIndex > 0}
          hasNext={selectedAlbum && selectedAlbum.photos && currentPhotoIndex < selectedAlbum.photos.length - 1}
        />
      )}
    </div>
  );
};

// 古いAdminDashboardコンポーネントを削除（新しいコンポーネントを使用）

// メインアプリコンポーネント
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 初期ロード時にトークンをチェック
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          // トークンが有効かチェック
          const isValid = await authApi.checkToken();
          if (isValid) {
            const userInfo = await authApi.getCurrentUser();
            setCurrentUser(userInfo.user);
          } else {
            // 無効なトークンを削除
            authApi.logout();
          }
        }
      } catch (error) {
        console.error('認証チェックエラー:', error);
        authApi.logout();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    authApi.logout();
    setCurrentUser(null);
  };

  // 初期ロード中
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  switch (currentUser.role) {
    case 'staff':
      return <StaffDashboardNew user={currentUser} onLogout={handleLogout} />;
    case 'client':
      return <ClientDashboard user={currentUser} onLogout={handleLogout} />;
    case 'admin':
      return <AdminDashboard currentUser={currentUser} onLogout={handleLogout} />;
    default:
      return <LoginScreen onLogin={handleLogin} />;
  }
}