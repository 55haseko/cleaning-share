// ===== frontend/src/api/photos.js =====
// 写真関連API

import { apiClient, getFullUrl } from './config.js';

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

    const response = await apiClient.post('/photos/upload', formData);

    // URLを完全なURLに変換
    if (response.files) {
      response.files = response.files.map(file => ({
        ...file,
        url: getFullUrl(file.url),
        thumbnailUrl: file.thumbnailUrl ? getFullUrl(file.thumbnailUrl) : null
      }));
    }

    return response;
  },

  // アルバム取得
  async getAlbums(facilityId, date = null) {
    const query = date ? `?date=${date}` : '';
    const albums = await apiClient.get(`/albums/${facilityId}${query}`);

    // URLを完全なURLに変換
    return albums.map(album => ({
      ...album,
      photos: album.photos ? album.photos.map(photo => ({
        ...photo,
        url: getFullUrl(photo.url),
        thumbnailUrl: photo.thumbnailUrl ? getFullUrl(photo.thumbnailUrl) : null
      })) : []
    }));
  },

  // 写真削除（管理者のみ）
  async delete(photoId) {
    return await apiClient.delete(`/photos/${photoId}`);
  }
};
