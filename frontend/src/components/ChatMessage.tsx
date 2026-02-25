/**
 * Chat Message Component
 * 展示用户和 AI 的聊天消息（支持隐藏事件通知）
 */

import React from 'react';

export enum MessageType {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  HIDDEN_EVENT = 'hidden-event',  // 隐藏事件通知
  ITEM_DROP = 'item-drop'          // 道具掉落通知
}

interface MessageMetadata {
  characterId?: string;
  timestamp?: string;
  [key: string]: any;
}

interface ChatMessageProps {
  id: string;
  type: MessageType;
  content: string;
  metadata?: MessageMetadata;
  characterName?: string;
  characterAvatar?: string;
  onCharacterSelect?: (id: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
  type,
  content,
  metadata,
  characterName = 'AI',
  characterAvatar,
  onCharacterSelect
}) => {
  // 根据消息类型决定样式
  const getMessageStyle = (messageType: MessageType) => {
    switch (messageType) {
      case MessageType.USER:
        return {
          align: 'flex-end',
          background: 'linear-gradient(135deg, #6c5ce7, #4834d4)',
          color: 'white',
          borderRadius: '20px 20px 5px 20px',
          maxWidth: '80%',
        };
      case MessageType.ASSISTANT:
        return {
          align: 'flex-start',
          background: 'rgba(37, 41, 56, 0.8)',
          border: '2px solid rgba(0, 206, 201, 0.3)',
          color: 'white',
          borderRadius: '20px 20px 5px 20px',
          maxWidth: '80%',
        };
      case MessageType.HIDDEN_EVENT:
        return {
          align: 'center',
          background: 'rgba(255, 118, 117, 0.1)',
          border: '2px solid rgba(255, 118, 117, 0.5)',
          color: '#ff7675',
          borderRadius: '15px',
          maxWidth: '90%',
        };
      case MessageType.ITEM_DROP:
        return {
          align: 'center',
          background: 'rgba(162, 155, 254, 0.1)',
          border: '2px solid rgba(162, 155, 254, 0.5)',
          color: '#a29bfe',
          borderRadius: '15px',
          maxWidth: '90%',
        };
      default:
        return {
          align: 'flex-start',
          background: 'rgba(26, 26, 46, 0.6)',
          color: '#a0a0b0',
          borderRadius: '10px',
          maxWidth: '80%',
        };
    }
  };

  const style = getMessageStyle(type);
  const timestamp = metadata?.timestamp || new Date().toLocaleTimeString();

  // 特殊消息内容格式化
  const renderContent = () => {
    if (type === MessageType.HIDDEN_EVENT) {
      const eventTitle = content.split('\n')[0];
      const eventDetails = content.split('\n').slice(1).join('\n');
      
      return (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '24px' }}>🎬</span>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              margin: 0,
            }}>
              {eventTitle}
            </h3>
          </div>
          {eventDetails && (
            <p style={{ margin: '8px 0', fontSize: '14px' }}>
              {eventDetails}
            </p>
          )}
        </div>
      );
    }

    if (type === MessageType.ITEM_DROP) {
      const itemTitle = content.split('\n')[0];
      const itemDetails = content.split('\n').slice(1).join('\n');
      
      return (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '24px' }}>🎁</span>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              margin: 0,
            }}>
              {itemTitle}
            </h3>
          </div>
          {itemDetails && (
            <p style={{ margin: '8px 0', fontSize: '14px' }}>
              {itemDetails}
            </p>
          )}
        </div>
      );
    }

    // 普通消息
    return <p style={{ margin: 0, lineHeight: 1.6 }}>{content}</p>;
  };

  return (
    <div
      className="chat-message"
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '16px',
        alignItems: style.align,
      }}
    >
      {/* 角色 AI 消息显示头像 */}
      {type === MessageType.ASSISTANT && (
        <div className="message-avatar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
          }}>
          <div className="avatar-circle"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff7675, #fd79a8, #00cec9)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onClick={() => onCharacterSelect?.(metadata?.characterId || '')}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {characterAvatar ? (
              <img src={characterAvatar} alt={characterName} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            ) : (
              <span>🤖</span>
            )}
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#00cec9',
          }}>
            {characterName}
          </div>
        </div>
      )}

      {/* 消息气泡 */}
      <div
        className="message-bubble"
        style={{
          padding: type === MessageType.USER || type === MessageType.ASSISTANT ? '12px 16px' : '12px',
          background: style.background,
          color: style.color,
          border: style.border,
          borderRadius: style.borderRadius,
          maxWidth: style.maxWidth,
          marginBottom: '8px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {renderContent()}
      </div>

      {/* 消息时间戳 */}
      {timestamp && (
        <div className="message-timestamp"
          style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.6)',
            margin: '4px 0',
          }}>
          {timestamp}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
