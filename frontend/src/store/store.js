import { create } from 'zustand';

export const useStore = create((set, get) => ({
  phase: 'topic-select',
  selectedTopics: [],
  sessionKey: null,
  ollamaReady: false,
  projectData: null,

  // scores shape:
  // { Python: { correct: 2, total: 5 } }
  scores: {},

  // subtopicScores shape:
  // { Python: { Functions: {correct:0,total:1}, Loops: {correct:1,total:1} } }
  subtopicScores: {},

  setPhase: (phase) => set({ phase }),
  setSelectedTopics: (t) => set({ selectedTopics: t }),
  setSessionKey: (k) => set({ sessionKey: k }),
  setOllamaReady: (v) => set({ ollamaReady: v }),
  setProjectData: (d) => set({ projectData: d }),

  recordAnswer: (topic, subtopic, isCorrect) => {
    const { scores, subtopicScores } = get();

    // update topic-level score
    const prev = scores[topic] || { correct: 0, total: 0 };
    const newScores = {
      ...scores,
      [topic]: {
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      },
    };

    // update subtopic-level score
    const topicSub = subtopicScores[topic] || {};
    const prevSub = topicSub[subtopic] || { correct: 0, total: 0 };
    const newSubtopicScores = {
      ...subtopicScores,
      [topic]: {
        ...topicSub,
        [subtopic]: {
          correct: prevSub.correct + (isCorrect ? 1 : 0),
          total: prevSub.total + 1,
        },
      },
    };

    set({ scores: newScores, subtopicScores: newSubtopicScores });
  },

  getWeakTopics: () => {
    const { scores, selectedTopics } = get();
    return selectedTopics.filter(t => {
      const s = scores[t];
      if (!s || s.total === 0) return true;
      return (s.correct / s.total) < 0.6;
    });
  },

  getStrongTopics: () => {
    const { scores, selectedTopics } = get();
    return selectedTopics.filter(t => {
      const s = scores[t];
      if (!s || s.total === 0) return false;
      return (s.correct / s.total) >= 0.6;
    });
  },

  // Returns flat list of weak subtopics across all topics
  getWeakSubtopics: () => {
    const { subtopicScores } = get();
    const weak = [];
    Object.entries(subtopicScores).forEach(([topic, subs]) => {
      Object.entries(subs).forEach(([subtopic, s]) => {
        if (s.total > 0 && (s.correct / s.total) < 0.5) {
          weak.push({ topic, subtopic, ...s });
        }
      });
    });
    return weak;
  },

  getStrongSubtopics: () => {
    const { subtopicScores } = get();
    const strong = [];
    Object.entries(subtopicScores).forEach(([topic, subs]) => {
      Object.entries(subs).forEach(([subtopic, s]) => {
        if (s.total > 0 && (s.correct / s.total) >= 0.5) {
          strong.push({ topic, subtopic, ...s });
        }
      });
    });
    return strong;
  },
}));
