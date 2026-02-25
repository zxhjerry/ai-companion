/**
 * Inventory Item Component
 * 展示单个道具（包含稀有度、属性、效果）
 */

import React from 'react';

interface ItemStats {
  [key: string]: number;
}

interface InventoryItemProps {
  itemId: string;
  name: string;
  type: string;
  rarity: number;
  stats: ItemStats;
  effectDescription: string;
  iconUrl?: string;
  onUse?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
}

export const InventoryItem: React.FC<InventoryItemProps> = ({
  itemId,
  name,
  type,
  rarity,
  stats,
  effectDescription,
  iconUrl,
  onUse,
  onDelete
}) => {
  // 稀有度映射
  const getRarityInfo = (rarityScore: number) => {
    if (rarityScore >= 96) return {
      name: '传說',
      color: '#ff7675',
      bgColor: 'rgba(255, 118, 117, 0.15)',
      borderColor: 'rgba(255, 118, 117, 0.5)',
      grade: 'SSS'
    };
    if (rarityScore >= 81) return {
      name: '史诗',
      color: '#fd79a8',
      bgColor: 'rgba(253, 121, 168, 0.15)',
      borderColor: 'rgba(253, 121, 168, 0.5)',
      grade: 'SS'
    };
    if (rarityScore >= 51) return {
      name: '稀有',
      color: '#a29bfe',
      bgColor: 'rgba(162, 155, 254, 0.15)',
      borderColor: 'rgba(162, 155, 254, 0.5)',
      grade: 'S'
    };
    if (rarityScore >= 21) return {
      name: '不常见',
      color: '#0984e3',
      bgColor: 'rgba(9, 132, 227, 0.15)',
      borderColor: 'rgba(9, 132, 227, 0.5)',
      grade: 'A'
    };
    return {
      name: '常見',
      color: '#6c5ce7',
      bgColor: 'rgba(108, 92, 231, 0.15)',
      borderColor: 'rgba(108, 92, 231, 0.5)',
      grade: 'B'
    };
  };

  const rarityInfo = getRarityInfo(rarity);

  // 道具类型映射
  const getTypeEmoji = (itemType: string) => {
    const types: { [key: string]: string } = {
      'weapon': '⚔️',
      'armor': '🛡️',
      'accessory': '💍',
      'potion': '🧪',
      'material': '💎',
      'special': '⭐',
      'gift': '🎁'
    };
    return types[itemType] || '📦';
  };

  return (
    <div
      className="inventory-item"
      style={{
        background: rarityInfo.bgColor,
        border: `2px solid ${rarityInfo.borderColor}`,
        borderRadius: '15px',
        padding: '16px',
        marginBottom: '12px',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateX(8px)';
        e.currentTarget.style.boxShadow = `0 8px 20px ${rarityInfo.color}33`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* 稀有度发光效果 */}
      {rarityScore >= 81 && (
        <div style={{
          position: 'absolute',
          top: '-10px',
          right: '-10px',
          width: '50px',
          height: '50px',
          background: rarityInfo.color,
          borderRadius: '50%',
          filter: 'blur(20px)',
          opacity: 0.3,
          animation:稀有度发光 ' 3s ease-in-out infinite',
        }} />
      )}

      {/* 道具图标 + 名称 */}
      <div className="item-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{
            fontSize: '32px',
            filter: rarity >= 81 ? 'drop-shadow(0 0 8px currentColor)' : 'none',
          }}>
            {iconUrl ? <img src={iconUrl} alt={name} style={{ width: '32px', height: '32px' }} /> : getTypeEmoji(type)}
          </span>
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: rarityInfo.color,
              margin: 0,
            }}>
              {name}
            </h3>
            <div className="item-meta"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#707080',
              }}>
              <span className="rarity-badge"
                style={{
                  padding: '2px 10px',
                  borderRadius: '10px',
                  background: rarityInfo.color + '20',
                  color: rarityInfo.color,
                  fontWeight: 'bold',
                }}>
                {rarityInfo.grade} {rarityInfo.name}
              </span>
              <span>稀有度 {rarity}/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* 属性显示 */}
      <div className="item-stats"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '8px',
          marginBottom: '12px',
        }}>
        {Object.entries(stats).map(([statName, value]) => (
          <div key={statName}
            style={{
              padding: '8px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              textAlign: 'center',
            }}>
            <div style={{ fontSize: '10px', color: '#a0a0b0', marginBottom: '2px', textTransform: 'uppercase' }}>
              {statName}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: rarityInfo.color }}>
              +{value}
            </div>
          </div>
        ))}
      </div>

      {/* 效果描述 */}
      <div className="item-description"
        style={{
          fontSize: '13px',
          color: '#a0a0b0',
          fontStyle: 'italic',
          marginBottom: '12px',
          lineHeight: 1.5,
        }}>
        "{effectDescription}"
      </div>

      {/* 操作按钮 */}
      <div className="item-actions"
        style={{
          display: 'flex',
          gap: '8px',
        }}>
        <button
          className="use-button"
          onClick={() => onUse?.(itemId)}
          style={{
            flex: 1,
            padding: '8px 16px',
            borderRadius: '10px',
            background: rarity >= 81 ? rarityInfo.color : '#6c5ce7',
            color: 'white',
            border: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          使用
        </button>

        {onDelete && (
          <button
            className="delete-button"
            onClick={() => onDelete?.(itemId)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              background: '#ff767520',
              color: '#ff7675',
              border: '2px solid #ff767533',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ff7675';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ff767520';
              e.currentTarget.style.color = '#ff7675';
            }}
          >
            删除
          </button>
        )}
      </div>

      {/* CSS 动画 */}
      <style jsx>{`
        @keyframes rare-glow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
};

export default InventoryItem;
