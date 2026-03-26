import axios from 'axios';

// Uses VITE_API_URL in production, proxies to localhost in dev
const BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: `${BASE}/api/assessment` });

export const checkOllama    = () => api.get('/ollama-status/');
export const createSession  = (topics) => api.post('/session/create/', { topics });
export const generateQuestion = (topic, previousQuestions = []) =>
  api.post('/question/generate/', { topic, previous_questions: previousQuestions });
export const saveResults    = (sessionKey, scores) =>
  api.post('/results/save/', { session_key: sessionKey, scores });
export const generateProject = (sessionKey, weakTopics, strongTopics) =>
  api.post('/project/generate/', { session_key: sessionKey, weak_topics: weakTopics, strong_topics: strongTopics });

export function streamCodeReview(code, topic, onToken, onDone) {
  const url = `${BASE}/api/assessment/code/review/`;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, topic }),
  }).then(async (resp) => {
    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer      = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') { onDone?.(); return; }
          try {
            const parsed = JSON.parse(data);
            onToken(parsed.token || '');
          } catch {}
        }
      }
    }
    onDone?.();
  }).catch(() => onDone?.());
}
