import React, { useState, useEffect, useRef } from 'react';
import { Upload, Camera, Calendar, Building, Download, Eye, Check, X, LogOut, User } from 'lucide-react';
import { authApi } from './api/auth.js';
import { photosApi } from './api/photos.js';
import AdminDashboard from './components/AdminDashboard.js';
import StaffDashboardNew from './components/StaffDashboardNew.js';

// モックデータ
const mockUsers = [
  { id: 1, name: '山田太郎', role: 'staff', email: 'yamada@example.com', facilities: [1, 2] },
  { id: 2, name: '佐藤花子', role: 'staff', email: 'sato@example.com', facilities: [2, 3] },
  { id: 3, name: '株式会社ABC', role: 'client', email: 'abc@example.com', facilities: [1] },
  { id: 4, name: '株式会社XYZ', role: 'client', email: 'xyz@example.com', facilities: [2] },
  { id: 5, name: '管理者', role: 'admin', email: 'admin@example.com' }
];

const mockFacilities = [
  { id: 1, name: 'ABCビル 3F', client: '株式会社ABC', address: '東京都千代田区丸の内1-1-1', lastCleaning: '2025-01-07' },
  { id: 2, name: 'XYZオフィス', client: '株式会社XYZ', address: '東京都港区赤坂2-2-2', lastCleaning: '2025-01-06' },
  { id: 3, name: '渋谷センター', client: '株式会社DEF', address: '東京都渋谷区神南3-3-3', lastCleaning: '2025-01-05' },
  { id: 4, name: '新宿タワー 15F', client: '株式会社ABC', address: '東京都新宿区西新宿1-4-4', lastCleaning: '2025-01-04' },
  { id: 5, name: '品川イーストビル 8F', client: '有限会社HIJ', address: '東京都品川区東品川5-5-5', lastCleaning: '2025-01-03' },
  { id: 6, name: 'みなとみらいプラザ 20F', client: '株式会社XYZ', address: '神奈川県横浜市西区みなとみらい6-6-6', lastCleaning: '2025-01-02' },
  { id: 7, name: '大阪本社ビル 12F', client: '関西商事株式会社', address: '大阪府大阪市北区梅田7-7-7', lastCleaning: '2025-01-01' },
  { id: 8, name: '札幌支店', client: '北海道開発株式会社', address: '北海道札幌市中央区大通8-8-8', lastCleaning: '2024-12-31' },
  { id: 9, name: '福岡オフィス', client: '九州エンタープライズ', address: '福岡県福岡市博多区博多駅前9-9-9', lastCleaning: '2024-12-30' },
  { id: 10, name: 'ABCビル 5F', client: '株式会社ABC', address: '東京都千代田区丸の内1-1-1', lastCleaning: '2024-12-29' },
  { id: 11, name: 'ABCビル 7F', client: '株式会社ABC', address: '東京都千代田区丸の内1-1-1', lastCleaning: '2024-12-28' },
  { id: 12, name: '名古屋センタービル', client: '中部物産株式会社', address: '愛知県名古屋市中区栄12-12-12', lastCleaning: '2024-12-27' }
];

const mockAlbums = [
  { 
    id: 1, 
    facilityId: 1, 
    date: '2025-01-15', 
    photos: [
      { id: 1, url: '/api/placeholder/400/300', type: 'before', time: '09:00' },
      { id: 2, url: '/api/placeholder/400/300', type: 'before', time: '09:05' },
      { id: 3, url: '/api/placeholder/400/300', type: 'after', time: '11:30' },
      { id: 4, url: '/api/placeholder/400/300', type: 'after', time: '11:35' }
    ],
    monthlyCheck: { ventilation: true, airFilter: true },
    uploadedBy: '山田太郎'
  },
  { 
    id: 2, 
    facilityId: 1, 
    date: '2025-01-08', 
    photos: [
      { id: 5, url: '/api/placeholder/400/300', type: 'before', time: '09:15' },
      { id: 6, url: '/api/placeholder/400/300', type: 'after', time: '11:45' }
    ],
    uploadedBy: '山田太郎'
  }
];

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

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">デモ用アカウント:</p>
          <div className="mt-2 space-y-1 text-xs text-gray-500">
            <p>スタッフ: yamada@example.com</p>
            <p>クライアント: abc@example.com</p>
            <p>管理者: admin@example.com</p>
          </div>
        </div>
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
  const fileInputRef = useRef(null);
  const [photoType, setPhotoType] = useState('before');

  const userFacilities = mockFacilities.filter(f => user.facilities.includes(f.id));

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
      alert('施設を選択し、写真を追加してください');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 清掃前の写真をアップロード
      if (beforePhotos.length > 0) {
        setUploadProgress(20);
        await photosApi.upload(
          selectedFacility.id,
          beforePhotos.map(p => p.file),
          'before'
        );
        setUploadProgress(50);
      }

      // 清掃後の写真をアップロード
      if (afterPhotos.length > 0) {
        setUploadProgress(70);
        await photosApi.upload(
          selectedFacility.id,
          afterPhotos.map(p => p.file),
          'after'
        );
        setUploadProgress(90);
      }

      setUploadProgress(100);
      setIsUploading(false);
      setUploadComplete(true);

      // 3秒後にリセット
      setTimeout(() => {
        setUploadComplete(false);
        setBeforePhotos([]);
        setAfterPhotos([]);
        setMonthlyCheck({ ventilation: false, airFilter: false });
      }, 3000);

    } catch (error) {
      console.error('アップロードエラー:', error);
      setIsUploading(false);
      alert('アップロードに失敗しました: ' + error.message);
    }
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
          <div className="space-y-2 text-gray-600">
            <p>清掃前: {beforePhotos.length}枚</p>
            <p>清掃後: {afterPhotos.length}枚</p>
            {(monthlyCheck.ventilation || monthlyCheck.airFilter) && (
              <p className="text-blue-600 font-medium">月次点検実施済み</p>
            )}
          </div>
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
        {!selectedFacility ? (
          <FacilitySelector
            facilities={userFacilities}
            onSelect={setSelectedFacility}
            title="清掃する施設を選択"
          />
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
    </div>
  );
};

// クライアント画面
const ClientDashboard = ({ user, onLogout }) => {
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  
  const clientFacilities = mockFacilities.filter(f => user.facilities.includes(f.id));
  const facilityAlbums = selectedFacility ? mockAlbums.filter(a => a.facilityId === selectedFacility.id) : [];

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
        {!selectedFacility ? (
          <FacilitySelector
            facilities={clientFacilities}
            onSelect={setSelectedFacility}
            title="閲覧する施設を選択"
          />
        ) : !selectedAlbum ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">{selectedFacility.name}</h2>
              <button
                onClick={() => setSelectedFacility(null)}
                className="text-gray-600 hover:text-gray-900"
              >
                施設を変更
              </button>
            </div>
            
            <div className="grid gap-3">
              {facilityAlbums.map(album => (
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
                        {new Date(album.date).toLocaleDateString('ja-JP', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-gray-600">
                          写真 {album.photos.length}枚
                        </span>
                        {album.monthlyCheck && (album.monthlyCheck.ventilation || album.monthlyCheck.airFilter) && (
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
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {new Date(selectedAlbum.date).toLocaleDateString('ja-JP', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h2>
                <p className="text-sm text-gray-600">{selectedFacility.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-600 hover:text-gray-900">
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

            {selectedAlbum.monthlyCheck && (selectedAlbum.monthlyCheck.ventilation || selectedAlbum.monthlyCheck.airFilter) && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-900 mb-2">月次点検実施項目</p>
                <div className="flex gap-4">
                  {selectedAlbum.monthlyCheck.ventilation && (
                    <span className="flex items-center gap-1 text-sm text-blue-700">
                      <Check className="w-4 h-4" /> 換気扇清掃
                    </span>
                  )}
                  {selectedAlbum.monthlyCheck.airFilter && (
                    <span className="flex items-center gap-1 text-sm text-blue-700">
                      <Check className="w-4 h-4" /> エアコンフィルター
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">清掃前</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {selectedAlbum.photos.filter(p => p.type === 'before').map(photo => (
                    <div key={photo.id} className="relative group">
                      <img 
                        src={photo.url} 
                        alt="清掃前" 
                        className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      />
                      <span className="absolute bottom-2 left-2 text-xs bg-black bg-opacity-50 text-white px-2 py-1 rounded">
                        {photo.time}
                      </span>
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
                        src={photo.url} 
                        alt="清掃後" 
                        className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      />
                      <span className="absolute bottom-2 left-2 text-xs bg-black bg-opacity-50 text-white px-2 py-1 rounded">
                        {photo.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
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