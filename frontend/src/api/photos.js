// ===== frontend/src/api/photos.js =====
// 写真関連API

export const photosApi = {
  // 写真アップロード
  async upload(facilityId, photos, type, sessionId = null) {
    const formData = new FormData();
    formData.append('facilityId', facilityId);
    formData.append('type', type);
    
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
