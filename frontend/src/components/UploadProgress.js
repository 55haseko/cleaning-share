// ===== frontend/src/components/UploadProgress.js =====
// 詳細アップロード進捗表示コンポーネント

import React from 'react';
import { CheckCircle, XCircle, Loader, Clock, AlertCircle } from 'lucide-react';

/**
 * 詳細アップロード進捗コンポーネント
 */
const UploadProgress = ({
  progress = 0,
  status = '',
  uploaded = 0,
  total = 0,
  currentBatch = 0,
  totalBatches = 0,
  failed = 0,
  estimatedTime = null,
  onRetry = null,
  isUploading = true
}) => {
  // 残り時間の推定（秒）
  const calculateRemainingTime = () => {
    if (!estimatedTime || progress === 0) return null;

    const elapsed = estimatedTime.elapsed || 0;
    const avgTimePerPercent = elapsed / progress;
    const remaining = avgTimePerPercent * (100 - progress);

    if (remaining < 60) {
      return `約${Math.ceil(remaining)}秒`;
    } else {
      const minutes = Math.ceil(remaining / 60);
      return `約${minutes}分`;
    }
  };

  const remainingTime = calculateRemainingTime();

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isUploading ? (
            <Loader className="w-5 h-5 text-blue-600 animate-spin" />
          ) : failed > 0 ? (
            <AlertCircle className="w-5 h-5 text-orange-600" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-600" />
          )}
          <p className="text-sm font-medium text-blue-900">
            {status || 'アップロード準備中...'}
          </p>
        </div>
        <span className="text-sm font-bold text-blue-700">{progress}%</span>
      </div>

      {/* プログレスバー */}
      <div className="relative">
        <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 失敗部分を赤で表示 */}
        {failed > 0 && total > 0 && (
          <div
            className="absolute top-0 right-0 bg-red-500 h-full rounded-r-full"
            style={{ width: `${(failed / total) * 100}%` }}
          />
        )}
      </div>

      {/* 詳細情報 */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* 進捗情報 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-blue-700">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              完了
            </span>
            <span className="font-semibold">{uploaded}枚</span>
          </div>

          {failed > 0 && (
            <div className="flex items-center justify-between text-red-600">
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                失敗
              </span>
              <span className="font-semibold">{failed}枚</span>
            </div>
          )}

          <div className="flex items-center justify-between text-gray-600">
            <span>合計</span>
            <span className="font-semibold">{total}枚</span>
          </div>
        </div>

        {/* バッチ情報 */}
        <div className="space-y-1">
          {totalBatches > 0 && (
            <>
              <div className="flex items-center justify-between text-blue-700">
                <span>現在のバッチ</span>
                <span className="font-semibold">{currentBatch}/{totalBatches}</span>
              </div>

              {remainingTime && (
                <div className="flex items-center justify-between text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    残り時間
                  </span>
                  <span className="font-semibold">{remainingTime}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 再試行ボタン */}
      {failed > 0 && onRetry && !isUploading && (
        <div className="pt-2 border-t border-blue-200">
          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
          >
            <AlertCircle className="w-4 h-4" />
            失敗した{failed}枚を再試行
          </button>
        </div>
      )}

      {/* ヒントメッセージ */}
      {isUploading && (
        <p className="text-xs text-blue-600 text-center pt-2 border-t border-blue-200">
          大量の写真も安定してアップロードできます。このままお待ちください...
        </p>
      )}
    </div>
  );
};

export default UploadProgress;
