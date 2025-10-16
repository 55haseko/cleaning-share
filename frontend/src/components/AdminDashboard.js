// ===== frontend/src/components/AdminDashboard.js =====
// 管理者ダッシュボード

import React, { useState, useEffect } from 'react';
import { usersApi } from '../api/users.js';

const AdminDashboard = ({ currentUser, onLogout }) => {
  const [users, setUsers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, facilitiesData] = await Promise.all([
        usersApi.getUsers(),
        usersApi.getFacilities()
      ]);
      setUsers(usersData);
      setFacilities(facilitiesData);
    } catch (error) {
      setError('データの読み込みに失敗しました: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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
      await loadData(); // ユーザー一覧を再読み込み
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

  if (loading) return <div style={styles.loading}>読み込み中...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>管理者ダッシュボード</h1>
        <div style={styles.userInfo}>
          <span>{currentUser.name}さん</span>
          <button onClick={onLogout} style={styles.logoutBtn}>ログアウト</button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2>ユーザー管理</h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={styles.createBtn}
          >
            {showCreateForm ? 'キャンセル' : '新規ユーザー作成'}
          </button>
        </div>

        {/* 新規ユーザー作成フォーム */}
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
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    style={styles.generateBtn}
                  >
                    自動生成
                  </button>
                </div>
              </div>
            </div>

            {/* 施設選択（スタッフの場合のみ） */}
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
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={styles.cancelBtn}
              >
                キャンセル
              </button>
            </div>
          </form>
        )}

        {/* ユーザー一覧 */}
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
              {users.map(user => (
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
                      <button
                        onClick={() => handleResetPassword(user.id, user.name)}
                        style={styles.actionBtn}
                      >
                        パスワードリセット
                      </button>
                      {user.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          style={styles.deleteBtn}
                        >
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
      </div>
    </div>
  );
};

// スタイル定義
const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    borderBottom: '2px solid #e0e0e0',
    paddingBottom: '20px'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  logoutBtn: {
    padding: '8px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  loading: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '18px'
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '20px'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  createBtn: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  form: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '30px'
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '15px',
    marginBottom: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  },
  passwordGroup: {
    display: 'flex',
    gap: '10px'
  },
  generateBtn: {
    padding: '8px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  facilityList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  formActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end'
  },
  submitBtn: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '20px'
  },
  roleBadge: (role) => ({
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    backgroundColor: role === 'admin' ? '#dc3545' : role === 'client' ? '#28a745' : '#007bff',
    color: 'white'
  }),
  statusBadge: (isActive) => ({
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    backgroundColor: isActive ? '#28a745' : '#6c757d',
    color: 'white'
  }),
  actions: {
    display: 'flex',
    gap: '5px'
  },
  actionBtn: {
    padding: '4px 8px',
    backgroundColor: '#ffc107',
    color: '#212529',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  deleteBtn: {
    padding: '4px 8px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  }
};

// テーブルのスタイル（CSSが必要）
const tableStyles = `
  table th, table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }
  table th {
    background-color: #f8f9fa;
    font-weight: bold;
  }
  table tr:hover {
    background-color: #f5f5f5;
  }
`;

// スタイルをheadに追加
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = tableStyles;
  document.head.appendChild(style);
}

export default AdminDashboard;