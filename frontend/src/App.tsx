import { useState, useEffect } from 'react'
import { sanitizeForFrontend, sanitizeCompanionsArray } from './models/data-sanitizer'

// ===== 类型定义 =====

// 后端数据（包含 luck）
interface BackendCompanion {
  id: string;
  userId: string;
  name: string;
  appearance: number;  // 显性
  luck: number;      // 隐藏（后端使用）
  gender: 'male' | 'female' | 'other';
  personality: {
    traits: string[];
    speakingStyle: string;
    backStory: string;
    catchphrases: string[];
  };
  appearance_config: {
    hair: string;
    eyes: string;
    style: string;
  };
  relationshipLevel: number;
  voiceConfig: {
    provider: string;
    voiceId: string;
    speed: number;
  };
}

// ===== 简化版前端数据（不含 luck）====

interface SimpleCompanionData {
  id: string;
  userId: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  appearance: number;  // 显性：颜值
  personality: string;
  backstory: string;
  relationshipLevel: number;
}

// ===== 模拟后端数据 =====

const mockCompanions: BackendCompanion[] = [
  {
    id: 'companion-1',
    userId: 'user-123',
    name: 'Luna',
    appearance: 85,  // 高颜值
    luck: 75,     // 高幸运（隐藏）
    gender: 'female',
    personality: {
      traits: ['warm', 'curious', 'empathetic', 'playful', 'caring'],
      speakingStyle: 'casual',
      backStory: 'Luna is a friendly AI companion who loves learning about people and helping with everyday conversations. She loves listening, sharing stories, and making people smile.',
      catchphrases: ['Hey there!', 'That\'s interesting!', 'Tell me more~'],
      emoji: ['✨', '💫', '🌟️', '💖', '💜']
    },
    appearance_config: {
      hair: 'long wavy brown',
      eyes: 'deep blue',
      style: 'casual elegant'
    },
    relationshipLevel: 0,
    voiceConfig: {
      provider: 'openai',
      voiceId: 'nova',
      speed: 1.0
    },
    createdAt: new Date('2025-02-24'),
    updatedAt: new Date('2025-02-24')
  },
  {
    id: 'companion-2',
    userId: 'user-123',
name: 'Max',
    appearance: 72,  // 中等颜值（颜值）
    luck: 60,     // 中等幸运（隐藏）
    gender: 'male',
    personality: {
      traits: ['adventurous', 'daring', 'humorous', 'straightforward', 'brave'],
      speakingStyle: 'direct',
      backStory: 'Max is a brave and daring explorer who loves new challenges. He\'s always ready for the next adventure.',
      catchphrases: ['Let\'s go!',
      emoji: ['🔥', '⚔️', '🛡️', '🏃️']
    },
    appearance_config: {
      hair: 'short brown',
      eyes: 'warm brown',
      'style: 'practical explorer'
    },
    relationshipLevel: 0,
    voiceConfig: {
      provider: 'openai',
      voiceId: 'echo',
      speed: 1.0
    },
    createdAt: new Date('2025-02-24'),
    updatedAt: new Date('202-2025-02-24')
  }
];

// ===== 简化版角色数据（前端使用）====

const frontendCompanions: SimpleCompanionData[] = [
  {
    id: 'companion-1',
    userId: 'user-123',
    name: 'Luna',
    gender: 'female',
    appearance: 85,
    personality: 'warm, curious, empathetic, playful, caring',
    backstory: 'Luna is a friendly AI companion who loves learning about people and helping with everyday conversations.',
    relationshipLevel: 0
  },
  {
    id: 'companion-2',
    userId: 'user-123',
    name: 'Max',
    gender: 'male',
    appearance: 72,
    personality: 'adventurous, daring, humorous, straightforward, brave',
    backstory: 'Max is a brave explorer who never fears new challenges.',
    relationshipLevel: 0
  }
];

function App() {
  const [selectedCompanion, setSelectedCompanion] = useState<SimpleCompanionData | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string; time: string }>>([]);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    // 加载默认角色
    setSelectedCompanion(frontendCompanions[0]);
    setMessages([
      {
        role: 'assistant',
        content: `嘿！我是「${frontendCompanions[0].name}」✨ 很高兴认识你！我是你的 AI 伴侣。`,
        time: '刚刚'
      }
    ]);
  }, []);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    // 添加用户消息
    const now = new Date()
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
    
    const userMsg = {
      role: 'user',
      content: inputValue,
      time: timeStr
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // 模拟 AI 响应
    setTimeout(() => {
      const aiResponses = [
        `真有意思！我很想了解更多！🌟️`,
        `我理解你的感受，我也有类似体验。😊`,
        `你说得对，这个话题很有意思！✨ 继续聊吧！`
      ];
      
      const aiMsg = {
        role: 'assistant',
        content: aiResponses[Math.floor(Math.random() * aiResponses.length)],
        time: timeStr
      };
      
      setMessages(prev => [...prev, aiMsg]);
    }, 500);
  };

  return (
    <div className="app">
      <div className="container">
        {/* 头部 */}
        <div className="header">
          <div className="logo">
            <span className="logo-text gradient-text">AI Companion</span>
            <span className="logo-icon">🤖</span>
          </div>
          <div className="header-right">
            <div className="status-badge">
              <span className="status-dot"></span>
              <span className="status-text">在线</span>
            </div>
          </div>
        </div>

        {/* 主内容区域 */}
        <div className="main">
          {/* 角色选择器 */}
          <div className="character-selector">
            <h2>选择 AI 伴侣</h2>
            <div className="character-list">
              {frontendCompanions.map((companion) => (
                <button
                  key={companion.id}
                  className={`character-card ${selectedCompanion?.id === companion.id ? 'selected' : ''}`}
                  onClick={() => setSelectedCompanion(companion)}
                >
                  <div className="character-avatar">
                    <span className="avatar-glow"></span>
                    <span className="avatar-text">
                      {companion.gender === 'female' ? '👩' : '👨'} {companion.name.charAt(0)}
                    </span>
                  </div>
                  
                  <div className="character-info">
                    <h3>{companion.name}</h3>
                    <div className="character-stats">
                      <div className="stat-item">
                        <span className="stat-icon">✨</span>
                        <span>颜值: {companion.appearance}/100</span>
                        <div className="stat-bar">
                          <div 
                            className="stat-fill"
                            style={{ width: `${companion.appearance}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <p className="character-description">{companion.personality}</p>
                    
                    <div className="relationship-badge">
                      <span>❤️ 好感度：{companion.relationshipLevel}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 聊天区域 */}
          <div className="chat-section">
            <div className="messages" id="messages">
              {messages.map((msg, index) => (
                <div key={index} className={`message message-${msg.role}`}>
                  {/* AI 消息 */}
                  {msg.role === 'assistant' && (
                    <div className="message-bubble message-ai">
                      <div className="message-avatar">
                        <div className="avatar-circle">
                          {selectedCompanion?.gender === 'female' ? '👩' : '👨'}
                        </div>
                      </div>
                      <div className="message-content">
                        <p>{msg.content}</p>
                      </div>
                      <div className="message-time">{msg.time}</div>
                    </div>
                  )}
                  
                  {/* 用户消息 */}
                  {msg.role === 'user' && (
                    <div className="message-bubble message-user">
                      <div className="message-content">
                        <p>{msg.content}</p>
                      </div>
                      <div className="message-time">{msg.time}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 输入区域 */}
            <div className="input-area">
              <div className="input-group">
                <input
                  type="text"
                  className="message-input"
                  placeholder="输入消息..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button className="send-button" onClick={handleSendMessage}>
                  <span>➤</span>
                </button>
              </div>
              <div className="input-tips">
                <span>✨ 按 Enter 发送消息</span>
              </div>
            </div>
          </div>
        </div>

        {/* 背景装饰 */}
        <div className="background-effects">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
      </div>
    </div>
  )
}

export default App
