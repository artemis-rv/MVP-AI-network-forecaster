import { useState, useRef, useEffect } from 'react';
import { demoQuestions } from '@/data/mockData';
import { Send, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function InvestigationAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'intro',
      role: 'assistant',
      text: "Hello! I'm the NEXTRACE AI Investigation Assistant. I can help you analyze alerts, investigate entities, and understand predicted attack paths. Select a quick question or type your own below.\n\n⚠ This is a demo assistant with predefined responses. No real LLM is connected.",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  const handleQuestion = (question: string, answer: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Simulate typing delay
    setTimeout(() => {
      setIsTyping(false);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: answer };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1000);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const q = demoQuestions.find(dq =>
      dq.question.toLowerCase().includes(inputValue.toLowerCase().split(' ')[0])
    );
    const answer = q?.answer ?? '[DEMO RESPONSE] I can only answer predefined questions in this demo. Please select one of the quick questions below.';
    handleQuestion(inputValue, answer);
    setInputValue('');
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: 460,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bot size={16} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Investigation Assistant</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ask questions about alerts, entities, or predictions.</div>
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.5px',
            color: 'var(--color-warning)',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 999,
            padding: '2px 8px',
          }}
        >
          DEMO
        </span>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="animate-fade-in-up"
            style={{
              display: 'flex',
              gap: 10,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: msg.role === 'assistant'
                  ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
                  : 'var(--bg-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {msg.role === 'assistant'
                ? <Bot size={14} color="white" />
                : <User size={14} color="var(--text-secondary)" />
              }
            </div>
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-input)',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                fontSize: 12,
                lineHeight: 1.6,
                whiteSpace: 'pre-line',
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={14} color="white" />
            </div>
            <div
              style={{
                padding: '10px 16px',
                background: 'var(--bg-input)',
                borderRadius: '12px 12px 12px 4px',
                display: 'flex',
                gap: 4,
                alignItems: 'center',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    animation: `pulse-dot 1.2s ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {demoQuestions.map((q) => (
          <button
            key={q.id}
            onClick={() => handleQuestion(q.question, q.answer)}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--primary)',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)'; }}
          >
            {q.question}
          </button>
        ))}
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your question..."
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: 10,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-input)',
            fontSize: 13,
            color: 'var(--text-primary)',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            transition: 'border-color var(--transition-fast)',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-glow)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
        />
        <button
          onClick={handleSend}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: 'none',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-hover)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <Send size={15} color="white" />
        </button>
      </div>
    </div>
  );
}
