// ===== frontend/src/components/MonthlyCheckDashboard.js =====
// 月次チェック管理ダッシュボード

import React, { useState, useEffect } from 'react';
import { Building, CheckCircle, XCircle, AlertCircle, Calendar, Filter, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/config.js';

const MonthlyCheckDashboard = ({ currentUser }) => {
  const [checkData, setCheckData] = useState({ month: '', facilities: [] });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, incomplete, complete
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // 月次チェック状況を取得
      const data = await apiClient.get('/monthly-checks');
      setCheckData(data);

      // 管理者の場合は統計も取得
      if (currentUser.role === 'admin') {
        try {
          const statsData = await apiClient.get('/monthly-checks/stats');
          setStats(statsData);
        } catch (error) {
          console.log('統計データの取得に失敗しました:', error);
        }
      }
    } catch (error) {
      setError('データの読み込みに失敗しました: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // フィルタリング
  const filteredFacilities = checkData.facilities.filter(facility => {
    switch (filter) {
      case 'incomplete':
        return !facility.ventilation_done || !facility.air_filter_done;
      case 'complete':
        return facility.ventilation_done && facility.air_filter_done;
      default:
        return true;
    }
  });

  // ステータス判定
  const getStatusIcon = (ventilationDone, airFilterDone) => {
    if (ventilationDone && airFilterDone) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } else if (!ventilationDone && !airFilterDone) {
      return <XCircle className="w-5 h-5 text-red-600" />;
    } else {
      return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusText = (ventilationDone, airFilterDone) => {
    if (ventilationDone && airFilterDone) {
      return { text: '完了', color: 'text-green-600 bg-green-100' };
    } else if (!ventilationDone && !airFilterDone) {
      return { text: '未実施', color: 'text-red-600 bg-red-100' };
    } else {
      return { text: '一部完了', color: 'text-yellow-600 bg-yellow-100' };
    }
  };

  if (loading) return <div className="text-center py-8">読み込み中...</div>;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">月次チェック管理</h2>
          <p className="text-gray-600">
            {new Date(checkData.month + '-01').toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long'
            })}の点検状況
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          更新
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* 統計表示（管理者のみ） */}
      {stats && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">全体進捗</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Building className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_facilities}</p>
                  <p className="text-sm text-gray-600">総施設数</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.both_completed}</p>
                  <p className="text-sm text-gray-600">完了施設数</p>
                  <p className="text-xs text-green-600">{stats.completion_rate.both}%</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div>
                <p className="text-lg font-bold text-gray-900">{stats.ventilation_completed}</p>
                <p className="text-sm text-gray-600">換気扇清掃完了</p>
                <p className="text-xs text-purple-600">{stats.completion_rate.ventilation}%</p>
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div>
                <p className="text-lg font-bold text-gray-900">{stats.air_filter_completed}</p>
                <p className="text-sm text-gray-600">フィルター清掃完了</p>
                <p className="text-xs text-orange-600">{stats.completion_rate.air_filter}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* フィルターバー */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">表示フィルター:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                filter === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              すべて ({checkData.facilities.length})
            </button>
            <button
              onClick={() => setFilter('incomplete')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                filter === 'incomplete'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              未完了 ({checkData.facilities.filter(f => !f.ventilation_done || !f.air_filter_done).length})
            </button>
            <button
              onClick={() => setFilter('complete')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                filter === 'complete'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              完了 ({checkData.facilities.filter(f => f.ventilation_done && f.air_filter_done).length})
            </button>
          </div>
        </div>
      </div>

      {/* 施設一覧 */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            施設別チェック状況 ({filteredFacilities.length}件)
          </h3>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredFacilities.map(facility => {
            const status = getStatusText(facility.ventilation_done, facility.air_filter_done);

            return (
              <div key={facility.facility_id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      {getStatusIcon(facility.ventilation_done, facility.air_filter_done)}
                    </div>

                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{facility.facility_name}</h4>
                      <p className="text-sm text-gray-600">{facility.address}</p>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 換気扇清掃 */}
                        <div className="flex items-center gap-2">
                          {facility.ventilation_done ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm text-gray-700">換気扇清掃</span>
                          {facility.last_ventilation_check && (
                            <span className="text-xs text-gray-500">
                              ({new Date(facility.last_ventilation_check).toLocaleDateString('ja-JP')})
                            </span>
                          )}
                        </div>

                        {/* エアコンフィルター */}
                        <div className="flex items-center gap-2">
                          {facility.air_filter_done ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="text-sm text-gray-700">エアコンフィルター</span>
                          {facility.last_air_filter_check && (
                            <span className="text-xs text-gray-500">
                              ({new Date(facility.last_air_filter_check).toLocaleDateString('ja-JP')})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                      {status.text}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredFacilities.length === 0 && (
          <div className="p-12 text-center">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">該当する施設がありません</h3>
            <p className="text-gray-600">フィルター条件を変更してください。</p>
          </div>
        )}
      </div>

      {/* 注意事項 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">月次チェックについて</h4>
            <p className="text-sm text-blue-800 mt-1">
              • 換気扇清掃とエアコンフィルター清掃は月1回実施が必要です<br />
              • チェック状況は毎月1日に自動リセットされます<br />
              • 未完了の施設がある場合は担当スタッフに連絡してください
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyCheckDashboard;