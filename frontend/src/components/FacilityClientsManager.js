// ===== frontend/src/components/FacilityClientsManager.js =====
// 施設に割り当てたクライアントを管理するコンポーネント

import React, { useState, useEffect } from 'react';
import { facilitiesApi } from '../api/facilities.js';

const FacilityClientsManager = ({ facilityId, clientUsers, onUpdate }) => {
  const [assignedClients, setAssignedClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClient, setSelectedClient] = useState('');

  useEffect(() => {
    loadAssignedClients();
  }, [facilityId]);

  const loadAssignedClients = async () => {
    try {
      setLoading(true);
      const clients = await facilitiesApi.getClients(facilityId);
      setAssignedClients(clients);
      setError('');
    } catch (err) {
      setError('クライアント一覧の読み込みに失敗しました: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async () => {
    if (!selectedClient) {
      setError('クライアントを選択してください');
      return;
    }

    const clientId = parseInt(selectedClient);

    // 既に割り当てられているかチェック
    if (assignedClients.find(c => c.id === clientId)) {
      setError('このクライアントは既に割り当てられています');
      return;
    }

    try {
      await facilitiesApi.addClient(facilityId, clientId);
      setSelectedClient('');
      await loadAssignedClients();
      onUpdate && onUpdate();
    } catch (err) {
      setError('クライアント割当に失敗しました: ' + err.message);
    }
  };

  const handleRemoveClient = async (clientId) => {
    // 最後1人のクライアントの場合は削除不可
    if (assignedClients.length === 1) {
      setError('施設には最低1人のクライアントが必要です');
      return;
    }

    if (!window.confirm('このクライアントを削除しますか?')) return;

    try {
      await facilitiesApi.removeClient(facilityId, clientId);
      await loadAssignedClients();
      onUpdate && onUpdate();
    } catch (err) {
      setError('クライアント削除に失敗しました: ' + err.message);
    }
  };

  const availableClients = clientUsers.filter(
    u => !assignedClients.find(c => c.id === u.id)
  );

  return (
    <div style={{
      padding: '12px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#f9f9f9',
      marginTop: '12px'
    }}>
      <h4 style={{ marginTop: 0 }}>📌 割当クライアント管理</h4>

      {error && (
        <div style={{
          color: '#d32f2f',
          padding: '8px',
          backgroundColor: '#ffebee',
          borderRadius: '4px',
          marginBottom: '8px',
          fontSize: '0.875rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <>
          {/* 割り当てられたクライアント一覧 */}
          <div style={{ marginBottom: '12px' }}>
            <p style={{ marginTop: 0, marginBottom: '8px', fontWeight: 'bold' }}>現在の割当:</p>
            {assignedClients.length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.875rem' }}>割り当てられたクライアントがありません</p>
            ) : (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px'
              }}>
                {assignedClients.map(client => (
                  <div
                    key={client.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '4px',
                      fontSize: '0.875rem'
                    }}
                  >
                    <span>{client.name} ({client.email})</span>
                    <button
                      onClick={() => handleRemoveClient(client.id)}
                      style={{
                        padding: '2px 6px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* クライアント追加フォーム */}
          {availableClients.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-end'
            }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem' }}>
                  クライアント追加:
                </label>
                <select
                  value={selectedClient}
                  onChange={(e) => {
                    setSelectedClient(e.target.value);
                    setError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '6px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">-- 選択してください --</option>
                  {availableClients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} ({client.email})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddClient}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                追加
              </button>
            </div>
          )}

          {availableClients.length === 0 && assignedClients.length > 0 && (
            <p style={{ color: '#666', fontSize: '0.875rem', marginTop: '8px' }}>
              ℹ️ すべてのクライアントが割り当てられています
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default FacilityClientsManager;
