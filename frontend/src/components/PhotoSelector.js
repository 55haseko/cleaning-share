// ===== frontend/src/components/PhotoSelector.js =====
// iPhone風写真一括選択コンポーネント

import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, CheckCircle, Circle, Trash2, Eye } from 'lucide-react';

const PhotoSelector = ({
  photos = [],
  onPhotosChange,
  photoType = 'before',
  title,
  maxPhotos = 20
}) => {
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const fileInputRef = useRef(null);

  // ファイル選択処理
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newPhotos = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      url: URL.createObjectURL(file),
      type: photoType,
      selected: false
    }));

    const updatedPhotos = [...photos, ...newPhotos].slice(0, maxPhotos);
    onPhotosChange(updatedPhotos);
  };

  // 写真選択/選択解除
  const togglePhotoSelection = (photoId) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  // 全選択/全解除
  const toggleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  // 選択モード切り替え
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedPhotos(new Set());
  };

  // 選択した写真を削除
  const deleteSelectedPhotos = () => {
    const remainingPhotos = photos.filter(photo => !selectedPhotos.has(photo.id));
    onPhotosChange(remainingPhotos);
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  // 単一写真削除
  const deletePhoto = (photoId) => {
    const remainingPhotos = photos.filter(photo => photo.id !== photoId);
    onPhotosChange(remainingPhotos);
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-gray-900">{title}</h3>
          <span className="text-sm text-gray-500">{photos.length}枚</span>
          {photos.length >= maxPhotos && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
              上限達成
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {photos.length > 0 && (
            <button
              onClick={toggleSelectionMode}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {isSelectionMode ? 'キャンセル' : '選択'}
            </button>
          )}

          {photos.length < maxPhotos && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Camera className="w-4 h-4" />
              写真を追加
            </button>
          )}
        </div>
      </div>

      {/* 選択モード時のアクションバー */}
      {isSelectionMode && (
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              {selectedPhotos.size === photos.length ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
              {selectedPhotos.size === photos.length ? '全解除' : '全選択'}
            </button>
            <span className="text-sm text-gray-600">
              {selectedPhotos.size}枚選択中
            </span>
          </div>

          {selectedPhotos.size > 0 && (
            <button
              onClick={deleteSelectedPhotos}
              className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4" />
              削除
            </button>
          )}
        </div>
      )}

      {/* 写真アップロードエリア */}
      {photos.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 transition-colors"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-1">写真を追加</p>
              <p className="text-gray-600">クリックまたはドラッグ＆ドロップ</p>
              <p className="text-sm text-gray-500 mt-2">最大{maxPhotos}枚まで選択可能</p>
            </div>
          </div>
        </div>
      ) : (
        /* 写真グリッド */
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {photos.map(photo => (
            <div key={photo.id} className="relative group aspect-square">
              {/* 写真 */}
              <img
                src={photo.url}
                alt=""
                className="w-full h-full object-cover rounded-lg"
              />

              {/* オーバーレイ */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg">
                {/* 選択モード時の選択チェック */}
                {isSelectionMode && (
                  <button
                    onClick={() => togglePhotoSelection(photo.id)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full border-2 border-white bg-black bg-opacity-50 flex items-center justify-center"
                  >
                    {selectedPhotos.has(photo.id) ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : null}
                  </button>
                )}

                {/* 通常モード時のアクションボタン */}
                {!isSelectionMode && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPreviewPhoto(photo)}
                        className="w-8 h-8 bg-black bg-opacity-50 rounded-full flex items-center justify-center hover:bg-opacity-70"
                      >
                        <Eye className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => deletePhoto(photo.id)}
                        className="w-8 h-8 bg-red-500 bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 選択済みマーク */}
              {isSelectionMode && selectedPhotos.has(photo.id) && (
                <div className="absolute inset-0 bg-blue-600 bg-opacity-30 rounded-lg">
                  <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 写真プレビューモーダル */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            <img
              src={previewPhoto.url}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black bg-opacity-50 rounded-full flex items-center justify-center hover:bg-opacity-70"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ファイル入力（非表示） */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 使用方法のヒント */}
      {photos.length > 0 && !isSelectionMode && (
        <div className="text-xs text-gray-500 text-center">
          複数の写真を一括で削除したい場合は「選択」ボタンをクリック
        </div>
      )}
    </div>
  );
};

export default PhotoSelector;