// ===== frontend/src/api/photos.js =====
// 写真関連API

import { apiClient } from './config.js';

export const photosApi = {
  // 写真アップロード（仕様準拠版）
  async upload(facilityId, photos, type, options = {}) {
    const { date, sessionId } = options;
    const formData = new FormData();

    formData.append('facilityId', facilityId);
    formData.append('type', type); // before | after

    // 清掃日付を指定（未指定の場合は今日）
    if (date) {
      formData.append('date', date); // YYYY-MM-DD
    }

    if (sessionId) {
      formData.append('sessionId', sessionId);
    }

    // 複数の写真を追加
    photos.forEach(photo => {
      formData.append('photos', photo);
    });

    return await apiClient.post('/photos/upload', formData);
  },

  // アルバム取得
  async getAlbums(facilityId, date = null) {
    const query = date ? `?date=${date}` : '';
    return await apiClient.get(`/albums/${facilityId}${query}`);
  },

  // 写真削除
  async deletePhoto(photoId) {
    return await apiClient.delete(`/photos/${photoId}`);
  }
};
