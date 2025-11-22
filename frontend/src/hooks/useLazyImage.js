// ===== frontend/src/hooks/useLazyImage.js =====
// 遅延ローディング用カスタムフック

import { useState, useEffect, useRef } from 'react';

/**
 * 画像の遅延ローディングフック
 * @param {string} src - 画像のURL
 * @param {Object} options - オプション
 * @param {string} options.rootMargin - IntersectionObserverのrootMargin（デフォルト: '100px'）
 * @param {number} options.threshold - IntersectionObserverのthreshold（デフォルト: 0.01）
 * @returns {Object} { imgRef, loaded, error }
 */
export function useLazyImage(src, options = {}) {
  const { rootMargin = '100px', threshold = 0.01 } = options;

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!src) return;

    // IntersectionObserverがサポートされていない場合は即座にロード
    if (!('IntersectionObserver' in window)) {
      setLoaded(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loaded) {
          // 画像が画面内に入ったらロード開始
          const img = new Image();

          img.onload = () => {
            setLoaded(true);
            setError(false);
          };

          img.onerror = () => {
            setError(true);
            setLoaded(false);
          };

          img.src = src;

          // ロード開始後はObserverを解除
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [src, loaded, rootMargin, threshold]);

  return { imgRef, loaded, error };
}

/**
 * 複数画像の遅延ローディング管理フック
 * @param {Array} images - 画像の配列
 * @param {Object} options - オプション
 * @returns {Object} { loadedImages, totalLoaded, isAllLoaded }
 */
export function useLazyImages(images = [], options = {}) {
  const [loadedImages, setLoadedImages] = useState(new Set());

  const handleImageLoad = (imageId) => {
    setLoadedImages(prev => new Set([...prev, imageId]));
  };

  const totalLoaded = loadedImages.size;
  const isAllLoaded = totalLoaded === images.length;

  return {
    loadedImages,
    totalLoaded,
    isAllLoaded,
    handleImageLoad
  };
}

/**
 * プレースホルダー画像を生成
 * @param {number} width - 幅
 * @param {number} height - 高さ
 * @param {string} color - 背景色
 * @returns {string} Data URL
 */
export function createPlaceholder(width = 300, height = 300, color = '#e5e7eb') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  // 中央にローディングアイコン風の円を描画
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 6;

  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 1.5);
  ctx.stroke();

  return canvas.toDataURL();
}
