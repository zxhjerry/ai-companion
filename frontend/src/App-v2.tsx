/**
 * AI Companion Main App Component
 * 整合所有功能模块（角色展示+聊天+道具）
 */

import React, { useState, useEffect, useRef } from 'react';
import CharacterCard from './components/CharacterCard';
import InventoryItem from './components/InventoryItem';
import { ChatMessage, MessageType } from './components/ChatMessage';

// ===== 类型定义 =====

interface CharacterStats {
  strength: number;
  intelligence: number;
  charisma: number;
  appearance: number;
}

interface Character {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  appearance: number;
  stats: CharacterStats;
  personality: string;
  relationshipLevel: number;
}

interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: string;
  metadata?: {
    characterId?: string;
    [key: string]: any;
  };
}

interface Item {
  itemId: string;
  name: string;
  type: string;
  rarity: number;
  stats: { [key: string]: number };
  effectDescription: string;
  iconUrl?: string;
}

// ===== 模拟数据 =====

const MOCK_CHARACTERS: Character[] = [
  {
    id: 'char-1',
    name: 'Luna',
    gender: 'female',
    appearance: 95,
    stats: {
      strength: 70,
      intelligence: 85,
      charisma: 90,
      appearance: 95
    },
    personality: 'warm, curious, playful',
    relationshipLevel: 0
  },
  {
    id: 'char-2',
    name: 'Max',
    gender: 'male',
    appearance: 70,
    stats: {
      strength: 80,
      intelligence: 60,
      charisma: 70,
      appearance: 70
    },
    personality: 'adventurous, daring, humorous',
    relationshipLevel: 0
  }
];

const MOCK_INVENTORY: Item[] = [
  {
    itemId: 'item-1',
    name: 'Blade of Dawn',
    type: 'weapon',
    rarity: 60,
    stats: {
      strength: 40,
      power: 60
    },
    effectDescription: 'Rare item granting strength+40, power+60 bonuses.',
  },
  {
    itemId: 'item-2',
    name: 'Elixir of Life',
    type: 'potion',
    rarity: 70,
    stats: {
      heal: 80,
      mana: 50
    },
    effectDescription: 'Rare item granting heal+80, mana+50 bonuses.',
  }
];

// ===== 主组件 =====

function App() {
  // 状态管理
  const [message, setMessages] = useState<Message[]>([
    {
      id: 'msg-1',
      type: MessageType.ASSISTANT,
      content: '嘿！我是「Luna」✨ 很高兴认识你！我是你的 AI 伴侣。',
      timestamp: new Date().toLocaleTimeString(),
      metadata: { characterId: 'char-1' }
    }
  ]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('char-1');
  const [inputValue, setInputValue] = useState('');
  const [inventory, setInventory] = useState<Item[]>(MOCK_INVENTORY);
  const [showInventory, setShowInventory] = useState(false);

  // 消息列表引用（自动滚动）
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [message]);

  // 获取当前选中的角色
  const getCurrentCharacter = (): Character | undefined => {
    return MOCK_CHARACTERS.find(char => char.id === selectedCharacter);
  };

  // 处理选择角色
  const handleSelectCharacter = (characterId: string) => {
    setSelectedCharacter(characterId);
    const char = MOCK_CHARACTERS.find(c => c.id === characterId);
    if (char) {
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        type: MessageType.ASSISTANT,
        content: `嘿！我是「${char.name}」✨ 很高兴认识你！`,
        timestamp: new Date().toLocaleTimeString(),
        metadata: { characterId: char.id }
      }]);
    }
  };

  // 处理发送消息
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    // 添加用户消息
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      type: MessageType.USER,
      content: inputValue,
      timestamp: timeStr,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // 模拟 AI 回复
    setTimeout(() => {
      const aiResponses = [
        '真有意思！我很想了解更多！🌟️',
        '我理解你的感受，我也有类似体验。',
        '你说得对，这个话题很有意思！✨ 继续聊吧！'
      ];

      const aiMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        type: MessageType.ASSISTANT,
        content: aiResponses[Math.floor(Math.random() * aiResponses.length)],
        timestamp: timeStr.split(':')[0] + ':' + String(5 + parseInt(timeStr.split(':')[1])).padStart(2, '0'),
        metadata: { characterId: selectedCharacter }
      };

      setMessages(prev => [...prev, aiMsg]);

      // 随机触发隐藏事件（10% 概率）
      if (Math.random() < 0.1) {
        const hiddenEventMsg: Message = {
          id: `msg-${Date.now() + 2}`,
          type: MessageType.HIDDEN_EVENT,
          content: '🎮 隐藏剧情触发\n角色的秘密往事浮出水面...',
          timestamp: new Date().toLocaleTimeString(),
        };

        setMessages(prev => [...prev, hiddenEventMsg]);
      }

      // 随机触发道具掉落（10% 概率）
      if (Math.random() < 0.1) {
        const newItem: Item = {
          itemId: `item-${Date.now()}`,
          name: 'Mysterious Gem',
          type: 'special',
          rarity: Math.floor(Math.random() * 100) + 1,
          stats: {
            luck: Math.floor(Math.random() * 20) + 10,
            charm: Math.floor(Math.random() * 15) + 5
          },
          effectDescription: 'A mysterious gem that grants random bonuses.',
        };

        setInventory(prev => [...prev, newItem]);

        const itemDropMsg: Message = {
          id: `msg-${Date.now() + 3}`,
          type: MessageType.ITEM_DROP,
          content: `🎁 发现新道具：${newItem.name}\n稀有度: ${newItem.rarity} | 获得临时属性加成`,
          timestamp: new Date().toLocaleTimeString(),
        };

        setMessages(prev => [...prev, itemDropMsg]);
      }
    }, 500);
  };

  // 处理使用道具
  const handleUseItem = (itemId: string) => {
    setInventory(prev => {
      const item = prev.find(i => i.itemId === itemId);
      if (item) {
        // 模拟使用效果
        console.log(`使用道具: ${item.name}`, item.stats);
        return prev.filter(i => i.itemId !== itemId);
      }
      return prev;
    });
  };

  // 处理删除道具
  const handleDeleteItem = (itemId: string) => {
    setInventory(prev => prev.filter(i => i.itemId !== itemId));
  };

  const currentCharacter = getCurrentCharacter();

  return (
    <div className="app" style={{
      minHeight: '100vh',
      background: '#0a0a1a',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div className="container" style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '20px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* 头部 */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: 'rgba(26, 26, 46, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '2px solid rgba(108, 92, 231, 0.3)',
          borderRadius: '20px',
          marginBottom: '20px',
        }}>
          <div className="logo" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <span className="logo-text" style={{
              fontSize: '24px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #a29bfe, #00cec9, #ff7675)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              AI Companion
            </span>
            <span className="logo-icon" style={{
              fontSize: '28px',
              animation: 'bounce-slow 2s ease-in-out infinite',
            }}>
              🤖
            </span>
          </div>

          <div className="header-right" style={{
            display: 'flex',
            gap: '16px',
          }}>
            <button
              onClick={() => setShowInventory(!showInventory)}
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                background: showInventory ? '#6c5ce7' : 'rgba(108, 92, 231, 0.2)',
                color: showInventory ? 'white' : '#a0a0b0',
                border: '2px solid rgba(108, 92, 231, 0.3)',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              🎒 背包 ({inventory.length})
            </button>
            <div className="status-badge" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 20px',
              background: 'linear-gradient(135deg, rgba(0, 206, 201, 0.2), rgba(108, 92, 231, 0.2))',
              borderRadius: '30px',
            }}>
              <div className="status-dot" style={{
                width: '10px',
                height: '10px',
                background: '#00cec9',
                borderRadius: '50%',
                animation: 'pulse 2s ease-in-out infinite',
              }} />
              <span className="status-text" style={{
                fontSize: '14px',
                fontWeight: '600',
                letterSpacing: '0.5px',
              }}>
                在线
              </span>
            </div>
          </div>
        </header>

        {/* 主内容区域 */}
        <main style={{
          display: 'grid',
          gridTemplateColumns: showInventory ? '350px 1fr 300px' : '350px 1fr',
          gap: '20px',
          flex: 1,
        }}>
          {/* 角色列表 */}
          <aside style={{
            background: 'rgba(26, 26, 46, 0.6)',
            borderRadius: '20px',
            padding: '20px',
            border: '2px solid rgba(108, 92, 231, 0.2)',
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              marginBottom: '20px',
              color: '#a0a0b0',
            }}>
              AI 伴侣
            </h2>
            <div className="character-list" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}>
              {MOCK_CHARACTERS.map(char => (
                <CharacterCard
                  key={char.id}
                  {...char}
                  onSelect={handleSelectCharacter}
                />
              ))}
            </div>
          </aside>

          {/* 聊天区域 */}
          <section style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}>
            {/* 消息列表 */}
            <div className="messages" style={{
              flex: 1,
              maxHeight: '600px',
              overflowY: 'auto',
              padding: '20px',
              background: 'rgba(26, 26, 46, 0.6)',
              border: '2px solid rgba(108, 92, 231, 0.2)',
              borderRadius: '20px',
              scrollBehavior: 'smooth',
            }}>
              {message.map(msg => (
                <ChatMessage
                  key={msg.id}
                  {...msg}
                  characterName={currentCharacter?.name}
                  characterId={selectedCharacter}
                  onCharacterSelect={setSelectedCharacter}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="input-area" style={{
              padding: '16px',
              background: 'rgba(26, 26, 46, 0.8)',
              border: '2px solid rgba(108, 92, 231, 0.3)',
              borderRadius: '20px',
            }}>
              <div className="input-group" style={{
                display: 'flex',
                gap: '12px',
                background: 'rgba(26, 26, 46, 0.6)',
                border: '2px solid rgba(108, 92, 231, 0.3)',
                borderRadius: '30px',
                padding: '8px 16px',
              }}>
                <input
                  type="text"
                  className="message-input"
                  placeholder="输入消息..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'white',
                    fontSize: '16px',
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6c5ce7, #00cec9)',
                    border: '2px solid rgba(0, 206, 201, 0.4)',
                    color: 'white',
                    border: 'none',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 206, 201, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  ➤
                </button>
              </div>
            </div>
          </section>

          {/* 背包（右侧边栏） */}
          {showInventory && (
            <aside style={{
              background: 'rgba(26, 26, 46, 0.6)',
              borderRadius: '20px',
              padding: '20px',
              border: '2px solid rgba(108, 92, 231, 0.2)',
              maxHeight: '800px',
              overflowY: 'auto',
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: 'bold',
                marginBottom: '20px',
                color: '#a0a0b0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span>🎒 背包</span>
                <span style={{
                  fontSize: '14px',
                  background: 'rgba(108, 92, 231, 0.2)',
                  padding: '4px 12px',
                  borderRadius: '10px',
                }}>
                  {inventory.length}
                </span>
              </h2>
              {inventory.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  color: '#707080',
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
                  <p style={{ margin: 0 }}>背包是空的</p>
                </div>
              ) : (
                inventory
                  .sort((a, b) => b.rarity - a.rarity)
                  .map(item => (
                    <InventoryItem
                      key={item.itemId}
                      {...item}
                      onUse={handleUseItem}
                      onDelete={handleDeleteItem}
                    />
                  ))
              )}
            </aside>
          )}
        </main>
      </div>

      {/* 背景动画 */}
      <div className="background-effects" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
      }}>
        <div className="orb orb-1" style={{
          position: 'absolute',
          top: '10%',
          left: '-50px',
          width: '250px',
          height: '250px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108, 92, 231, 0.1), transparent)',
          filter: 'blur(60px)',
          animation: 'floatOrb 8s ease-in-out infinite',
        }} />
        <div className="orb orb-2" style={{
          position: 'absolute',
          bottom: '20%',
          right: '-30px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(162, 155, 254, 0.1), transparent)',
          filter: 'blur(60px)',
          animation: 'floatOrb 8s ease-in-out infinite 3s',
        }} />
        <div className="orb orb-3" style={{
          position: 'absolute',
          top: '50%',
          left: '20%',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 206, 201, 0.1), transparent)',
          filter: 'blur(60px)',
          animation: 'floatOrb 8s ease-in-out infinite 6s',
        }} />
      </div>
    </div>
  );
}

// CSS 动画定义
const style = document.createElement('style');
style.textContent = `
  @keyframes bounce-slow {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes floatOrb {
    0%, 100% {
      transform: translateY(0) translateX(0);
      opacity: 0.6;
    }
    50% {
      transform: translateY(-40px) translateX(20px);
      opacity: 0.8;
    }
  }
`;
document.head.appendChild(style);

export default App;
