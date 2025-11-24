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
  },

  // セッション（アルバム）削除
  async deleteSession(sessionId) {
    return await apiClient.delete(`/sessions/${sessionId}`);
  },

  // アルバムダウンロード
  async download(facilityId, sessionId) {
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
    const url = `${API_BASE}/albums/${facilityId}/${sessionId}/download`;
    const token = localStorage.getItem('authToken');

    if (!token) {
      throw new Error('認証トークンが見つかりません');
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ダウンロードエラー:', response.status, errorText);
      throw new Error(`ダウンロードに失敗しました (${response.status})`);
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error('ダウンロードしたファイルが空です');
    }

    // Content-Dispositionヘッダーからファイル名を取得
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `album_${facilityId}_${sessionId}.zip`;
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches && matches[1]) {
        filename = decodeURIComponent(matches[1].replace(/['"]/g, ''));
      }
    }

    // iOS Safariの検出
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      // iOS Safari: 新しいタブで開く（ユーザーが保存を選択できる）
      const downloadUrl = window.URL.createObjectURL(blob);
      const newWindow = window.open(downloadUrl, '_blank');

      // クリーンアップは少し遅らせる
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        if (newWindow) {
          // iOS Safariでは共有シートが表示される
          alert('ダウンロード準備完了\n\n共有ボタンから「"ファイル"に保存」を選択してください');
        }
      }, 100);
    } else {
      // デスクトップ・Android: 通常のダウンロード
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      }, 100);
    }
  }
};
