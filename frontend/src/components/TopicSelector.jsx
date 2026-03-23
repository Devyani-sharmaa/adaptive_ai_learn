import { useState, useEffect } from 'react';
import { useStore } from '../store/store';
import { checkOllama, createSession } from '../api';

const TOPICS = [
  { id: 'Python',     icon: '🐍', desc: 'Functions, OOP, syntax' },
  { id: 'HTML/CSS',   icon: '🎨', desc: 'Markup, styling, layouts' },
  { id: 'SQL',        icon: '🗄️',  desc: 'Queries, joins, aggregates' },
  { id: 'JavaScript', icon: '⚡', desc: 'DOM, async, ES6+' },
];

export default function TopicSelector() {
  const { selectedTopics, setSelectedTopics, setSessionKey, setPhase, ollamaReady, setOllamaReady } = useStore();
  const [loading, setLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState(null);

  useEffect(() => {
    checkOllama()
      .then(res => {
        setOllamaStatus(res.data);
        setOllamaReady(res.data.ready);
      })
      .catch(() => setOllamaStatus({ running: false }));
  }, []);

  const toggle = (id) => {
    setSelectedTopics(
      selectedTopics.includes(id)
        ? selectedTopics.filter(t => t !== id)
        : [...selectedTopics, id]
    );
  };

  const start = async () => {
    if (selectedTopics.length === 0) return;
    setLoading(true);
    try {
      const res = await createSession(selectedTopics);
      setSessionKey(res.data.session_key);
      setPhase('quiz');
    } catch (e) {
      alert('Could not connect to backend. Make sure Django is running.');
    }
    setLoading(false);
  };

  return (
    <div className="topic-selector">
      <div className="logo" style={{ fontSize: 24, marginBottom: 4 }}>
        <div className="logo-icon" style={{ width: 36, height: 36, fontSize: 18 }}>⚡</div>
        SkillForge AI
      </div>
      <p>Select topics to test your knowledge</p>

      {/* Ollama Status */}
      {ollamaStatus && (
        <div className={`ollama-status ${ollamaStatus.ready ? 'ok' : 'error'}`}>
          <div className={`status-dot ${ollamaStatus.ready ? 'ok' : 'error'}`} />
          {ollamaStatus.ready
            ? '✓ Ollama AI is ready'
            : ollamaStatus.running
              ? '⚠ Ollama running but model not found. Run: ollama pull llama3.2'
              : '✗ Ollama not running — questions will use fallback mode'
          }
        </div>
      )}

      <div className="topic-grid">
        {TOPICS.map(t => (
          <button
            key={t.id}
            className={`topic-card ${selectedTopics.includes(t.id) ? 'selected' : ''}`}
            onClick={() => toggle(t.id)}
          >
            <span className="icon">{t.icon}</span>
            <span className="name">{t.id}</span>
            <span className="desc">{t.desc}</span>
          </button>
        ))}
      </div>

      <button
        className="btn-primary"
        onClick={start}
        disabled={selectedTopics.length === 0 || loading}
        style={{ padding: '12px 40px', fontSize: 15 }}
      >
        {loading
          ? 'Starting...'
          : selectedTopics.length === 0
            ? 'Select at least 1 topic'
            : `Start Assessment →`}
      </button>
    </div>
  );
}
