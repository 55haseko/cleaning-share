// ===== frontend/src/api/albums.js =====
// アルバム（清掃記録）関連API

import { apiClient, getFullUrl } from './config.js';

export const albumsApi = {
  // 施設のアルバム一覧取得
  async getByFacility(facilityId, date = null) {
    const params = date ? `?date=${date}` : '';
    const albums = await apiClient.get(`/albums/${facilityId}${params}`);

    // 写真のURLを完全なURLに変換
    return albums.map(album => ({
      ...album,
      photos: album.photos ? album.photos.map(photo => ({
        ...photo,
        url: getFullUrl(photo.url),
        thumbnailUrl: photo.thumbnailUrl ? getFullUrl(photo.thumbnailUrl) : null
      })) : []
    }));
  }
};
