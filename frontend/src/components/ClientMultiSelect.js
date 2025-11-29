// ===== frontend/src/components/ClientMultiSelect.js =====
// 複数クライアント選択コンポーネント（チェックボックス方式）

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

const ClientMultiSelect = ({
  clients = [],
  selectedIds = [],
  onChange,
  label = 'クライアント選択',
  isRequired = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 検索フィルタ処理
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // チェックボックス変更処理
  const handleToggleClient = (clientId) => {
    const newSelectedIds = selectedIds.includes(clientId)
      ? selectedIds.filter(id => id !== clientId)
      : [...selectedIds, clientId];
    onChange(newSelectedIds);
  };

  // 全選択
  const handleSelectAll = () => {
    const filteredIds = filteredClients.map(c => c.id);
    onChange(filteredIds);
  };

  // 全解除
  const handleDeselectAll = () => {
    onChange([]);
  };

  // 選択されたクライアント情報取得
  const selectedClients = clients.filter(c => selectedIds.includes(c.id));

  return (
    <div style={styles.container}>
      <label style={styles.label}>
        {label}
        {isRequired && <span style={styles.required}>*</span>}
      </label>

      {/* ドロップダウンボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.dropdownButton,
          borderColor: isOpen ? '#2196F3' : '#ddd',
          backgroundColor: isOpen ? '#f0f8ff' : '#fff'
        }}
      >
        <div style={styles.buttonContent}>
          <span style={styles.buttonLabel}>
            {selectedIds.length === 0
              ? '選択してください'
              : `${selectedIds.length}個選択中`}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* 選択済みクライアント表示 */}
      {selectedIds.length > 0 && (
        <div style={styles.selectedList}>
          {selectedClients.map(client => (
            <div key={client.id} style={styles.selectedItem}>
              <span>{client.name}</span>
              <button
                type="button"
                onClick={() => handleToggleClient(client.id)}
                style={styles.removeBtn}
                title="削除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div style={styles.dropdownMenu}>
          {/* 検索入力 */}
          {clients.length > 5 && (
            <input
              type="text"
              placeholder="クライアント名またはメールで検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {/* 全選択/全解除ボタン */}
          <div style={styles.toolbarButtons}>
            <button
              type="button"
              onClick={handleSelectAll}
              style={styles.toolbarBtn}
            >
              すべて選択
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              style={styles.toolbarBtn}
            >
              すべて解除
            </button>
          </div>

          {/* チェックボックスリスト */}
          <div style={styles.checkboxList}>
            {filteredClients.length === 0 ? (
              <div style={styles.noResults}>
                検索結果がありません
              </div>
            ) : (
              filteredClients.map(client => (
                <label key={client.id} style={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(client.id)}
                    onChange={() => handleToggleClient(client.id)}
                    style={styles.checkbox}
                  />
                  <div style={styles.clientInfo}>
                    <div style={styles.clientName}>{client.name}</div>
                    <div style={styles.clientEmail}>{client.email}</div>
                  </div>
                  {selectedIds.includes(client.id) && (
                    <Check style={styles.checkIcon} className="w-5 h-5" />
                  )}
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {/* 注記 */}
      {isRequired && (
        <p style={styles.note}>
          ℹ️ 複数選択可能です。最低1人以上のクライアント選択が必要です。
        </p>
      )}
    </div>
  );
};

const styles = {
  container: {
    width: '100%'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '500',
    fontSize: '14px',
    color: '#333'
  },
  required: {
    color: '#d32f2f',
    marginLeft: '4px'
  },
  dropdownButton: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  buttonContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: '12px'
  },
  buttonLabel: {
    color: '#666',
    flex: 1,
    textAlign: 'left'
  },
  selectedList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#f0f8ff',
    borderRadius: '6px',
    border: '1px solid #b3d9ff'
  },
  selectedItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: '#2196F3',
    color: 'white',
    borderRadius: '16px',
    fontSize: '13px'
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    padding: '0',
    fontSize: '14px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: '0',
    right: '0',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderTop: 'none',
    borderRadius: '0 0 6px 6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 1000,
    maxHeight: '400px',
    overflowY: 'auto',
    marginTop: '-1px'
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    borderBottom: '1px solid #eee',
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none'
  },
  toolbarButtons: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid #eee',
    backgroundColor: '#fafafa'
  },
  toolbarBtn: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  checkboxList: {
    maxHeight: '300px',
    overflowY: 'auto'
  },
  checkboxItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    borderBottom: '1px solid #f0f0f0'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    marginTop: '2px',
    cursor: 'pointer',
    accentColor: '#2196F3'
  },
  clientInfo: {
    flex: 1,
    minWidth: 0
  },
  clientName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#333',
    marginBottom: '2px'
  },
  clientEmail: {
    fontSize: '12px',
    color: '#999',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  checkIcon: {
    color: '#2196F3',
    flexShrink: 0
  },
  noResults: {
    padding: '20px 16px',
    textAlign: 'center',
    color: '#999',
    fontSize: '13px'
  },
  note: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#666',
    margin: '8px 0 0 0'
  }
};

export default ClientMultiSelect;
