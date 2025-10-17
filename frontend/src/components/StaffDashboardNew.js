// ===== frontend/src/components/StaffDashboardNew.js =====
// 新しいスタッフダッシュボード（施設選択・写真アップロード・月次点検・領収書）

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, Camera, LogOut, User, Building, Search,
  ArrowUp, ArrowDown, MapPin, X, Check, Eye, FileText,
  Clock, AlertCircle, CheckCircle
} from 'lucide-react';
import { facilitiesApi } from '../api/facilities.js';
import { photosApi } from '../api/photos.js';
import { receiptsApi } from '../api/receipts.js';
import { monthlyCheckApi } from '../api/monthlyCheck.js';
import PhotoSelector from './PhotoSelector.js';

const StaffDashboardNew = ({ user, onLogout }) => {
  // 施設選択画面の状態
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, recent
  const [sortOrder, setSortOrder] = useState('asc');
  const [loading, setLoading] = useState(true);

  // 清掃記録登録画面の状態
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [monthlyCheck, setMonthlyCheck] = useState({
    ventilation: false,
    airFilter: false
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [error, setError] = useState('');

  const receiptInputRef = useRef(null);

  // 初期ロード：担当施設を取得
  useEffect(() => {
    loadFacilities();
  }, [user]);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      // スタッフの担当施設を取得
      const allFacilities = await facilitiesApi.getList();

      // ユーザーの担当施設のみフィルター（モックデータ対応）
      const userFacilities = user.facilities
        ? allFacilities.filter(f => user.facilities.includes(f.id))
        : allFacilities;

      setFacilities(userFacilities);
      setError('');
    } catch (err) {
      setError('施設の読み込みに失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 施設検索・ソート
  const filteredFacilities = facilities
    .filter(facility => {
      const searchLower = searchQuery.toLowerCase();
      return (
        facility.name?.toLowerCase().includes(searchLower) ||
        facility.address?.toLowerCase().includes(searchLower) ||
        facility.client?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '', 'ja');
      } else if (sortBy === 'recent') {
        comparison = (b.lastCleaning || '').localeCompare(a.lastCleaning || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleSortToggle = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // 領収書ファイル選択
  const handleReceiptSelect = (e) => {
    const files = Array.from(e.target.files);
    const newReceipts = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      url: URL.createObjectURL(file)
    }));
    setReceipts([...receipts, ...newReceipts]);
  };

  const removeReceipt = (id) => {
    setReceipts(receipts.filter(r => r.id !== id));
  };

  // アップロード処理
  const handleUpload = async () => {
    if (!selectedFacility) {
      setError('施設が選択されていません');
      return;
    }

    if (beforePhotos.length === 0 && afterPhotos.length === 0 && receipts.length === 0) {
      setError('写真または領収書を追加してください');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const month = today.substring(0, 7); // YYYY-MM
      let sessionId = null;

      // 清掃前写真のアップロード
      if (beforePhotos.length > 0) {
        setUploadProgress(20);
        const result = await photosApi.upload(
          selectedFacility.id,
          beforePhotos.map(p => p.file),
          'before'
        );
        sessionId = result.sessionId;
      }

      // 清掃後写真のアップロード
      if (afterPhotos.length > 0) {
        setUploadProgress(50);
        const result = await photosApi.upload(
          selectedFacility.id,
          afterPhotos.map(p => p.file),
          'after',
          { sessionId }
        );
        sessionId = result.sessionId || sessionId;
      }

      // 領収書のアップロード
      if (receipts.length > 0) {
        setUploadProgress(70);
        await receiptsApi.upload(
          selectedFacility.id,
          receipts.map(r => r.file),
          month,
          sessionId
        );
      }

      // 月次点検の保存
      if (monthlyCheck.ventilation || monthlyCheck.airFilter) {
        setUploadProgress(90);
        await monthlyCheckApi.save(selectedFacility.id, monthlyCheck, sessionId);
      }

      setUploadProgress(100);
      setUploadComplete(true);

    } catch (err) {
      setError('アップロードに失敗しました: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // アップロード完了後のリセット処理
  const handleResetAfterUpload = () => {
    setUploadComplete(false);
    setBeforePhotos([]);
    setAfterPhotos([]);
    setReceipts([]);
    setMonthlyCheck({ ventilation: false, airFilter: false });
    setSelectedFacility(null);
  };

  // アップロード完了画面
  if (uploadComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">アップロード完了</h2>
          <div className="space-y-2 text-gray-600 mb-6">
            <p className="font-medium text-gray-900">{selectedFacility?.name}</p>
            {beforePhotos.length > 0 && <p>清掃前の写真: {beforePhotos.length}枚</p>}
            {afterPhotos.length > 0 && <p>清掃後の写真: {afterPhotos.length}枚</p>}
            {receipts.length > 0 && <p>領収書: {receipts.length}枚</p>}
            {(monthlyCheck.ventilation || monthlyCheck.airFilter) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="font-medium text-blue-600 mb-2">月次点検実施済み</p>
                <div className="text-sm">
                  {monthlyCheck.ventilation && <p>✓ 換気扇清掃</p>}
                  {monthlyCheck.airFilter && <p>✓ エアコンフィルター清掃</p>}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <button
              onClick={handleResetAfterUpload}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              他の施設を清掃する
            </button>
            <button
              onClick={() => setUploadComplete(false)}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              この施設に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
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
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ログアウト</span>
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
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">清掃する施設を選択</h2>

            {/* 検索・ソート */}
            <div className="mb-6 space-y-4">
              {/* 検索バー */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="施設名、住所で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* ソートボタン */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">並び替え:</span>
                <button
                  onClick={() => handleSortToggle('name')}
                  className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    sortBy === 'name'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  施設名
                  {sortBy === 'name' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => handleSortToggle('recent')}
                  className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    sortBy === 'recent'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  最近作業した順
                  {sortBy === 'recent' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  )}
                </button>
              </div>

              {/* 検索結果数 */}
              <div className="text-sm text-gray-600">
                {filteredFacilities.length}件の施設
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    検索をクリア
                  </button>
                )}
              </div>
            </div>

            {/* 施設リスト */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-600">読み込み中...</p>
              </div>
            ) : filteredFacilities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFacilities.map(facility => (
                  <button
                    key={facility.id}
                    onClick={() => setSelectedFacility(facility)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <Building className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{facility.name}</h3>
                        {facility.client && (
                          <p className="text-sm text-gray-600 truncate">{facility.client}</p>
                        )}
                        {facility.address && (
                          <div className="flex items-center gap-1 mt-2">
                            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <p className="text-xs text-gray-500 truncate">{facility.address}</p>
                          </div>
                        )}
                        {facility.lastCleaning && (
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <p className="text-xs text-gray-500">最終: {facility.lastCleaning}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">施設が見つかりません</h3>
                <p className="text-gray-600">検索条件を変更してお試しください。</p>
              </div>
            )}
          </div>
        ) : (
          /* 清掃記録登録画面 */
          <div className="space-y-6">
            {/* 施設情報カード */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedFacility.name}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date().toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFacility(null)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  施設を変更
                </button>
              </div>

              {/* アップロード進捗 */}
              {isUploading && (
                <div className="mb-6">
                  <p className="text-center text-gray-600 mb-2">アップロード中...</p>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-gray-500 mt-2">{uploadProgress}%</p>
                </div>
              )}

              {!isUploading && (
                <>
                  {/* 写真アップロード */}
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <PhotoSelector
                        photos={beforePhotos}
                        onPhotosChange={setBeforePhotos}
                        photoType="before"
                        title="清掃前の写真"
                        maxPhotos={20}
                      />
                    </div>
                    <div>
                      <PhotoSelector
                        photos={afterPhotos}
                        onPhotosChange={setAfterPhotos}
                        photoType="after"
                        title="清掃後の写真"
                        maxPhotos={20}
                      />
                    </div>
                  </div>

                  {/* 月1回点検項目 */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-3">月1回点検項目</h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={monthlyCheck.ventilation}
                          onChange={(e) => setMonthlyCheck({...monthlyCheck, ventilation: e.target.checked})}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-gray-700">換気扇清掃</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={monthlyCheck.airFilter}
                          onChange={(e) => setMonthlyCheck({...monthlyCheck, airFilter: e.target.checked})}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-gray-700">エアコンフィルター清掃</span>
                      </label>
                    </div>
                  </div>

                  {/* 領収書アップロード */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">領収書</h3>
                      <span className="text-sm text-gray-500">{receipts.length}枚</span>
                    </div>

                    {receipts.length === 0 ? (
                      <div
                        onClick={() => receiptInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                      >
                        <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">領収書をアップロード</p>
                        <p className="text-sm text-gray-500 mt-1">PDF・画像ファイル対応</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2 mb-3">
                          {receipts.map(receipt => (
                            <div key={receipt.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <span className="text-sm text-gray-700 truncate">{receipt.name}</span>
                              </div>
                              <button
                                onClick={() => removeReceipt(receipt.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => receiptInputRef.current?.click()}
                          className="w-full py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                        >
                          さらに追加
                        </button>
                      </>
                    )}

                    <input
                      ref={receiptInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={handleReceiptSelect}
                      className="hidden"
                    />
                  </div>

                  {/* アップロードボタン */}
                  <button
                    onClick={handleUpload}
                    disabled={beforePhotos.length === 0 && afterPhotos.length === 0 && receipts.length === 0}
                    className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    アップロード
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StaffDashboardNew;
