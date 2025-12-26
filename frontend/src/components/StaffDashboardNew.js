// ===== frontend/src/components/StaffDashboardNew.js =====
// 新しいスタッフダッシュボード（施設選択・写真アップロード・月次点検・領収書）

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, Camera, LogOut, User, Building, Search,
  ArrowUp, ArrowDown, MapPin, X, Check, Eye, FileText,
  Clock, AlertCircle, CheckCircle, Calendar, Trash2, Image
} from 'lucide-react';
import { facilitiesApi } from '../api/facilities.js';
import { photosApi } from '../api/photos.js';
import { receiptsApi } from '../api/receipts.js';
import { monthlyCheckApi } from '../api/monthlyCheck.js';
import PhotoSelector from './PhotoSelector.js';
import { batchUploadPhotos, retryFailedBatches } from '../utils/batchUpload.js';
import UploadProgress from './UploadProgress.js';
import PDFPreview from './PDFPreview.js';
import ScrollButtons from './ScrollButtons.js';

const StaffDashboardNew = ({ user, onLogout }) => {
  // 施設選択画面の状態
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, recent
  const [sortOrder, setSortOrder] = useState('asc');
  const [loading, setLoading] = useState(true);

  // 日付選択・アルバム閲覧の状態
  const [viewMode, setViewMode] = useState('upload'); // 'upload' | 'view'
  const [albums, setAlbums] = useState([]); // 過去のアルバム一覧
  const [selectedAlbum, setSelectedAlbum] = useState(null); // 選択中のアルバム
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState(null);

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
  const [uploadStatus, setUploadStatus] = useState(''); // アップロード状態メッセージ
  const [uploadStats, setUploadStats] = useState({
    uploaded: 0,
    total: 0,
    currentBatch: 0,
    totalBatches: 0,
    failed: 0,
    startTime: null
  });
  const [uploadErrors, setUploadErrors] = useState({ before: [], after: [] });
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

  // 施設のアルバム一覧を取得
  const loadAlbums = async (facilityId) => {
    try {
      setLoadingAlbums(true);
      const albumsData = await photosApi.getAlbums(facilityId);
      setAlbums(albumsData);
      setError('');
    } catch (err) {
      setError('アルバムの読み込みに失敗しました: ' + err.message);
    } finally {
      setLoadingAlbums(false);
    }
  };

  // 写真を削除
  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('この写真を削除してもよろしいですか？')) {
      return;
    }

    try {
      setDeletingPhotoId(photoId);
      await photosApi.delete(photoId);

      // アルバムを再読み込みして表示を更新
      if (selectedAlbum) {
        await loadAlbums(selectedFacility.id);
        // 選択中のアルバムを更新
        const updatedAlbums = await photosApi.getAlbums(selectedFacility.id);
        const updatedAlbum = updatedAlbums.find(a => a.id === selectedAlbum.id);
        setSelectedAlbum(updatedAlbum || null);
      }

      setError('');
    } catch (err) {
      setError('写真の削除に失敗しました: ' + err.message);
    } finally {
      setDeletingPhotoId(null);
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

  // アップロード処理（バッチアップロード対応）
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
    setUploadStatus('');
    setError('');
    setUploadStats({
      uploaded: 0,
      total: beforePhotos.length + afterPhotos.length,
      currentBatch: 0,
      totalBatches: 0,
      failed: 0,
      startTime: Date.now()
    });
    setUploadErrors({ before: [], after: [] });

    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const month = today.substring(0, 7); // YYYY-MM
      let sessionId = null;

      const totalSteps =
        (beforePhotos.length > 0 ? 1 : 0) +
        (afterPhotos.length > 0 ? 1 : 0) +
        (receipts.length > 0 ? 1 : 0) +
        (monthlyCheck.ventilation || monthlyCheck.airFilter ? 1 : 0);

      let completedSteps = 0;

      // 清掃前写真のバッチアップロード
      if (beforePhotos.length > 0) {
        setUploadStatus(`清掃前の写真をアップロード中... (${beforePhotos.length}枚)`);

        const result = await batchUploadPhotos(
          selectedFacility.id,
          beforePhotos.map(p => p.file),
          'before',
          {
            date: today,
            onProgress: (uploaded, total, currentBatch, totalBatches) => {
              const baseProgress = (completedSteps / totalSteps) * 100;
              const stepProgress = (uploaded / total) * (100 / totalSteps);
              setUploadProgress(Math.round(baseProgress + stepProgress));
              setUploadStatus(`清掃前の写真: ${uploaded}/${total}枚 (バッチ${currentBatch}/${totalBatches})`);
              setUploadStats(prev => ({
                ...prev,
                uploaded,
                currentBatch,
                totalBatches
              }));
            }
          }
        );

        if (!result.success) {
          setUploadErrors(prev => ({ ...prev, before: result.errors }));
          setUploadStats(prev => ({ ...prev, failed: prev.failed + result.errors.length }));
        }

        sessionId = result.sessionId;
        completedSteps++;
      }

      // 清掃後写真のバッチアップロード
      if (afterPhotos.length > 0) {
        setUploadStatus(`清掃後の写真をアップロード中... (${afterPhotos.length}枚)`);

        const result = await batchUploadPhotos(
          selectedFacility.id,
          afterPhotos.map(p => p.file),
          'after',
          {
            date: today,
            sessionId,
            onProgress: (uploaded, total, currentBatch, totalBatches) => {
              const baseProgress = (completedSteps / totalSteps) * 100;
              const stepProgress = (uploaded / total) * (100 / totalSteps);
              setUploadProgress(Math.round(baseProgress + stepProgress));
              setUploadStatus(`清掃後の写真: ${uploaded}/${total}枚 (バッチ${currentBatch}/${totalBatches})`);
              setUploadStats(prev => ({
                ...prev,
                uploaded: beforePhotos.length + uploaded,
                currentBatch,
                totalBatches
              }));
            }
          }
        );

        if (!result.success) {
          setUploadErrors(prev => ({ ...prev, after: result.errors }));
          setUploadStats(prev => ({ ...prev, failed: prev.failed + result.errors.length }));
        }

        sessionId = result.sessionId || sessionId;
        completedSteps++;
      }

      // 領収書のアップロード
      if (receipts.length > 0) {
        setUploadStatus('領収書をアップロード中...');
        const baseProgress = (completedSteps / totalSteps) * 100;
        setUploadProgress(Math.round(baseProgress));

        await receiptsApi.upload(
          selectedFacility.id,
          receipts.map(r => r.file),
          month,
          sessionId
        );
        completedSteps++;
      }

      // 月次点検の保存
      if (monthlyCheck.ventilation || monthlyCheck.airFilter) {
        setUploadStatus('月次点検を保存中...');
        const baseProgress = (completedSteps / totalSteps) * 100;
        setUploadProgress(Math.round(baseProgress));

        await monthlyCheckApi.save(selectedFacility.id, monthlyCheck, sessionId);
        completedSteps++;
      }

      // エラーがある場合は完了画面を表示しない
      const hasErrors = uploadErrors.before.length > 0 || uploadErrors.after.length > 0;
      if (hasErrors) {
        setUploadProgress(100);
        setUploadStatus('一部の写真のアップロードに失敗しました');
        setError(`${uploadErrors.before.length + uploadErrors.after.length}件のアップロードに失敗しました。再試行ボタンをクリックしてください。`);
      } else {
        setUploadProgress(100);
        setUploadStatus('アップロード完了！');
        setUploadComplete(true);
      }

    } catch (err) {
      console.error('アップロードエラー:', err);
      setError('アップロードに失敗しました: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 失敗した写真の再試行
  const handleRetryUpload = async () => {
    const hasErrors = uploadErrors.before.length > 0 || uploadErrors.after.length > 0;
    if (!hasErrors) return;

    setIsUploading(true);
    setError('');

    try {
      const today = new Date().toISOString().split('T')[0];
      let sessionId = null;
      let newBeforeErrors = uploadErrors.before;
      let newAfterErrors = uploadErrors.after;

      // 清掃前の失敗分を再試行
      if (uploadErrors.before.length > 0) {
        setUploadStatus('清掃前の写真を再アップロード中...');
        const result = await retryFailedBatches(
          selectedFacility.id,
          uploadErrors.before,
          'before',
          {
            date: today,
            onProgress: (uploaded, total, currentBatch, totalBatches) => {
              setUploadStats(prev => ({
                ...prev,
                uploaded: prev.uploaded + uploaded,
                currentBatch,
                totalBatches
              }));
            }
          }
        );

        if (result.success) {
          newBeforeErrors = [];
          setUploadErrors(prev => ({ ...prev, before: [] }));
          setUploadStats(prev => ({ ...prev, failed: prev.failed - result.successCount }));
        } else {
          newBeforeErrors = result.stillFailedErrors;
          setUploadErrors(prev => ({ ...prev, before: result.stillFailedErrors }));
        }

        sessionId = result.retryResults[0]?.result?.sessionId;
      }

      // 清掃後の失敗分を再試行
      if (uploadErrors.after.length > 0) {
        setUploadStatus('清掃後の写真を再アップロード中...');
        const result = await retryFailedBatches(
          selectedFacility.id,
          uploadErrors.after,
          'after',
          {
            date: today,
            sessionId,
            onProgress: (uploaded, total, currentBatch, totalBatches) => {
              setUploadStats(prev => ({
                ...prev,
                uploaded: prev.uploaded + uploaded,
                currentBatch,
                totalBatches
              }));
            }
          }
        );

        if (result.success) {
          newAfterErrors = [];
          setUploadErrors(prev => ({ ...prev, after: [] }));
          setUploadStats(prev => ({ ...prev, failed: prev.failed - result.successCount }));
        } else {
          newAfterErrors = result.stillFailedErrors;
          setUploadErrors(prev => ({ ...prev, after: result.stillFailedErrors }));
        }
      }

      // 全て成功したら完了（新しいエラー状態を参照）
      const stillHasErrors = newBeforeErrors.length > 0 || newAfterErrors.length > 0;
      if (!stillHasErrors) {
        setUploadProgress(100);
        setUploadStatus('再試行完了！');
        setUploadComplete(true);
      } else {
        setError('一部の写真の再アップロードに失敗しました');
      }
    } catch (err) {
      console.error('再試行エラー:', err);
      setError('再試行に失敗しました: ' + err.message);
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
    setUploadErrors({ before: [], after: [] });
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
                  onClick={() => {
                    setSelectedFacility(null);
                    setViewMode('upload');
                    setSelectedAlbum(null);
                    setAlbums([]);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  施設を変更
                </button>
              </div>

              {/* モード切り替えタブ */}
              <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                  onClick={() => {
                    setViewMode('upload');
                    setSelectedAlbum(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
                    viewMode === 'upload'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  新規アップロード
                </button>
                <button
                  onClick={() => {
                    setViewMode('view');
                    loadAlbums(selectedFacility.id);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
                    viewMode === 'view'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  過去のアルバム
                </button>
              </div>

              {/* アップロードモード */}
              {viewMode === 'upload' && (
                <>
                  {/* アップロード進捗 */}
                  {isUploading && (
                    <div className="mb-6">
                      <UploadProgress
                        progress={uploadProgress}
                        status={uploadStatus}
                        uploaded={uploadStats.uploaded}
                        total={uploadStats.total}
                        currentBatch={uploadStats.currentBatch}
                        totalBatches={uploadStats.totalBatches}
                        failed={uploadStats.failed}
                        estimatedTime={{ elapsed: (Date.now() - uploadStats.startTime) / 1000 }}
                        isUploading={isUploading}
                      />
                    </div>
                  )}

                  {/* エラー時の再試行 */}
                  {!isUploading && uploadStats.failed > 0 && !uploadComplete && (
                    <div className="mb-6">
                      <UploadProgress
                        progress={uploadProgress}
                        status={uploadStatus}
                        uploaded={uploadStats.uploaded}
                        total={uploadStats.total}
                        currentBatch={uploadStats.currentBatch}
                        totalBatches={uploadStats.totalBatches}
                        failed={uploadStats.failed}
                        onRetry={handleRetryUpload}
                        isUploading={false}
                      />
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
                        maxPhotos={200}
                      />
                    </div>
                    <div>
                      <PhotoSelector
                        photos={afterPhotos}
                        onPhotosChange={setAfterPhotos}
                        photoType="after"
                        title="清掃後の写真"
                        maxPhotos={200}
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
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {receipts.map(receipt => {
                            const isPDF = receipt.name.toLowerCase().endsWith('.pdf');
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(receipt.name);

                            return (
                              <div key={receipt.id} className="relative bg-white rounded-lg border border-gray-200 overflow-hidden">
                                {/* プレビュー表示 */}
                                <div className="w-full bg-gray-100 aspect-square flex items-center justify-center relative">
                                  {isImage ? (
                                    <img src={receipt.url} alt={receipt.name} className="w-full h-full object-contain" />
                                  ) : isPDF ? (
                                    <div className="w-full h-full bg-white">
                                      <PDFPreview file={receipt.file} className="w-full h-full" />
                                    </div>
                                  ) : (
                                    <div className="text-center">
                                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                      <span className="text-xs text-gray-600">{receipt.name}</span>
                                    </div>
                                  )}
                                </div>

                                {/* 削除ボタン */}
                                <button
                                  onClick={() => removeReceipt(receipt.id)}
                                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
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
                </>
              )}

              {/* アルバム閲覧モード */}
              {viewMode === 'view' && (
                <>
                  {loadingAlbums ? (
                    <div className="text-center py-12">
                      <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="mt-4 text-gray-600">読み込み中...</p>
                    </div>
                  ) : selectedAlbum ? (
                    /* アルバム詳細表示 */
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {new Date(selectedAlbum.cleaning_date).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {selectedAlbum.photos?.length || 0}枚の写真
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedAlbum(null)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          ← 日付一覧に戻る
                        </button>
                      </div>

                      {/* 写真グリッド */}
                      {selectedAlbum.photos && selectedAlbum.photos.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {selectedAlbum.photos.map(photo => (
                            <div key={photo.id} className="relative group">
                              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                <img
                                  src={photo.thumbnailUrl || photo.url}
                                  alt={photo.type === 'before' ? '清掃前' : '清掃後'}
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              {/* 写真タイプバッジ */}
                              <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                                photo.type === 'before'
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-green-500 text-white'
                              }`}>
                                {photo.type === 'before' ? '清掃前' : '清掃後'}
                              </div>

                              {/* 削除ボタン */}
                              <button
                                onClick={() => handleDeletePhoto(photo.id)}
                                disabled={deletingPhotoId === photo.id}
                                className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                                title="写真を削除"
                              >
                                {deletingPhotoId === photo.id ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600">写真がありません</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* 日付一覧表示 */
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-4">日付を選択</h3>
                      {albums.length > 0 ? (
                        <div className="space-y-2">
                          {albums.map(album => (
                            <button
                              key={album.id}
                              onClick={() => setSelectedAlbum(album)}
                              className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {new Date(album.cleaning_date).toLocaleDateString('ja-JP', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      weekday: 'short'
                                    })}
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {album.photo_count || 0}枚の写真
                                  </p>
                                </div>
                                <div className="text-blue-600 group-hover:text-blue-800">
                                  →
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600">アルバムがまだありません</p>
                          <p className="text-sm text-gray-500 mt-2">新規アップロードから写真を追加してください</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* スクロールボタン */}
      <ScrollButtons />
    </div>
  );
};

export default StaffDashboardNew;
