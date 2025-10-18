// ===== frontend/src/components/ImageModal.js =====
// 画像拡大表示用モーダル

import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const ImageModal = ({ photo, onClose, onPrevious, onNext, hasPrevious, hasNext }) => {
  // ESCキーで閉じる
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrevious, onNext, hasPrevious, hasNext]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
      >
        <X className="w-8 h-8" />
      </button>

      {/* 前の画像ボタン */}
      {hasPrevious && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full p-2 z-50"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* 次の画像ボタン */}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full p-2 z-50"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* 画像コンテナ */}
      <div
        className="max-w-6xl max-h-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.type === 'before' ? '清掃前' : '清掃後'}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />

        {/* 画像情報 */}
        <div className="mt-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg">
          <p className="text-sm">
            {photo.type === 'before' ? '清掃前' : '清掃後'}
            {photo.uploaded_at && (
              <span className="ml-4">
                {new Date(photo.uploaded_at).toLocaleString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
