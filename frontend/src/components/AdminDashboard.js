// ===== frontend/src/components/AdminDashboard.js =====
// 管理者ダッシュボード（タブメニュー対応版）

import React, { useState, useEffect } from 'react';
import { usersApi } from '../api/users.js';
import { facilitiesApi } from '../api/facilities.js';
import { statsApi } from '../api/stats.js';

const AdminDashboard = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview'); // overview, facilities, users, reports
  const [users, setUsers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentUploads, setRecentUploads] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFacilityForm, setShowFacilityForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 新規ユーザーフォームの状態
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: 'staff',
    facilityIds: []
  });

  // 施設フォームの状態
  const [facilityForm, setFacilityForm] = useState({
    id: null,
    name: '',
    address: '',
    client_user_id: null
  });

  // 施設管理の検索・ソート状態
  const [facilitySearch, setFacilitySearch] = useState('');
  const [facilitySortBy, setFacilitySortBy] = useState('name'); // name, id, client, address
  const [facilitySortOrder, setFacilitySortOrder] = useState('asc'); // asc, desc

  // ユーザー管理の検索・ソート状態
  const [userSearch, setUserSearch] = useState('');
  const [userSortBy, setUserSortBy] = useState('name'); // name, email, role, created_at
  const [userSortOrder, setUserSortOrder] = useState('asc'); // asc, desc

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'overview') {
        // 概要タブ: 統計と最近のアップロード
        const [statsData, uploadsData] = await Promise.all([
          statsApi.getDaily(),
          statsApi.getRecentUploads(10)
        ]);
        setStats(statsData);
        setRecentUploads(uploadsData);
      } else if (activeTab === 'facilities') {
        // 施設管理タブ
        const [facilitiesData, usersData] = await Promise.all([
          facilitiesApi.getList(),
          usersApi.getUsers()
        ]);
        setFacilities(facilitiesData);
        setUsers(usersData);
      } else if (activeTab === 'users') {
        // ユーザー管理タブ
        const [usersData, facilitiesData] = await Promise.all([
          usersApi.getUsers(),
          facilitiesApi.getList()
        ]);
        setUsers(usersData);
        setFacilities(facilitiesData);
      }

      setError('');
    } catch (error) {
      setError('データの読み込みに失敗しました: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ===== ユーザー管理ハンドラー =====
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await usersApi.createUser(newUser);
      setNewUser({
        email: '',
        password: '',
        name: '',
        role: 'staff',
        facilityIds: []
      });
      setShowCreateForm(false);
      await loadData();
      alert('ユーザーを作成しました');
    } catch (error) {
      setError('ユーザー作成に失敗しました: ' + error.message);
    }
  };

  const handleResetPassword = async (userId, userName) => {
    const newPassword = prompt(`${userName}さんの新しいパスワードを入力してください:`);
    if (newPassword && newPassword.length >= 6) {
      try {
        await usersApi.resetPassword(userId, newPassword);
        alert(`パスワードを変更しました。\n新しいパスワード: ${newPassword}`);
      } catch (error) {
        setError('パスワードリセットに失敗しました: ' + error.message);
      }
    } else if (newPassword) {
      alert('パスワードは6文字以上である必要があります');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (window.confirm(`${userName}さんのアカウントを削除しますか？`)) {
      try {
        await usersApi.deleteUser(userId);
        await loadData();
        alert('ユーザーを削除しました');
      } catch (error) {
        setError('ユーザー削除に失敗しました: ' + error.message);
      }
    }
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUser({ ...newUser, password });
  };

  // ===== 施設管理ハンドラー =====
  const handleCreateFacility = () => {
    setFacilityForm({
      id: null,
      name: '',
      address: '',
      client_user_id: null
    });
    setShowFacilityForm(true);
  };

  const handleEditFacility = (facility) => {
    setFacilityForm({
      id: facility.id,
      name: facility.name,
      address: facility.address || '',
      client_user_id: facility.client_user_id || null
    });
    setShowFacilityForm(true);
  };

  const handleSaveFacility = async (e) => {
    e.preventDefault();
    try {
      if (facilityForm.id) {
        await facilitiesApi.update(facilityForm.id, {
          name: facilityForm.name,
          address: facilityForm.address,
          client_user_id: facilityForm.client_user_id
        });
        alert('施設を更新しました');
      } else {
        await facilitiesApi.create({
          name: facilityForm.name,
          address: facilityForm.address,
          client_user_id: facilityForm.client_user_id
        });
        alert('施設を作成しました');
      }
      setShowFacilityForm(false);
      await loadData();
    } catch (error) {
      setError('施設の保存に失敗しました: ' + error.message);
    }
  };

  const handleDeleteFacility = async (facility) => {
    if (window.confirm(`施設「${facility.name}」を削除しますか？\n関連する清掃記録がある場合は削除できません。`)) {
      try {
        await facilitiesApi.delete(facility.id);
        alert('施設を削除しました');
        await loadData();
      } catch (error) {
        setError('施設の削除に失敗しました: ' + error.message);
      }
    }
  };

  const clientUsers = users.filter(u => u.role === 'client');

  // ===== 施設のフィルタリングとソート =====
  const getFilteredAndSortedFacilities = () => {
    let filtered = [...facilities];

    // 検索フィルター
    if (facilitySearch.trim()) {
      const searchLower = facilitySearch.toLowerCase();
      filtered = filtered.filter(facility => {
        const nameMatch = facility.name?.toLowerCase().includes(searchLower);
        const addressMatch = facility.address?.toLowerCase().includes(searchLower);
        const clientUser = users.find(u => u.id === facility.client_user_id);
        const clientMatch = clientUser?.name?.toLowerCase().includes(searchLower) ||
                           clientUser?.email?.toLowerCase().includes(searchLower);
        return nameMatch || addressMatch || clientMatch;
      });
    }

    // ソート
    filtered.sort((a, b) => {
      let compareA, compareB;

      switch (facilitySortBy) {
        case 'id':
          compareA = a.id;
          compareB = b.id;
          break;
        case 'name':
          compareA = (a.name || '').toLowerCase();
          compareB = (b.name || '').toLowerCase();
          break;
        case 'address':
          compareA = (a.address || '').toLowerCase();
          compareB = (b.address || '').toLowerCase();
          break;
        case 'client':
          const clientA = users.find(u => u.id === a.client_user_id);
          const clientB = users.find(u => u.id === b.client_user_id);
          compareA = (clientA?.name || 'zzz').toLowerCase();
          compareB = (clientB?.name || 'zzz').toLowerCase();
          break;
        default:
          compareA = (a.name || '').toLowerCase();
          compareB = (b.name || '').toLowerCase();
      }

      if (compareA < compareB) return facilitySortOrder === 'asc' ? -1 : 1;
      if (compareA > compareB) return facilitySortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const filteredFacilities = getFilteredAndSortedFacilities();

  // ===== ユーザーのフィルタリングとソート =====
  const getFilteredAndSortedUsers = () => {
    let filtered = [...users];

    // 検索フィルター
    if (userSearch.trim()) {
      const searchLower = userSearch.toLowerCase();
      filtered = filtered.filter(user => {
        const nameMatch = user.name?.toLowerCase().includes(searchLower);
        const emailMatch = user.email?.toLowerCase().includes(searchLower);
        const roleMatch = user.role?.toLowerCase().includes(searchLower);
        const facilitiesMatch = user.facilities?.some(f =>
          f.name?.toLowerCase().includes(searchLower)
        );
        return nameMatch || emailMatch || roleMatch || facilitiesMatch;
      });
    }

    // ソート
    filtered.sort((a, b) => {
      let compareA, compareB;

      switch (userSortBy) {
        case 'name':
          compareA = (a.name || '').toLowerCase();
          compareB = (b.name || '').toLowerCase();
          break;
        case 'email':
          compareA = (a.email || '').toLowerCase();
          compareB = (b.email || '').toLowerCase();
          break;
        case 'role':
          // admin > client > staff の順序
          const roleOrder = { admin: 0, client: 1, staff: 2 };
          compareA = roleOrder[a.role] ?? 99;
          compareB = roleOrder[b.role] ?? 99;
          break;
        case 'created_at':
          compareA = new Date(a.created_at || 0).getTime();
          compareB = new Date(b.created_at || 0).getTime();
          break;
        default:
          compareA = (a.name || '').toLowerCase();
          compareB = (b.name || '').toLowerCase();
      }

      if (compareA < compareB) return userSortOrder === 'asc' ? -1 : 1;
      if (compareA > compareB) return userSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const filteredUsers = getFilteredAndSortedUsers();

  // ===== 日付フォーマット関数 =====
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  if (loading && activeTab === 'overview') {
    return <div style={styles.loading}>読み込み中...</div>;
  }

  return (
    <div style={styles.container}>
      {/* ヘッダー */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.iconCircle}>
            <span style={styles.iconText}>管</span>
          </div>
          <div>
            <h1 style={styles.title}>管理者ダッシュボード</h1>
            <p style={styles.subtitle}>システム管理</p>
          </div>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}>ログアウト</button>
      </div>

      {/* タブメニュー */}
      <div style={styles.tabMenu}>
        <button
          style={activeTab === 'overview' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('overview')}
        >
          概要
        </button>
        <button
          style={activeTab === 'facilities' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('facilities')}
        >
          施設管理
        </button>
        <button
          style={activeTab === 'users' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('users')}
        >
          ユーザー管理
        </button>
        <button
          style={activeTab === 'reports' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('reports')}
        >
          レポート
        </button>
      </div>

      {/* エラー表示 */}
      {error && <div style={styles.error}>{error}</div>}

      {/* タブコンテンツ */}
      <div style={styles.content}>
        {/* 概要タブ */}
        {activeTab === 'overview' && (
          <div>
            <h2 style={styles.sectionTitle}>今日の活動状況</h2>
            <div style={styles.statsGrid}>
              {/* アップロード数カード */}
              <div style={{...styles.statCard, ...styles.statCardBlue}}>
                <div style={styles.statIcon}>📤</div>
                <div style={styles.statNumber}>{stats?.uploads || 0}</div>
                <div style={styles.statLabel}>アップロード数</div>
              </div>

              {/* 施設数カード */}
              <div style={{...styles.statCard, ...styles.statCardGreen}}>
                <div style={styles.statIcon}>🏢</div>
                <div style={styles.statNumber}>{stats?.facilities || 0}</div>
                <div style={styles.statLabel}>施設数</div>
              </div>

              {/* 写真枚数カード */}
              <div style={{...styles.statCard, ...styles.statCardPurple}}>
                <div style={styles.statIcon}>📷</div>
                <div style={styles.statNumber}>{stats?.photos || 0}</div>
                <div style={styles.statLabel}>写真枚数</div>
              </div>

              {/* 失敗数カード */}
              <div style={{...styles.statCard, ...styles.statCardRed}}>
                <div style={styles.statIcon}>⚠️</div>
                <div style={styles.statNumber}>{stats?.failures || 0}</div>
                <div style={styles.statLabel}>失敗数</div>
              </div>
            </div>

            {/* 最近のアップロード */}
            <h2 style={styles.sectionTitle}>最近のアップロード</h2>
            <div style={styles.uploadsList}>
              {recentUploads.map((upload) => (
                <div key={upload.id} style={styles.uploadItem}>
                  <div style={styles.uploadIcon}>📄</div>
                  <div style={styles.uploadInfo}>
                    <div style={styles.uploadFacility}>{upload.facility_name}</div>
                    <div style={styles.uploadMeta}>
                      {formatDate(upload.uploaded_at)} - {upload.staff_name || '不明'}
                    </div>
                  </div>
                  <div style={styles.uploadCount}>{upload.photo_count}枚</div>
                </div>
              ))}
              {recentUploads.length === 0 && (
                <div style={styles.emptyState}>
                  <p>まだアップロードがありません</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 施設管理タブ */}
        {activeTab === 'facilities' && (
          <div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>施設管理</h2>
              <button onClick={handleCreateFacility} style={styles.createBtn}>
                新規施設作成
              </button>
            </div>

            {/* 検索・ソートコントロール */}
            <div style={styles.filterBar}>
              <div style={styles.searchBox}>
                <span style={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="施設名、住所、クライアント名で検索..."
                  value={facilitySearch}
                  onChange={(e) => setFacilitySearch(e.target.value)}
                  style={styles.searchInput}
                />
                {facilitySearch && (
                  <button
                    onClick={() => setFacilitySearch('')}
                    style={styles.clearBtn}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div style={styles.sortControls}>
                <label style={styles.sortLabel}>並び順:</label>
                <select
                  value={facilitySortBy}
                  onChange={(e) => setFacilitySortBy(e.target.value)}
                  style={styles.sortSelect}
                >
                  <option value="name">施設名</option>
                  <option value="id">ID</option>
                  <option value="client">担当クライアント</option>
                  <option value="address">住所</option>
                </select>
                <button
                  onClick={() => setFacilitySortOrder(facilitySortOrder === 'asc' ? 'desc' : 'asc')}
                  style={styles.sortOrderBtn}
                  title={facilitySortOrder === 'asc' ? '昇順' : '降順'}
                >
                  {facilitySortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* 検索結果表示 */}
            {facilitySearch && (
              <div style={styles.searchResultInfo}>
                {filteredFacilities.length}件の施設が見つかりました
              </div>
            )}

            {showFacilityForm && (
              <form onSubmit={handleSaveFacility} style={styles.form}>
                <h3>{facilityForm.id ? '施設編集' : '新規施設作成'}</h3>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label>施設名*</label>
                    <input
                      type="text"
                      value={facilityForm.name}
                      onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                      required
                      style={styles.input}
                      placeholder="例: 清掃センター本社"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label>住所</label>
                    <input
                      type="text"
                      value={facilityForm.address}
                      onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })}
                      style={styles.input}
                      placeholder="例: 東京都港区..."
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label>担当クライアント</label>
                    <select
                      value={facilityForm.client_user_id || ''}
                      onChange={(e) => setFacilityForm({
                        ...facilityForm,
                        client_user_id: e.target.value ? parseInt(e.target.value) : null
                      })}
                      style={styles.select}
                    >
                      <option value="">未割り当て</option>
                      {clientUsers.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({client.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={styles.formActions}>
                  <button type="submit" style={styles.submitBtn}>
                    {facilityForm.id ? '更新' : '作成'}
                  </button>
                  <button type="button" onClick={() => setShowFacilityForm(false)} style={styles.cancelBtn}>
                    キャンセル
                  </button>
                </div>
              </form>
            )}

            <div style={styles.facilityGrid}>
              {filteredFacilities.map(facility => {
                const assignedClient = users.find(u => u.id === facility.client_user_id);
                return (
                  <div key={facility.id} style={styles.facilityCard}>
                    <div style={styles.facilityHeader}>
                      <h3 style={styles.facilityName}>{facility.name}</h3>
                      <span style={styles.facilityId}>ID: {facility.id}</span>
                    </div>
                    {facility.address && (
                      <p style={styles.facilityAddress}>📍 {facility.address}</p>
                    )}
                    <div style={styles.facilityInfo}>
                      <p>
                        <strong>担当クライアント:</strong>{' '}
                        {assignedClient ? `${assignedClient.name}` : '未割り当て'}
                      </p>
                    </div>
                    <div style={styles.facilityActions}>
                      <button onClick={() => handleEditFacility(facility)} style={styles.editBtn}>
                        編集
                      </button>
                      <button onClick={() => handleDeleteFacility(facility)} style={styles.deleteBtn}>
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredFacilities.length === 0 && facilitySearch && (
              <div style={styles.emptyState}>
                <p>検索条件に一致する施設が見つかりませんでした</p>
                <button onClick={() => setFacilitySearch('')} style={styles.createBtn}>
                  検索をクリア
                </button>
              </div>
            )}

            {facilities.length === 0 && !showFacilityForm && !facilitySearch && (
              <div style={styles.emptyState}>
                <p>施設が登録されていません</p>
                <button onClick={handleCreateFacility} style={styles.createBtn}>
                  最初の施設を作成
                </button>
              </div>
            )}
          </div>
        )}

        {/* ユーザー管理タブ */}
        {activeTab === 'users' && (
          <div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>ユーザー管理</h2>
              <button onClick={() => setShowCreateForm(!showCreateForm)} style={styles.createBtn}>
                {showCreateForm ? 'キャンセル' : '新規ユーザー作成'}
              </button>
            </div>

            {/* 検索・ソートコントロール */}
            <div style={styles.filterBar}>
              <div style={styles.searchBox}>
                <span style={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="名前、メール、ロール、施設名で検索..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={styles.searchInput}
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch('')}
                    style={styles.clearBtn}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div style={styles.sortControls}>
                <label style={styles.sortLabel}>並び順:</label>
                <select
                  value={userSortBy}
                  onChange={(e) => setUserSortBy(e.target.value)}
                  style={styles.sortSelect}
                >
                  <option value="name">名前</option>
                  <option value="email">メールアドレス</option>
                  <option value="role">ロール</option>
                  <option value="created_at">作成日時</option>
                </select>
                <button
                  onClick={() => setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc')}
                  style={styles.sortOrderBtn}
                  title={userSortOrder === 'asc' ? '昇順' : '降順'}
                >
                  {userSortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* 検索結果表示 */}
            {userSearch && (
              <div style={styles.searchResultInfo}>
                {filteredUsers.length}人のユーザーが見つかりました
              </div>
            )}

            {showCreateForm && (
              <form onSubmit={handleCreateUser} style={styles.form}>
                <h3>新規ユーザー作成</h3>
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label>メールアドレス*</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label>名前*</label>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      required
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label>ロール*</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      style={styles.select}
                    >
                      <option value="staff">スタッフ</option>
                      <option value="client">クライアント</option>
                      <option value="admin">管理者</option>
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label>初期パスワード*</label>
                    <div style={styles.passwordGroup}>
                      <input
                        type="text"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        required
                        minLength="6"
                        style={styles.input}
                      />
                      <button type="button" onClick={generateRandomPassword} style={styles.generateBtn}>
                        自動生成
                      </button>
                    </div>
                  </div>
                </div>

                {newUser.role === 'staff' && (
                  <div style={styles.formGroup}>
                    <label>担当施設</label>
                    <div style={styles.facilityList}>
                      {facilities.map(facility => (
                        <label key={facility.id} style={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={newUser.facilityIds.includes(facility.id)}
                            onChange={(e) => {
                              const facilityIds = e.target.checked
                                ? [...newUser.facilityIds, facility.id]
                                : newUser.facilityIds.filter(id => id !== facility.id);
                              setNewUser({ ...newUser, facilityIds });
                            }}
                          />
                          {facility.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div style={styles.formActions}>
                  <button type="submit" style={styles.submitBtn}>作成</button>
                  <button type="button" onClick={() => setShowCreateForm(false)} style={styles.cancelBtn}>
                    キャンセル
                  </button>
                </div>
              </form>
            )}

            {filteredUsers.length > 0 ? (
              <div style={styles.userList}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>メール</th>
                      <th>ロール</th>
                      <th>担当施設</th>
                      <th>状態</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span style={styles.roleBadge(user.role)}>
                            {user.role === 'staff' ? 'スタッフ' :
                             user.role === 'client' ? 'クライアント' : '管理者'}
                          </span>
                        </td>
                        <td>
                          {user.facilities && user.facilities.length > 0
                            ? user.facilities.map(f => f.name).join(', ')
                            : '-'
                          }
                        </td>
                        <td>
                          <span style={styles.statusBadge(user.is_active)}>
                            {user.is_active ? '有効' : '無効'}
                          </span>
                        </td>
                        <td>
                          <div style={styles.actions}>
                            <button onClick={() => handleResetPassword(user.id, user.name)} style={styles.actionBtn}>
                              パスワードリセット
                            </button>
                            {user.id !== currentUser.id && (
                              <button onClick={() => handleDeleteUser(user.id, user.name)} style={styles.actionBtnDanger}>
                                削除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={styles.emptyState}>
                {userSearch ? (
                  <>
                    <p>検索条件に一致するユーザーが見つかりませんでした</p>
                    <button onClick={() => setUserSearch('')} style={styles.createBtn}>
                      検索をクリア
                    </button>
                  </>
                ) : (
                  <p>ユーザーが登録されていません</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* レポートタブ */}
        {activeTab === 'reports' && (
          <div style={styles.emptyState}>
            <h2>レポート機能</h2>
            <p>準備中です</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== スタイル定義 =====
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  header: {
    backgroundColor: '#fff',
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  iconCircle: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    backgroundColor: '#9333ea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconText: {
    color: '#fff',
    fontSize: '20px',
    fontWeight: 'bold'
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333'
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#666'
  },
  logoutBtn: {
    padding: '10px 24px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  },
  tabMenu: {
    backgroundColor: '#fff',
    padding: '0 40px',
    display: 'flex',
    gap: '0',
    borderBottom: '2px solid #e0e0e0'
  },
  tab: {
    padding: '16px 32px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '500',
    color: '#666',
    transition: 'all 0.2s'
  },
  tabActive: {
    padding: '16px 32px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid #9333ea',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    color: '#9333ea'
  },
  content: {
    padding: '40px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '20px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
    marginBottom: '40px'
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    textAlign: 'center',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  statCardBlue: {
    backgroundColor: '#e3f2fd'
  },
  statCardGreen: {
    backgroundColor: '#e8f5e9'
  },
  statCardPurple: {
    backgroundColor: '#f3e5f5'
  },
  statCardRed: {
    backgroundColor: '#ffebee'
  },
  statIcon: {
    fontSize: '32px',
    marginBottom: '12px'
  },
  statNumber: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '8px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '500'
  },
  uploadsList: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  uploadItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #f0f0f0',
    transition: 'background-color 0.2s'
  },
  uploadIcon: {
    fontSize: '28px',
    marginRight: '16px'
  },
  uploadInfo: {
    flex: 1
  },
  uploadFacility: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '4px'
  },
  uploadMeta: {
    fontSize: '13px',
    color: '#999'
  },
  uploadCount: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '500'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  createBtn: {
    padding: '12px 24px',
    backgroundColor: '#9333ea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background-color 0.2s'
  },
  form: {
    backgroundColor: '#fff',
    padding: '32px',
    borderRadius: '12px',
    marginBottom: '32px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '24px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    transition: 'border-color 0.2s'
  },
  select: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#fff'
  },
  passwordGroup: {
    display: 'flex',
    gap: '12px'
  },
  generateBtn: {
    padding: '12px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  facilityList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end'
  },
  submitBtn: {
    padding: '12px 32px',
    backgroundColor: '#9333ea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  cancelBtn: {
    padding: '12px 32px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  facilityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px'
  },
  facilityCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.2s, transform 0.2s'
  },
  facilityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: '12px'
  },
  facilityName: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#333'
  },
  facilityId: {
    fontSize: '12px',
    color: '#999',
    backgroundColor: '#f5f5f5',
    padding: '4px 10px',
    borderRadius: '12px'
  },
  facilityAddress: {
    margin: '12px 0',
    fontSize: '14px',
    color: '#666'
  },
  facilityInfo: {
    margin: '16px 0',
    fontSize: '14px',
    color: '#555'
  },
  facilityActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid #f0f0f0'
  },
  editBtn: {
    flex: 1,
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  deleteBtn: {
    flex: 1,
    padding: '10px 20px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  userList: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  roleBadge: (role) => ({
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: role === 'admin' ? '#dc3545' : role === 'client' ? '#28a745' : '#007bff',
    color: 'white',
    display: 'inline-block'
  }),
  statusBadge: (isActive) => ({
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: isActive ? '#28a745' : '#6c757d',
    color: 'white',
    display: 'inline-block'
  }),
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  actionBtn: {
    padding: '6px 12px',
    backgroundColor: '#ffc107',
    color: '#212529',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  },
  actionBtnDanger: {
    padding: '6px 12px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    fontSize: '18px',
    color: '#666'
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '16px 24px',
    borderRadius: '8px',
    margin: '0 40px 24px',
    fontSize: '14px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  filterBar: {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  searchBox: {
    flex: '1 1 300px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    fontSize: '18px',
    pointerEvents: 'none'
  },
  searchInput: {
    width: '100%',
    padding: '12px 40px 12px 40px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
    outline: 'none'
  },
  clearBtn: {
    position: 'absolute',
    right: '8px',
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '50%',
    backgroundColor: '#e0e0e0',
    color: '#666',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s'
  },
  sortControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  sortLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    whiteSpace: 'nowrap'
  },
  sortSelect: {
    padding: '10px 16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  sortOrderBtn: {
    width: '40px',
    height: '40px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#fff',
    color: '#666',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchResultInfo: {
    padding: '12px 20px',
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    fontWeight: '500'
  }
};

// テーブルのスタイル（CSSが必要）
const tableStyles = `
  table th, table td {
    padding: 14px 16px;
    text-align: left;
    border-bottom: 1px solid #f0f0f0;
  }
  table th {
    background-color: #f8f9fa;
    font-weight: 600;
    font-size: 13px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  table tr:hover {
    background-color: #f9f9f9;
  }
  table tbody tr:last-child td {
    border-bottom: none;
  }
`;

// スタイルをheadに追加
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = tableStyles;
  document.head.appendChild(style);
}

export default AdminDashboard;
