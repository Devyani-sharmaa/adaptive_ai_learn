import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/store';
import { generateQuestion, saveResults } from '../api';

const QS_PER_TOPIC = 5;

// Every question has a `subtopic` field — this drives the knowledge graph
const FALLBACK_QUESTIONS = {
  Python: [
    {
      subtopic: 'Lists',
      question: 'What is the correct way to create a list in Python?',
      options: ['list = (1, 2, 3)', 'list = [1, 2, 3]', 'list = {1, 2, 3}', 'list = <1, 2, 3>'],
      correct: 1,
      explanation: 'Square brackets [] are used to create a list in Python.',
    },
    {
      subtopic: 'Functions',
      question: 'Which keyword is used to define a function in Python?',
      options: ['function', 'func', 'def', 'define'],
      correct: 2,
      explanation: "'def' keyword is used to define functions in Python.",
    },
    {
      subtopic: 'Built-ins',
      question: 'What does len([1, 2, 3, 4]) return?',
      options: ['3', '4', '5', 'Error'],
      correct: 1,
      explanation: 'len() returns the count of items. This list has 4 items so it returns 4.',
    },
    {
      subtopic: 'Syntax',
      question: 'How do you start a comment in Python?',
      options: ['//', '/* */', '#', '--'],
      correct: 2,
      explanation: 'Python uses # for single-line comments.',
    },
    {
      subtopic: 'Dictionaries',
      question: 'Which of these is a valid Python dictionary?',
      options: ['["name": "Alice"]', '("name": "Alice")', '{"name": "Alice"}', '<"name": "Alice">'],
      correct: 2,
      explanation: 'Dictionaries use curly braces {} with key: value pairs.',
    },
  ],

  'HTML/CSS': [
    {
      subtopic: 'HTML Tags',
      question: 'Which tag is used to create a hyperlink in HTML?',
      options: ['<link>', '<a>', '<href>', '<url>'],
      correct: 1,
      explanation: 'The <a> (anchor) tag is used to create hyperlinks in HTML.',
    },
    {
      subtopic: 'CSS Typography',
      question: 'Which CSS property controls text size?',
      options: ['text-size', 'font-size', 'text-style', 'size'],
      correct: 1,
      explanation: 'font-size controls the size of text in CSS.',
    },
    {
      subtopic: 'CSS Basics',
      question: 'What does CSS stand for?',
      options: ['Computer Style Sheets', 'Cascading Style Sheets', 'Creative Style System', 'Coded Style Sheets'],
      correct: 1,
      explanation: 'CSS stands for Cascading Style Sheets.',
    },
    {
      subtopic: 'HTML Tags',
      question: 'Which HTML tag defines the largest heading?',
      options: ['<h6>', '<heading>', '<h1>', '<head>'],
      correct: 2,
      explanation: '<h1> defines the largest and most important heading.',
    },
    {
      subtopic: 'CSS Colors',
      question: 'Which CSS property changes background color?',
      options: ['color', 'bg-color', 'background-color', 'fill'],
      correct: 2,
      explanation: 'background-color sets the background color of an element.',
    },
  ],

  SQL: [
    {
      subtopic: 'SELECT',
      question: 'Which SQL command retrieves data from a table?',
      options: ['GET', 'FETCH', 'SELECT', 'RETRIEVE'],
      correct: 2,
      explanation: 'SELECT is the SQL command used to query data from a table.',
    },
    {
      subtopic: 'Filtering',
      question: 'Which clause filters rows in SQL?',
      options: ['HAVING', 'WHERE', 'FILTER', 'LIMIT'],
      correct: 1,
      explanation: 'WHERE clause filters records based on conditions.',
    },
    {
      subtopic: 'Constraints',
      question: 'What does PRIMARY KEY ensure in a table?',
      options: ['All values are null', 'Unique and not null values', 'Values can repeat', 'Only numbers allowed'],
      correct: 1,
      explanation: 'PRIMARY KEY ensures each row has a unique, non-null identifier.',
    },
    {
      subtopic: 'Joins',
      question: 'Which JOIN returns all rows from both tables?',
      options: ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN'],
      correct: 3,
      explanation: 'FULL OUTER JOIN returns all rows from both tables, NULLs where no match.',
    },
    {
      subtopic: 'Aggregates',
      question: 'Which SQL function counts the number of rows?',
      options: ['SUM()', 'COUNT()', 'TOTAL()', 'NUM()'],
      correct: 1,
      explanation: 'COUNT() returns the number of rows matching a condition.',
    },
  ],

  JavaScript: [
    {
      subtopic: 'Variables',
      question: 'Which keyword declares a block-scoped variable in JavaScript?',
      options: ['var', 'let', 'def', 'dim'],
      correct: 1,
      explanation: "'let' declares block-scoped variables, unlike 'var' which is function-scoped.",
    },
    {
      subtopic: 'Syntax',
      question: 'How do you write a single-line comment in JavaScript?',
      options: ['# comment', '<!-- comment -->', '// comment', '** comment **'],
      correct: 2,
      explanation: '// is used for single-line comments in JavaScript.',
    },
    {
      subtopic: 'Arrays',
      question: 'Which method adds an element to the end of an array?',
      options: ['append()', 'push()', 'add()', 'insert()'],
      correct: 1,
      explanation: 'push() adds one or more elements to the end of an array.',
    },
    {
      subtopic: 'Operators',
      question: 'What does === check in JavaScript?',
      options: ['Only value equality', 'Only type equality', 'Both value and type', 'Assignment'],
      correct: 2,
      explanation: '=== checks both value AND type (strict equality), unlike == which only checks value.',
    },
    {
      subtopic: 'JSON',
      question: 'Which method converts a JSON string to a JavaScript object?',
      options: ['JSON.stringify()', 'JSON.parse()', 'JSON.convert()', 'JSON.toObject()'],
      correct: 1,
      explanation: 'JSON.parse() converts a JSON string into a JavaScript object.',
    },
  ],
};

export default function Quiz() {
  const { selectedTopics, sessionKey, recordAnswer, scores, setPhase } = useStore();

  const [topicIdx, setTopicIdx] = useState(0);
  const [qIdx, setQIdx]         = useState(0);
  const [question, setQuestion] = useState(null);
  const [chosen, setChosen]     = useState(null);
  const [loading, setLoading]   = useState(false);

  const askedPerTopic = useRef({});

  const topic    = selectedTopics[topicIdx];
  const totalQ   = selectedTopics.length * QS_PER_TOPIC;
  const doneQ    = topicIdx * QS_PER_TOPIC + qIdx;
  const progress = Math.round((doneQ / totalQ) * 100);

  useEffect(() => { loadQuestion(); }, [topicIdx, qIdx]);

  async function loadQuestion() {
    setLoading(true);
    setChosen(null);
    setQuestion(null);

    if (!askedPerTopic.current[topic]) askedPerTopic.current[topic] = new Set();
    const askedSet  = askedPerTopic.current[topic];
    const askedList = Array.from(askedSet);

    let finalQuestion = null;
    try {
      const res = await generateQuestion(topic, askedList);
      const q   = res.data;
      if (q && q.question && !askedSet.has(q.question)) {
        // Ollama question — assign subtopic from response or guess from content
        q.subtopic = q.subtopic || guessSubtopic(topic, q.question);
        askedSet.add(q.question);
        finalQuestion = q;
      } else {
        finalQuestion = pickFallback(topic, askedSet);
      }
    } catch {
      finalQuestion = pickFallback(topic, askedSet);
    }

    setQuestion(finalQuestion);
    setLoading(false);
  }

  function pickFallback(topicName, askedSet) {
    const bank   = FALLBACK_QUESTIONS[topicName] || FALLBACK_QUESTIONS['Python'];
    const unused = bank.find(q => !askedSet.has(q.question));
    const chosen = unused || bank[0];
    askedSet.add(chosen.question);
    return chosen;
  }

  // Guess subtopic from question text if Ollama doesn't return one
  function guessSubtopic(topicName, questionText) {
    const q = questionText.toLowerCase();
    const subtopicMap = {
      Python: [
        ['function', 'def ', 'return', 'lambda', 'Functions'],
        ['list', 'append', 'array', 'Lists'],
        ['dict', 'dictionary', 'key', 'Dictionaries'],
        ['loop', 'for ', 'while', 'Loops'],
        ['class', 'object', 'oop', 'inherit', 'OOP'],
        ['import', 'module', 'package', 'Modules'],
        ['string', 'str(', 'format', 'Strings'],
        ['exception', 'try', 'except', 'error', 'Error Handling'],
      ],
      'HTML/CSS': [
        ['color', 'background', 'CSS Colors'],
        ['font', 'text', 'typography', 'CSS Typography'],
        ['flex', 'grid', 'layout', 'CSS Layout'],
        ['tag', 'element', 'attribute', 'HTML Tags'],
        ['selector', 'class', 'id', 'CSS Selectors'],
      ],
      SQL: [
        ['select', 'SELECT'],
        ['join', 'Joins'],
        ['where', 'having', 'Filtering'],
        ['group', 'count', 'sum', 'avg', 'Aggregates'],
        ['primary', 'foreign', 'key', 'Constraints'],
        ['insert', 'update', 'delete', 'DML'],
      ],
      JavaScript: [
        ['array', 'push', 'map', 'filter', 'Arrays'],
        ['function', 'arrow', 'callback', 'Functions'],
        ['promise', 'async', 'await', 'Async'],
        ['var', 'let', 'const', 'Variables'],
        ['dom', 'document', 'element', 'DOM'],
        ['object', 'class', 'prototype', 'OOP'],
      ],
    };

    const rules = subtopicMap[topicName] || [];
    for (const rule of rules) {
      const keywords = rule.slice(0, -1);
      const label    = rule[rule.length - 1];
      if (keywords.some(kw => q.includes(kw))) return label;
    }
    return topicName + ' Basics';
  }

  function selectAnswer(idx) {
    if (chosen !== null) return;
    setChosen(idx);
    const subtopic = question.subtopic || (topic + ' Basics');
    recordAnswer(topic, subtopic, idx === question.correct);
  }

  async function goNext() {
    const nextQIdx = qIdx + 1;
    if (nextQIdx < QS_PER_TOPIC) {
      setQIdx(nextQIdx);
    } else {
      const nextTopicIdx = topicIdx + 1;
      if (nextTopicIdx < selectedTopics.length) {
        setTopicIdx(nextTopicIdx);
        setQIdx(0);
      } else {
        try { await saveResults(sessionKey, scores); } catch {}
        setPhase('graph');
      }
    }
  }

  return (
    <div className="quiz-wrapper">
      <div className="quiz-meta" style={{ maxWidth: 560 }}>
        <span style={{ fontWeight: 500 }}>{topic}</span>
        <span style={{ color: '#9CA3AF' }}>Q{doneQ + 1} of {totalQ}</span>
      </div>

      <div style={{ width: '100%', maxWidth: 560, marginBottom: 20 }}>
        <div className="progress-bar"><div style={{ width: `${progress}%` }} /></div>
      </div>

      {loading ? (
        <div className="quiz-loading">
          <div className="spinner" />
          <p>Generating <strong>{topic}</strong> question...</p>
        </div>
      ) : question ? (
        <div className="quiz-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="topic-label">{topic} · Q{qIdx + 1} of {QS_PER_TOPIC}</div>
            {question.subtopic && (
              <span style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 20,
                background: '#EEF0FF', color: '#6C63FF', fontWeight: 600
              }}>
                {question.subtopic}
              </span>
            )}
          </div>

          <h3>{question.question}</h3>

          <div className="options">
            {question.options.map((opt, i) => {
              let cls = 'option';
              if (chosen !== null) {
                if (i === question.correct) cls += ' correct';
                else if (i === chosen)      cls += ' wrong';
              }
              return (
                <button key={i} className={cls}
                  onClick={() => selectAnswer(i)}
                  disabled={chosen !== null}>
                  {opt}
                </button>
              );
            })}
          </div>

          {chosen !== null && (
            <div className={`feedback ${chosen === question.correct ? 'good' : 'bad'}`}>
              {chosen === question.correct ? '✓ Correct! ' : '✗ Wrong. '}
              {question.explanation}
            </div>
          )}

          {chosen !== null && (
            <button className="btn-primary" onClick={goNext}
              style={{ marginTop: 16, width: '100%' }}>
              {(doneQ + 1) >= totalQ ? 'See Knowledge Graph →' : 'Next Question →'}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
