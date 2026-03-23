import { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store/store';
import { generateProject } from '../api';

export default function KnowledgeGraph() {
  const {
    scores, selectedTopics, subtopicScores,
    sessionKey, setProjectData, setPhase,
    getWeakTopics, getStrongTopics,
    getWeakSubtopics, getStrongSubtopics,
  } = useStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [project, setProject]   = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab]   = useState('graph'); // 'graph' | 'todo'

  const weakTopics      = getWeakTopics();
  const strongTopics    = getStrongTopics();
  const weakSubtopics   = getWeakSubtopics();
  const strongSubtopics = getStrongSubtopics();

  useEffect(() => { buildGraph(); fetchProject(); }, []);

  function buildGraph() {
    const newNodes = [];
    const newEdges = [];

    // Center "You" node
    newNodes.push({
      id: 'you',
      data: { label: '🧠 You' },
      position: { x: 320, y: 280 },
      style: {
        background: '#6C63FF', color: 'white',
        border: '2px solid #4B44CC', borderRadius: 40,
        padding: '10px 20px', fontWeight: 700, fontSize: 14,
        boxShadow: '0 4px 14px rgba(108,99,255,0.35)',
      },
    });

    // Place topic nodes in a circle around "You"
    selectedTopics.forEach((topic, ti) => {
      const angle  = (ti / selectedTopics.length) * 2 * Math.PI - Math.PI / 2;
      const radius = 200;
      const tx     = 320 + radius * Math.cos(angle);
      const ty     = 280 + radius * Math.sin(angle);
      const s      = scores[topic] || { correct: 0, total: 0 };
      const pct    = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      const isWeak = weakTopics.includes(topic);

      newNodes.push({
        id: `topic-${topic}`,
        data: { label: `${topic}\n${pct}%` },
        position: { x: tx - 55, y: ty - 22 },
        style: {
          background: isWeak ? '#FEE2E2' : '#DCFCE7',
          color: isWeak ? '#991B1B' : '#166534',
          border: `2px solid ${isWeak ? '#EF4444' : '#22C55E'}`,
          borderRadius: 10, padding: '8px 16px',
          fontWeight: 600, fontSize: 13,
          whiteSpace: 'pre-line', textAlign: 'center',
          minWidth: 110,
        },
      });

      newEdges.push({
        id: `you-${topic}`,
        source: 'you',
        target: `topic-${topic}`,
        style: { stroke: isWeak ? '#EF4444' : '#22C55E', strokeWidth: 2 },
        animated: isWeak,
      });

      // Subtopic nodes — small satellites around each topic node
      const topicSubs = subtopicScores[topic] || {};
      const subEntries = Object.entries(topicSubs);

      subEntries.forEach(([subtopic, ss], si) => {
        const subAngle  = angle + ((si - (subEntries.length - 1) / 2) * 0.45);
        const subRadius = 130;
        const sx = tx + subRadius * Math.cos(subAngle);
        const sy = ty + subRadius * Math.sin(subAngle);
        const subPct    = ss.total > 0 ? Math.round((ss.correct / ss.total) * 100) : 0;
        const subIsWeak = subPct < 50;

        newNodes.push({
          id: `sub-${topic}-${subtopic}`,
          data: { label: `${subtopic}\n${subPct}%` },
          position: { x: sx - 45, y: sy - 18 },
          style: {
            background: subIsWeak ? '#FEF2F2' : '#F0FDF4',
            color: subIsWeak ? '#DC2626' : '#15803D',
            border: `1.5px solid ${subIsWeak ? '#FCA5A5' : '#86EFAC'}`,
            borderRadius: 8, padding: '5px 10px',
            fontSize: 11, fontWeight: 600,
            whiteSpace: 'pre-line', textAlign: 'center',
            minWidth: 90,
          },
        });

        newEdges.push({
          id: `${topic}-${subtopic}`,
          source: `topic-${topic}`,
          target: `sub-${topic}-${subtopic}`,
          style: {
            stroke: subIsWeak ? '#FCA5A5' : '#86EFAC',
            strokeWidth: 1.5,
            strokeDasharray: '4 2',
          },
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }

  async function fetchProject() {
    setGenerating(true);
    const weakSubs   = weakSubtopics.map(s => s.subtopic);
    const strongSubs = strongSubtopics.map(s => s.subtopic);
    try {
      const res = await generateProject(sessionKey, weakSubs.length ? weakSubs : weakTopics, strongSubs);
      setProject(res.data);
      setProjectData(res.data);
    } catch {
      // Build fallback project with todo list from weak subtopics
      const fallback = buildFallbackProject(weakSubtopics, weakTopics);
      setProject(fallback);
      setProjectData(fallback);
    }
    setGenerating(false);
  }

  function buildFallbackProject(weakSubs, weakTops) {
    const focusArea = weakSubs.length > 0
      ? weakSubs.map(s => s.subtopic).join(', ')
      : weakTops.join(', ') || 'General Practice';

    const todoMap = {
      // Python subtopics
      'Functions':      ['Define a function that takes 2 numbers and returns their sum', 'Write a function with default parameters', 'Create a lambda function for squaring numbers', 'Use *args to accept multiple inputs', 'Return multiple values from one function'],
      'Lists':          ['Create a list of 5 fruits', 'Use append() to add items to a list', 'Slice a list to get first 3 items', 'Use a for loop to print each item', 'Sort a list alphabetically'],
      'Dictionaries':   ['Create a student dictionary with name, age, grade', 'Access values using keys', 'Add a new key-value pair', 'Loop through all keys and values', 'Use .get() to safely access a key'],
      'Loops':          ['Write a for loop from 1 to 10', 'Use while loop to count down from 5', 'Use break to stop a loop early', 'Use continue to skip even numbers', 'Nest two loops to make a multiplication table'],
      'OOP':            ['Create a class called Animal with name property', 'Add a speak() method to the class', 'Create a Dog class that inherits from Animal', 'Override the speak() method in Dog', 'Create 3 instances and call speak()'],
      'Error Handling': ['Wrap division code in try/except', 'Catch a specific ValueError', 'Add a finally block', 'Raise a custom exception', 'Print meaningful error messages'],
      // JS subtopics
      'Variables':      ['Declare 3 variables using let and const', 'Understand difference between let and var', 'Create a constant for PI value', 'Reassign a let variable', 'Try to reassign const and observe error'],
      'Arrays':         ['Create an array of 5 colors', 'Use push() to add a new color', 'Use pop() to remove the last item', 'Use map() to convert all to uppercase', 'Use filter() to get colors longer than 4 chars'],
      'Functions':      ['Write a regular function and an arrow function', 'Create a function with default parameter', 'Write a callback function', 'Use a higher-order function', 'Return a function from a function'],
      'Async':          ['Create a basic Promise', 'Use .then() and .catch()', 'Write an async function', 'Use await to fetch data', 'Handle errors with try/catch in async'],
      // SQL subtopics
      'SELECT':         ['Write SELECT to get all columns', 'Select only name and email columns', 'Use DISTINCT to remove duplicates', 'Use LIMIT to get top 5 rows', 'Use ORDER BY to sort results'],
      'Joins':          ['Write an INNER JOIN between users and orders', 'Use LEFT JOIN to include all users', 'Join 3 tables together', 'Use table aliases in JOIN', 'Filter joined results with WHERE'],
      'Filtering':      ['Use WHERE to filter by age > 18', 'Use AND to combine two conditions', 'Use OR for alternative conditions', 'Use LIKE for partial text match', 'Use BETWEEN for a range'],
      'Aggregates':     ['Use COUNT(*) to count all rows', 'Use SUM() to total a column', 'Use AVG() to find average', 'Use GROUP BY to group results', 'Use HAVING to filter grouped results'],
      // HTML/CSS subtopics
      'HTML Tags':      ['Create a page with h1, p, and a tags', 'Add an image with alt text', 'Create an unordered list', 'Make a simple form with input and button', 'Add a table with 3 rows and 3 columns'],
      'CSS Layout':     ['Center a div using flexbox', 'Create a 2-column grid layout', 'Add padding and margin to elements', 'Make a sticky header', 'Create a responsive layout with media query'],
      'CSS Colors':     ['Set background and text colors', 'Use hex, rgb, and hsl color formats', 'Create a gradient background', 'Style a button with hover color change', 'Use CSS variables for a color theme'],
    };

    // Build todo list from weak subtopics
    const todos = [];
    weakSubs.forEach(({ topic, subtopic }) => {
      const tasks = todoMap[subtopic];
      if (tasks) {
        tasks.forEach(task => todos.push({ topic, subtopic, task, done: false }));
      }
    });

    // If no subtopic todos, use topic-level todos
    if (todos.length === 0) {
      weakTops.forEach(topic => {
        todos.push(
          { topic, subtopic: topic, task: `Study ${topic} fundamentals`, done: false },
          { topic, subtopic: topic, task: `Practice 5 ${topic} exercises`, done: false },
          { topic, subtopic: topic, task: `Build a small ${topic} project`, done: false },
        );
      });
    }

    return {
      title: `Practice Project: ${focusArea}`,
      description: `Focus on your weak areas: ${focusArea}. Complete the todo list below to improve systematically.`,
      weak_topics_addressed: weakTops,
      tech_stack: weakTops,
      starter_code: `# Practice: ${focusArea}\n# Complete each TODO below!\n\n# TODO 1: ${todos[0]?.task || 'Start practicing'}\n\n# TODO 2: ${todos[1]?.task || 'Write more code'}\n\n# TODO 3: ${todos[2]?.task || 'Test your solution'}\n`,
      todos,
    };
  }

  // Todo list component
  const [todoItems, setTodoItems] = useState([]);
  useEffect(() => {
    if (project?.todos) setTodoItems(project.todos.map((t, i) => ({ ...t, id: i })));
  }, [project]);

  function toggleTodo(id) {
    setTodoItems(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  const doneTodos  = todoItems.filter(t => t.done).length;
  const totalTodos = todoItems.length;

  return (
    <div className="graph-layout">
      {/* Graph area */}
      <div className="graph-main">
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView fitViewOptions={{ padding: 0.25 }}
        >
          <Background color="#E5E7EB" gap={20} />
          <Controls />
        </ReactFlow>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          display: 'flex', gap: 12, fontSize: 11,
          background: 'white', padding: '6px 12px',
          borderRadius: 8, border: '1px solid #E5E7EB',
        }}>
          <span style={{ color: '#166534' }}>● Strong topic</span>
          <span style={{ color: '#991B1B' }}>● Weak topic</span>
          <span style={{ color: '#15803D', opacity: 0.7 }}>◌ Strong subtopic</span>
          <span style={{ color: '#DC2626', opacity: 0.7 }}>◌ Weak subtopic</span>
        </div>
      </div>

      {/* Sidebar */}
      <div className="graph-sidebar">
        <div className="graph-sidebar-inner">

          {/* Score summary */}
          <div>
            <h3>📊 Your Scores</h3>
            <div className="score-list" style={{ marginTop: 10 }}>
              {selectedTopics.map(t => {
                const s   = scores[t] || { correct: 0, total: 0 };
                const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                const isWeak = weakTopics.includes(t);
                return (
                  <div key={t}>
                    <div className="score-item">
                      <span className="score-item-name" style={{ fontWeight: 600 }}>{t}</span>
                      <div className="score-bar-wrap">
                        <div className="score-mini-bar">
                          <div className="score-mini-fill"
                            style={{ width: `${pct}%`, background: isWeak ? '#EF4444' : '#22C55E' }} />
                        </div>
                        <span className="score-pct" style={{ color: isWeak ? '#EF4444' : '#22C55E' }}>{pct}%</span>
                      </div>
                    </div>

                    {/* Subtopic breakdown */}
                    {subtopicScores[t] && Object.entries(subtopicScores[t]).map(([sub, ss]) => {
                      const spct    = ss.total > 0 ? Math.round((ss.correct / ss.total) * 100) : 0;
                      const subWeak = spct < 50;
                      return (
                        <div key={sub} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 12, marginTop: 4 }}>
                          <span style={{ fontSize: 11, color: '#6B7280' }}>↳ {sub}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: subWeak ? '#EF4444' : '#22C55E' }}>
                            {subWeak ? '✗' : '✓'} {spct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {['graph', 'todo'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: activeTab === tab ? '#6C63FF' : '#F3F4F6',
                  color: activeTab === tab ? 'white' : '#6B7280',
                  fontFamily: 'inherit',
                }}>
                {tab === 'graph' ? '🗺 Analysis' : `✅ Todo (${doneTodos}/${totalTodos})`}
              </button>
            ))}
          </div>

          {/* Analysis Tab */}
          {activeTab === 'graph' && (
            <div>
              {weakSubtopics.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700, marginBottom: 6 }}>NEEDS WORK</div>
                  {weakSubtopics.map(({ topic, subtopic, correct, total }) => (
                    <div key={`${topic}-${subtopic}`} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 8px', background: '#FEF2F2',
                      borderRadius: 6, marginBottom: 4,
                    }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626' }}>{subtopic}</span>
                        <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 4 }}>({topic})</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                        {correct}/{total}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {strongSubtopics.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 700, marginBottom: 6 }}>STRONG</div>
                  {strongSubtopics.map(({ topic, subtopic, correct, total }) => (
                    <div key={`${topic}-${subtopic}`} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 8px', background: '#F0FDF4',
                      borderRadius: 6, marginBottom: 4,
                    }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#15803D' }}>{subtopic}</span>
                        <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 4 }}>({topic})</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>
                        {correct}/{total}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Project box */}
              <div className="project-box" style={{ marginTop: 12 }}>
                <h4>🚀 Recommended Project</h4>
                {generating ? (
                  <div className="generating"><div className="spinner" style={{ width: 14, height: 14 }} /><span>AI thinking...</span></div>
                ) : project ? (
                  <>
                    <p style={{ fontSize: 12 }}>{project.description}</p>
                    <div className="tech-list" style={{ margin: '8px 0' }}>
                      {(project.tech_stack || []).map(t => (
                        <span key={t} className="badge purple">{t}</span>
                      ))}
                    </div>
                    <button className="btn-primary" style={{ width: '100%', fontSize: 12 }}
                      onClick={() => setPhase('editor')}>
                      Open Code Editor →
                    </button>
                    <button onClick={() => setActiveTab('todo')}
                      style={{
                        width: '100%', marginTop: 6, padding: '7px 0',
                        fontSize: 12, borderRadius: 8, border: '1px solid #6C63FF',
                        background: 'white', color: '#6C63FF', cursor: 'pointer',
                        fontFamily: 'inherit', fontWeight: 600,
                      }}>
                      View Todo List ({totalTodos} tasks) →
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* Todo Tab */}
          {activeTab === 'todo' && (
            <div>
              {totalTodos > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Progress</span>
                    <span style={{ fontSize: 12, color: '#6C63FF', fontWeight: 600 }}>{doneTodos}/{totalTodos}</span>
                  </div>
                  <div className="progress-bar">
                    <div style={{ width: `${totalTodos > 0 ? (doneTodos / totalTodos) * 100 : 0}%` }} />
                  </div>
                </div>
              )}

              {/* Group todos by subtopic */}
              {(() => {
                const grouped = {};
                todoItems.forEach(t => {
                  const key = `${t.subtopic} (${t.topic})`;
                  if (!grouped[key]) grouped[key] = [];
                  grouped[key].push(t);
                });
                return Object.entries(grouped).map(([group, items]) => (
                  <div key={group} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6C63FF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {group}
                    </div>
                    {items.map(todo => (
                      <div key={todo.id}
                        onClick={() => toggleTodo(todo.id)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '7px 8px', borderRadius: 7, marginBottom: 4,
                          cursor: 'pointer', background: todo.done ? '#F0FDF4' : '#F9FAFB',
                          border: `1px solid ${todo.done ? '#86EFAC' : '#E5E7EB'}`,
                          transition: 'all 0.15s',
                        }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                          background: todo.done ? '#22C55E' : 'white',
                          border: `2px solid ${todo.done ? '#22C55E' : '#D1D5DB'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {todo.done && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{
                          fontSize: 12, lineHeight: 1.5,
                          color: todo.done ? '#6B7280' : '#374151',
                          textDecoration: todo.done ? 'line-through' : 'none',
                        }}>
                          {todo.task}
                        </span>
                      </div>
                    ))}
                  </div>
                ));
              })()}

              {todoItems.length === 0 && (
                <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingTop: 20 }}>
                  Complete the quiz to get your personalized todo list!
                </div>
              )}

              {doneTodos === totalTodos && totalTodos > 0 && (
                <div style={{
                  textAlign: 'center', padding: '12px 8px',
                  background: '#F0FDF4', borderRadius: 8,
                  border: '1px solid #86EFAC', marginTop: 8,
                }}>
                  <div style={{ fontSize: 20 }}>🎉</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#15803D', marginTop: 4 }}>
                    All tasks done!
                  </div>
                  <button className="btn-primary" style={{ marginTop: 8, fontSize: 12 }}
                    onClick={() => setPhase('editor')}>
                    Now build the project →
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
