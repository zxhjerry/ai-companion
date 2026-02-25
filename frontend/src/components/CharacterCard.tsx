/**
 * Character Card Component
 * 展示角色详细信息（包含五维数值展示）
 */

import React from 'react';

interface CharacterStats {
  strength: number;
  intelligence: number;
  charisma: number;
  appearance: number;
  luck?: number;  // 可选：用于后端调试，前端通常不显示
}

interface CharacterCardProps {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  appearance: number;  // APP 颜值（显性）
  stats: CharacterStats;
  personality?: string;
  relationshipLevel: number;
  avatar?: string;
  onSelect?: (id: string) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  id,
  name,
  gender,
  appearance,
  stats,
  personality,
  relationshipLevel,
  avatar,
  onSelect
}) => {
  // 智能计算颜值等级显示
  const getAppearanceGrade = (score: number) => {
    if (score >= 95) return { grade: 'S', color: '#ff7675', label: '绝美' };
    if (score >= 85) return { grade: 'A+', color: '#fd79a8', label: '超凡' };
    if (score >= 70) return { grade: 'A', color: '#a29bfe', label: '优秀' };
    if (score >= 60) return { grade: 'B+', color: '#6c5ce7', label: '良好' };
    if (score >= 50) return { grade: 'B', color: '#0984e3', label: '普通' };
    return { grade: 'C', color: '#b2bec3', label: '一般' };
  };

  const appearanceGrade = getAppearanceGrade(appearance);

  // 五维数值展示的百分比值
  const statValue = (value: number) => Math.min(100, Math.max(0, value));

  // 获取性别 Emoji
  const genderEmoji = gender === 'female' ? '👩' : gender === 'male' ? '👨' : '🧑';

  return (
    <div
      className="character-card"
      onClick={() => onSelect?.(id)}
      style={{
        background: 'rgba(26, 26, 46, 0.8)',
        border: '2px solid rgba(108, 92, 231, 0.2)',
        borderRadius: '20px',
        padding: '24px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
        e.currentTarget.style.boxShadow = '0 20px 40px rgba(108, 92, 231, 0.2)';
        e.currentTarget.style.borderColor = 'rgba(0, 206, 201, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'rgba(108, 92, 231, 0.2)';
      }}
    >
      {/* 头像区域 */}
      <div className="character-avatar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
        }}>
        <div className="avatar-circle"
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: appearance >= 85
              ? 'linear-gradient(135deg, #ff7675, #fd79a8, #00cec9)'
              : 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
            border: '3px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: 'bold',
            boxShadow: appearance >= 85
              ? '0 0 30px rgba(255, 118, 117, 0.4), 0 0 60px rgba(0, 206, 201, 0.2)'
              : '0 0 20px rgba(108, 92, 231, 0.3)',
            animation: appearance >= 85 ? 'avatar-glow 2s ease-in-out infinite' : 'none',
          }}>
          {avatar ? (
            <img src={avatar} alt={name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          ) : (
            <span>{genderEmoji} {name.charAt(0)}</span>
          )}
        </div>
      </div>

      {/* 角色名称 + 颜值等级 */}
      <div className="character-name-section"
        style={{
          textAlign: 'center',
          marginBottom: '16px',
        }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          margin: '0 0 8px 0',
          background: 'linear-gradient(135deg, #a29bfe, #00cec9, #ff7675)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          {name}
        </h2>
        <div className="appearance-badge"
          style={{
            display: 'inline-block',
            padding: '6px 16px',
            borderRadius: '20px',
            background: appearanceGrade.color + '20',
            color: appearanceGrade.color,
            fontWeight: 'bold',
            fontSize: '14px',
            letterSpacing: '0.5px',
          }}>
          <span style={{ fontSize: '18px', marginRight: '4px' }}>✨</span>
          颜值 {appearance}/100 · {appearanceGrade.label}
        </div>
      </div>

      {/* 五维数值展示 */}
      <div className="stats-container"
        style={{
          marginBottom: '16px',
        }}>
        <div className="stat-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
          <span style={{ width: '50px', fontSize: '14px', fontWeight: '600' }}>⚔️ 力量</span>
          <div style={{
            flex: 1,
            height: '8px',
            background: 'rgba(108, 92, 231, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginLeft: '12px',
          }}>
            <div style={{
              width: `${statValue(stats.strength)}%`,
              height: '100%',
              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{
            marginLeft: '8px',
            fontSize: '12px',
            fontWeight: 'bold',
            minWidth: '30px',
            textAlign: 'right',
          }}>
            {stats.strength}
          </span>
        </div>

        <div className="stat-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
          <span style={{ width: '50px', fontSize: '14px', fontWeight: '600' }}>🧠 智力</span>
          <div style={{
            flex: 1,
            height: '8px',
            background: 'rgba(0, 206, 201, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginLeft: '12px',
          }}>
            <div style={{
              width: `${statValue(stats.intelligence)}%`,
              height: '100%',
              background: 'linear-gradient(135deg, #00cec9, #81ecec)',
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{
            marginLeft: '8px',
            fontSize: '12px',
            fontWeight: 'bold',
            minWidth: '30px',
            textAlign: 'right',
          }}>
            {stats.intelligence}
          </span>
        </div>

        <div className="stat-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
          <span style={{ width: '50px', fontSize: '14px', fontWeight: '600' }}>✨ 魅力</span>
          <div style={{
            flex: 1,
            height: '8px',
            background: 'rgba(255, 118, 117, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginLeft: '12px',
          }}>
            <div style={{
              width: `${statValue(stats.charisma)}%`,
              height: '100%',
              background: 'linear-gradient(135deg, #ff7675, #fd79a8)',
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{
            marginLeft: '8px',
            fontSize: '12px',
            fontWeight: 'bold',
            minWidth: '30px',
            textAlign: 'right',
          }}>
            {stats.charisma}
          </span>
        </div>

        <div className="stat-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
          }}>
          <span style={{ width: '50px', fontSize: '14px', fontWeight: '600' }}>🌟 颜值</span>
          <div style={{
            flex: 1,
            height: '8px',
            background: 'rgba(162, 155, 254, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginLeft: '12px',
          }}>
            <div style={{
              width: `${statValue(stats.appearance)}%`,
              height: '100%',
              background: 'linear-gradient(135deg, #a29bfe, #00cec9)',
              borderRadius: '4px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{
            marginLeft: '8px',
            fontSize: '12px',
            fontWeight: 'bold',
            minWidth: '30px',
            textAlign: 'right',
          }}>
            {stats.appearance}
          </span>
        </div>
      </div>

      {/* 好感度 */}
      {personality && (
        <div className="relationship-display"
          style={{
            marginTop: '12px',
            textAlign: 'center',
          }}>
          <div style={{
            display: 'inline-block',
            padding: '6px 16px',
            borderRadius: '20px',
            background: 'rgba(255, 118, 117, 0.2)',
            color: '#ff7675',
            fontWeight: 'bold',
            fontSize: '14px',
          }}>
            <span style={{ fontSize: '18px', marginRight: '4px' }}>❤️</span>
            好感度: {relationshipLevel} 级
          </div>
        </div>
      )}

      {/* 性格描述（如果提供） */}
      {personality && (
        <div className="personality-description"
          style={{
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#a0a0b0',
            textAlign: 'center',
          }}>
          {personality}
        </div>
      )}

      {/* CSS 动画 */}
      <style jsx>{`
        @keyframes avatar-glow {
          0%, 100% {
            transform: scale(1) rotate(0deg);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.1) rotate(2deg);
            filter: brightness(1.2);
          }
        }
      `}</style>
    </div>
  );
};

export default CharacterCard;
