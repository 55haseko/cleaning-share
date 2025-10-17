// ===== frontend/src/components/FacilitySelector.js =====
// 施設選択コンポーネント（検索・ソート・ページング機能付き）

import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowUp, ArrowDown, Building, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const FacilitySelector = ({ facilities, onSelect, title = "施設を選択" }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, client, address, recent
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
  const [currentPage, setCurrentPage] = useState(1);
  const [groupBy, setGroupBy] = useState('none'); // none, client, building
  const itemsPerPage = 12;

  // 検索フィルタリング
  const filteredFacilities = useMemo(() => {
    return facilities.filter(facility =>
      facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (facility.client && facility.client.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (facility.address && facility.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [facilities, searchQuery]);

  // ソート処理
  const sortedFacilities = useMemo(() => {
    const sorted = [...filteredFacilities].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ja');
          break;
        case 'client':
          comparison = (a.client || '').localeCompare(b.client || '', 'ja');
          break;
        case 'address':
          comparison = (a.address || '').localeCompare(b.address || '', 'ja');
          break;
        case 'recent':
          // 最近の清掃日でソート（実際のデータがあれば）
          comparison = (a.lastCleaning || '').localeCompare(b.lastCleaning || '');
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredFacilities, sortBy, sortOrder]);

  // グループ化処理
  const groupedFacilities = useMemo(() => {
    if (groupBy === 'none') {
      return { 'すべて': sortedFacilities };
    }

    const groups = {};
    sortedFacilities.forEach(facility => {
      let key;
      switch (groupBy) {
        case 'client':
          key = facility.client || '未設定';
          break;
        case 'building':
          // 建物名でグループ化（同じ住所の前半部分で判定）
          const addressParts = (facility.address || '').split(' ');
          key = addressParts.slice(0, 2).join(' ') || '未設定';
          break;
        default:
          key = 'すべて';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(facility);
    });

    return groups;
  }, [sortedFacilities, groupBy]);

  // ページング処理
  const paginatedGroups = useMemo(() => {
    const result = {};
    Object.entries(groupedFacilities).forEach(([groupName, groupFacilities]) => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      result[groupName] = groupFacilities.slice(startIndex, endIndex);
    });
    return result;
  }, [groupedFacilities, currentPage, itemsPerPage]);

  const totalItems = Object.values(groupedFacilities).flat().length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const SortButton = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
        sortBy === field
          ? 'bg-blue-100 text-blue-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
      {sortBy === field && (
        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      )}
    </button>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">{title}</h2>

      {/* 検索・フィルター */}
      <div className="mb-6 space-y-4">
        {/* 検索バー */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="施設名、クライアント名、住所で検索..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* ソート・グループ化オプション */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-600">並び替え:</span>
            <SortButton field="name">施設名</SortButton>
            <SortButton field="client">クライアント</SortButton>
            <SortButton field="address">住所</SortButton>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-gray-600">グループ:</span>
            <select
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="none">なし</option>
              <option value="client">クライアント別</option>
              <option value="building">建物別</option>
            </select>
          </div>
        </div>

        {/* 検索結果数表示 */}
        <div className="text-sm text-gray-600">
          {totalItems}件の施設が見つかりました
          {searchQuery && (
            <span className="ml-2">
              「{searchQuery}」の検索結果
              <button
                onClick={() => setSearchQuery('')}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                クリア
              </button>
            </span>
          )}
        </div>
      </div>

      {/* 施設リスト */}
      <div className="space-y-6">
        {Object.entries(paginatedGroups).map(([groupName, groupFacilities]) => (
          <div key={groupName}>
            {groupBy !== 'none' && (
              <h3 className="text-md font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                {groupName} ({groupedFacilities[groupName]?.length || 0}件)
              </h3>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupFacilities.map(facility => (
                <button
                  key={facility.id}
                  onClick={() => onSelect(facility)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <Building className="w-5 h-5 text-blue-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{facility.name}</h4>
                      {facility.client && (
                        <p className="text-sm text-gray-600 truncate">{facility.client}</p>
                      )}
                      {facility.address && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-500 truncate">{facility.address}</p>
                        </div>
                      )}
                      {facility.lastCleaning && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-500">最終清掃: {facility.lastCleaning}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ページング */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} / {totalItems}件
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              前へ
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages, currentPage - 2 + i));
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 text-sm rounded-md ${
                      pageNum === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              次へ
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 施設が見つからない場合 */}
      {totalItems === 0 && (
        <div className="text-center py-12">
          <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">施設が見つかりません</h3>
          <p className="text-gray-600">検索条件を変更してお試しください。</p>
        </div>
      )}
    </div>
  );
};

export default FacilitySelector;