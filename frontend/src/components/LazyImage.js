// ===== frontend/src/components/LazyImage.js =====
// 遅延ローディング対応画像コンポーネント

import React from 'react';
import { useLazyImage, createPlaceholder } from '../hooks/useLazyImage.js';

/**
 * 遅延ローディング対応の画像コンポーネント
 */
const LazyImage = ({
  src,
  alt = '',
  className = '',
  placeholder = null,
  onLoad = null,
  onError = null,
  ...props
}) => {
  const { imgRef, loaded, error } = useLazyImage(src, {
    rootMargin: '200px', // 画面外200pxまで先読み
    threshold: 0.01
  });

  // プレースホルダー画像（デフォルトはグレーの矩形）
  const defaultPlaceholder = placeholder || createPlaceholder(300, 300, '#e5e7eb');

  // ロード完了時のコールバック
  React.useEffect(() => {
    if (loaded && onLoad) {
      onLoad();
    }
  }, [loaded, onLoad]);

  // エラー時のコールバック
  React.useEffect(() => {
    if (error && onError) {
      onError();
    }
  }, [error, onError]);

  return (
    <div ref={imgRef} className={`relative ${className}`} {...props}>
      {/* プレースホルダー */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs">読み込み失敗</p>
          </div>
        </div>
      )}

      {/* 実際の画像 */}
      <img
        src={loaded ? src : defaultPlaceholder}
        alt={alt}
        className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
      />
    </div>
  );
};

export default LazyImage;
