import { useState, useRef, useEffect } from 'react';
import { demoQuestions } from '@/data/mockData';
import { Send, Bot, User, MessageCircle, X } from 'lucide-react';
import { useLiveStore } from '@/store/liveStore';
import { useForecastStore } from '@/store/forecastStore';
import { useInvestigationStore } from '@/store/investigationStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function InvestigationAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'intro',
      role: 'assistant',
      text: "Hello! I'm the NEXTRACE AI Investigation Assistant. I can help you analyze alerts, investigate entities, and understand predicted attack paths. Select a quick question or type your own below.\n\n[Demo Assistant] Predefined responses for prototype evaluation.",
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
    
    let answer = '';
    const qLower = inputValue.toLowerCase();
    
    const { currentTemporal, displayEvents, session, liveNodes, liveEdges } = useLiveStore.getState();
    const { currentForecast } = useForecastStore.getState();
    const { findings } = useInvestigationStore.getState();
    
    // Simple regex for IP extraction
    const ipMatch = inputValue.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    const portMatch = inputValue.match(/\b(?:port\s)?(\d{1,5})\b/i);
    const queriedIp = ipMatch ? ipMatch[0] : null;
    const queriedPort = portMatch ? portMatch[1] : null;

    if (queriedIp) {
       const node = liveNodes.find(n => n.ip === queriedIp);
       const nodeEvents = displayEvents.filter(e => e.src_ip === queriedIp || e.dst_ip === queriedIp);
       const edges = liveEdges.filter(e => e.from === node?.id || e.to === node?.id);
       
       if (node) {
         answer = `Entity ${queriedIp} is categorized as a ${node.type?.toUpperCase() || 'UNKNOWN'}. It currently has ${edges.length} active relationships. We have observed ${nodeEvents.length} recent events involving this IP.`;
         const suspEvents = nodeEvents.filter(e => e.classification === 'suspicious');
         if (suspEvents.length > 0) {
           answer += `\n\nAlert: This IP is involved in ${suspEvents.length} suspicious events!`;
         }
       } else {
         answer = `I don't have detailed node information for ${queriedIp}, but there are ${nodeEvents.length} packets involving it in the recent event log.`;
       }
    } else if (queriedPort) {
       const portEvents = displayEvents.filter(e => String(e.src_port) === queriedPort || String(e.dst_port) === queriedPort);
       answer = `I found ${portEvents.length} recent network events involving port ${queriedPort}.`;
       if (portEvents.length > 0) {
         const protos = Array.from(new Set(portEvents.map(e => e.protocol))).join(', ');
         answer += ` The protocols used on this port include: ${protos}.`;
       }
    } else if (qLower.includes('finding') || qLower.includes('evidence')) {
       if (findings && findings.length > 0) {
         answer = `I have ${findings.length} findings available for the current investigation:\n\n` +
                  findings.map((f, i) => `${i + 1}. [Confidence: ${f.confidence}] ${f.summary}`).join('\n\n');
       } else {
         answer = `There are no specific findings generated for the current investigation yet. Try clicking "Generate AI Findings" on the Investigation page first.`;
       }
    } else if (qLower.includes('pcap')) {
       answer = `Based on the ingested PCAP data and our live analysis, we observed a total of ${displayEvents.length} network packets. You can drill down into specific IPs or ask about suspicious traffic to investigate further.`;
    } else if (!session?.running && displayEvents.length === 0) {
      answer = 'Please start a live session or upload a PCAP first to analyze the traffic data.';
    } else if (qLower.includes('traffic') || qLower.includes('packet') || qLower.includes('connection')) {
      if (currentTemporal) {
        answer = `Currently observing ${currentTemporal.packet_count} packets (${(currentTemporal.byte_count / 1024).toFixed(1)} KB) across ${currentTemporal.flow_count} active flows. Connection rate is ${currentTemporal.connection_rate.toFixed(1)} pkt/s. Suspicious ratio is ${(currentTemporal.suspicious_ratio * 100).toFixed(1)}%.`;
      } else {
        answer = `I see ${displayEvents.length} recent events in the traffic log. Start the Live Demo to see aggregated temporal stats!`;
      }
    } else if (qLower.includes('suspicious') || qLower.includes('alert') || qLower.includes('attack')) {
      const suspCount = currentTemporal?.suspicious_count ?? displayEvents.filter(e => e.classification === 'suspicious').length;
      answer = `There are currently ${suspCount} suspicious events in the analyzed data.`;
      if (currentForecast && !currentForecast.is_benign) {
         answer += `\n\nForecast indicates an active attack progression at stage: ${currentForecast.current_stage}. Predicted next stage is ${currentForecast.predicted_next_stage} (Confidence: ${(currentForecast.confidence * 100).toFixed(0)}%).`;
      } else if (currentForecast) {
         answer += `\n\nThe forecast model currently considers the overall traffic state to be benign.`;
      }
    } else if (qLower.includes('entity') || qLower.includes('host') || qLower.includes('doing')) {
       answer = `I am monitoring ${liveNodes.length} active network entities.`;
       const susp = displayEvents.find(e => e.classification === 'suspicious');
       if (susp) {
         answer += `\nFor instance, ${susp.src_ip} has recently exhibited suspicious behavior toward ${susp.dst_ip}.`;
       }
    } else {
       const q = demoQuestions.find(dq => dq.question.toLowerCase().includes(qLower.split(' ')[0]));
       answer = q?.answer ?? `I am dynamically analyzing the live traffic stream and any uploaded PCAPs. I can answer questions about specific IPs, ports, "traffic" volume, "suspicious" findings, or "evidence". Try asking something specific!`;
    }

    handleQuestion(inputValue, answer);
    setInputValue('');
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1000,
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat Window */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 380,
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          display: isOpen ? 'flex' : 'none',
          flexDirection: 'column',
          height: 500,
          zIndex: 1000,
          animation: 'slideInRight 0.3s ease',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>
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
    </>
  );
}
