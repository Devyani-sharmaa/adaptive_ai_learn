import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store/store';
import { generateProject } from '../api';

// ── Custom Node Components ───────────────────────────────────────────────────

function CenterNode({ data }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #6C63FF 0%, #4B44CC 100%)',
      color: 'white',
      borderRadius: 50,
      padding: '14px 24px',
      fontWeight: 800,
      fontSize: 15,
      boxShadow: '0 0 0 4px rgba(108,99,255,0.25), 0 8px 24px rgba(108,99,255,0.4)',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      letterSpacing: '0.02em',
    }}>
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

function TopicNode({ data }) {
  const isWeak = data.isWeak;
  return (
    <div style={{
      background: isWeak
        ? 'linear-gradient(135deg, #FF4444 0%, #CC0000 100%)'
        : 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
      color: 'white',
      borderRadius: 12,
      padding: '10px 18px',
      fontWeight: 700,
      fontSize: 13,
      textAlign: 'center',
      minWidth: 120,
      boxShadow: isWeak
        ? '0 0 0 3px rgba(255,68,68,0.3), 0 4px 16px rgba(204,0,0,0.35)'
        : '0 0 0 3px rgba(34,197,94,0.3), 0 4px 16px rgba(22,163,74,0.3)',
      position: 'relative',
    }}>
      {isWeak && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          background: '#FF0000', color: 'white',
          borderRadius: 10, fontSize: 10, fontWeight: 800,
          padding: '2px 6px', border: '2px solid white',
        }}>WEAK</div>
      )}
      {!isWeak && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          background: '#16A34A', color: 'white',
          borderRadius: 10, fontSize: 10, fontWeight: 800,
          padding: '2px 6px', border: '2px solid white',
        }}>STRONG</div>
      )}
      <div style={{ fontSize: 14, fontWeight: 800 }}>{data.topicName}</div>
      <div style={{
        fontSize: 18, fontWeight: 900, marginTop: 2,
        color: isWeak ? '#FFD0D0' : '#D0FFE4',
      }}>{data.pct}%</div>
      <div style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>
        {data.correct}/{data.total} correct
      </div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

function SubtopicNode({ data }) {
  const isWeak = data.isWeak;
  return (
    <div style={{
      background: isWeak ? '#FFF0F0' : '#F0FFF4',
      color: isWeak ? '#CC0000' : '#166534',
      border: `2px solid ${isWeak ? '#FF4444' : '#22C55E'}`,
      borderRadius: 8,
      padding: '5px 12px',
      fontSize: 11,
      fontWeight: 700,
      textAlign: 'center',
      minWidth: 90,
      boxShadow: isWeak
        ? '0 2px 8px rgba(255,68,68,0.2)'
        : '0 2px 8px rgba(34,197,94,0.15)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700 }}>{data.subtopicName}</div>
      <div style={{
        fontSize: 13, fontWeight: 900, marginTop: 1,
        color: isWeak ? '#FF0000' : '#16A34A',
      }}>{data.pct}%</div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const NODE_TYPES = {
  centerNode:   CenterNode,
  topicNode:    TopicNode,
  subtopicNode: SubtopicNode,
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function KnowledgeGraph() {
  const {
    scores, selectedTopics, subtopicScores,
    sessionKey, setProjectData, setPhase,
    getWeakTopics, getStrongTopics,
    getWeakSubtopics, getStrongSubtopics,
  } = useStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [project, setProject]     = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab]   = useState('graph');
  const [todoItems, setTodoItems]   = useState([]);

  const weakTopics      = getWeakTopics();
  const strongTopics    = getStrongTopics();
  const weakSubtopics   = getWeakSubtopics();
  const strongSubtopics = getStrongSubtopics();

  useEffect(() => {
    buildGraph();
    fetchProject();
  }, []);

  useEffect(() => {
    if (project?.todos) {
      setTodoItems(project.todos.map((t, i) => ({ ...t, id: i })));
    }
  }, [project]);

  function buildGraph() {
    const newNodes = [];
    const newEdges = [];
    const count = selectedTopics.length;

    // Center node
    newNodes.push({
      id: 'you',
      type: 'centerNode',
      data: { label: '🧠 You' },
      position: { x: 350, y: 300 },
    });

    selectedTopics.forEach((topic, ti) => {
      const angle  = (ti / count) * 2 * Math.PI - Math.PI / 2;
      const radius = 220;
      const tx = 350 + radius * Math.cos(angle);
      const ty = 300 + radius * Math.sin(angle);
      const s   = scores[topic] || { correct: 0, total: 0 };
      const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      const isWeak = weakTopics.includes(topic);

      newNodes.push({
        id: `topic-${topic}`,
        type: 'topicNode',
        data: {
          topicName: topic,
          pct,
          correct: s.correct,
          total: s.total,
          isWeak,
        },
        position: { x: tx - 60, y: ty - 35 },
      });

      // Edge: You → Topic
      newEdges.push({
        id: `you-${topic}`,
        source: 'you',
        target: `topic-${topic}`,
        style: {
          stroke: isWeak ? '#FF4444' : '#22C55E',
          strokeWidth: isWeak ? 3 : 2,
          strokeDasharray: isWeak ? '6 3' : undefined,
        },
        animated: isWeak,
      });

      // Subtopic nodes
      const topicSubs  = subtopicScores[topic] || {};
      const subEntries = Object.entries(topicSubs);

      subEntries.forEach(([subtopic, ss], si) => {
        const spreadAngle = subEntries.length === 1 ? 0
          : ((si / (subEntries.length - 1)) - 0.5) * 0.9;
        const subAngle  = angle + spreadAngle;
        const subRadius = 150;
        const sx = tx + subRadius * Math.cos(subAngle);
        const sy = ty + subRadius * Math.sin(subAngle);
        const subPct    = ss.total > 0 ? Math.round((ss.correct / ss.total) * 100) : 0;
        const subIsWeak = subPct < 50;

        newNodes.push({
          id: `sub-${topic}-${subtopic}`,
          type: 'subtopicNode',
          data: {
            subtopicName: subtopic,
            pct: subPct,
            isWeak: subIsWeak,
          },
          position: { x: sx - 45, y: sy - 20 },
        });

        newEdges.push({
          id: `edge-${topic}-${subtopic}`,
          source: `topic-${topic}`,
          target: `sub-${topic}-${subtopic}`,
          style: {
            stroke: subIsWeak ? '#FF8888' : '#86EFAC',
            strokeWidth: 1.5,
            strokeDasharray: '4 3',
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
      const res = await generateProject(
        sessionKey,
        weakSubs.length ? weakSubs : weakTopics,
        strongSubs
      );
      setProject(res.data);
      setProjectData(res.data);
    } catch {
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
      'Functions':      ['Define a function that takes 2 numbers and returns sum','Write a function with default parameters','Create a lambda for squaring numbers','Use *args to accept multiple inputs','Return multiple values from one function'],
      'Lists':          ['Create a list of 5 fruits','Use append() to add items','Slice list to get first 3 items','Loop through and print each item','Sort list alphabetically'],
      'Dictionaries':   ['Create a student dict with name, age, grade','Access values using keys','Add a new key-value pair','Loop through all keys and values','Use .get() to safely access a key'],
      'Loops':          ['Write a for loop from 1 to 10','Use while to count down from 5','Use break to stop a loop early','Use continue to skip even numbers','Nest two loops for multiplication table'],
      'OOP':            ['Create a class called Animal','Add a speak() method','Create Dog class inheriting Animal','Override speak() in Dog','Create 3 instances and call speak()'],
      'Error Handling': ['Wrap division in try/except','Catch a specific ValueError','Add a finally block','Raise a custom exception','Print meaningful error messages'],
      'Variables':      ['Declare 3 variables using let and const','Understand let vs var','Create constant for PI','Reassign a let variable','Try to reassign const and observe error'],
      'Arrays':         ['Create array of 5 colors','Use push() to add color','Use pop() to remove last','Use map() to uppercase all','Use filter() for items > 4 chars'],
      'SELECT':         ['Write SELECT for all columns','Select only name and email','Use DISTINCT to remove duplicates','Use LIMIT to get top 5','Use ORDER BY to sort results'],
      'Joins':          ['Write INNER JOIN between users and orders','Use LEFT JOIN to include all users','Join 3 tables','Use table aliases in JOIN','Filter joined results with WHERE'],
      'Filtering':      ['Use WHERE to filter by age > 18','Use AND to combine conditions','Use OR for alternatives','Use LIKE for text match','Use BETWEEN for a range'],
      'HTML Tags':      ['Create page with h1, p, a tags','Add image with alt text','Create unordered list','Make form with input and button','Add table with 3x3 rows'],
      'CSS Layout':     ['Center div using flexbox','Create 2-column grid layout','Add padding and margin','Make a sticky header','Create responsive layout with media query'],
      'CSS Colors':     ['Set background and text colors','Use hex, rgb, hsl formats','Create gradient background','Style button with hover change','Use CSS variables for theme'],
    };

    const todos = [];
    weakSubs.forEach(({ topic, subtopic }) => {
      const tasks = todoMap[subtopic];
      if (tasks) tasks.forEach(task => todos.push({ topic, subtopic, task, done: false }));
    });

    if (todos.length === 0) {
      weakTops.forEach(t => {
        todos.push(
          { topic: t, subtopic: t, task: `Study ${t} fundamentals`, done: false },
          { topic: t, subtopic: t, task: `Practice 5 ${t} exercises`, done: false },
          { topic: t, subtopic: t, task: `Build a small ${t} project`, done: false },
        );
      });
    }

    return {
      title: `Practice: ${focusArea}`,
      description: `Target your weak areas: ${focusArea}. Use the todo list to improve step by step.`,
      weak_topics_addressed: weakTops,
      tech_stack: weakTops,
      starter_code: `# Practice: ${focusArea}\n\n# TODO 1: ${todos[0]?.task || 'Start here'}\n\n# TODO 2: ${todos[1]?.task || 'Keep going'}\n`,
      todos,
    };
  }

  function toggleTodo(id) {
    setTodoItems(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  const doneTodos  = todoItems.filter(t => t.done).length;
  const totalTodos = todoItems.length;

  return (
    <div className="graph-layout">

      {/* ── React Flow Graph ── */}
      <div className="graph-main" style={{ position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
        >
          <Background color="#E5E7EB" gap={24} />
          <Controls />
        </ReactFlow>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          background: 'white', border: '1px solid #E5E7EB',
          borderRadius: 10, padding: '8px 14px',
          display: 'flex', gap: 16, fontSize: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#CC0000', fontWeight: 600 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#FF4444', display: 'inline-block' }} />
            Weak (needs work)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#166534', fontWeight: 600 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#22C55E', display: 'inline-block' }} />
            Strong
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Dashed = weak connection</span>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div className="graph-sidebar">
        <div className="graph-sidebar-inner">

          {/* Score summary */}
          <div>
            <h3>📊 Your Scores</h3>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedTopics.map(t => {
                const s   = scores[t] || { correct: 0, total: 0 };
                const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                const isWeak = weakTopics.includes(t);
                return (
                  <div key={t}>
                    {/* Topic row */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', padding: '6px 10px',
                      borderRadius: 8,
                      background: isWeak ? '#FFF0F0' : '#F0FFF4',
                      border: `1.5px solid ${isWeak ? '#FF4444' : '#22C55E'}`,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isWeak ? '#CC0000' : '#166534' }}>
                        {isWeak ? '❌' : '✅'} {t}
                      </span>
                      <span style={{
                        fontSize: 14, fontWeight: 800,
                        color: isWeak ? '#FF0000' : '#16A34A',
                      }}>{pct}%</span>
                    </div>

                    {/* Subtopic rows */}
                    {subtopicScores[t] && Object.entries(subtopicScores[t]).map(([sub, ss]) => {
                      const sp = ss.total > 0 ? Math.round((ss.correct / ss.total) * 100) : 0;
                      const sw = sp < 50;
                      return (
                        <div key={sub} style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px 10px 4px 20px',
                          marginTop: 3,
                          borderRadius: 6,
                          background: sw ? '#FFF5F5' : '#F5FFF8',
                          borderLeft: `3px solid ${sw ? '#FF8888' : '#86EFAC'}`,
                        }}>
                          <span style={{ fontSize: 11, color: sw ? '#DC2626' : '#15803D', fontWeight: 600 }}>
                            {sw ? '↳ ⚠' : '↳ ✓'} {sub}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: sw ? '#EF4444' : '#22C55E' }}>
                            {ss.correct}/{ss.total}
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
          <div style={{ display: 'flex', gap: 6 }}>
            {['graph', 'todo'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700,
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeTab === tab ? '#6C63FF' : '#F3F4F6',
                color: activeTab === tab ? 'white' : '#6B7280',
                fontFamily: 'inherit',
              }}>
                {tab === 'graph' ? '🎯 Analysis' : `✅ Todo (${doneTodos}/${totalTodos})`}
              </button>
            ))}
          </div>

          {/* Analysis Tab */}
          {activeTab === 'graph' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weakSubtopics.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#FF0000', marginBottom: 6, textTransform: 'uppercase' }}>
                    🔴 Needs Work
                  </div>
                  {weakSubtopics.map(({ topic, subtopic, correct, total }) => (
                    <div key={`${topic}-${subtopic}`} style={{
                      padding: '7px 10px', borderRadius: 8, marginBottom: 4,
                      background: 'linear-gradient(135deg, #FFF0F0, #FFE8E8)',
                      border: '1.5px solid #FF4444',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#CC0000' }}>{subtopic}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#FF0000' }}>
                          {total > 0 ? Math.round((correct/total)*100) : 0}%
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Topic: {topic} · {correct}/{total} correct</div>
                    </div>
                  ))}
                </div>
              )}

              {strongSubtopics.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#16A34A', marginBottom: 6, textTransform: 'uppercase' }}>
                    🟢 Strong
                  </div>
                  {strongSubtopics.map(({ topic, subtopic, correct, total }) => (
                    <div key={`${topic}-${subtopic}`} style={{
                      padding: '7px 10px', borderRadius: 8, marginBottom: 4,
                      background: 'linear-gradient(135deg, #F0FFF4, #E8FFEe)',
                      border: '1.5px solid #22C55E',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>{subtopic}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#16A34A' }}>
                          {total > 0 ? Math.round((correct/total)*100) : 0}%
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Topic: {topic} · {correct}/{total} correct</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Project Box */}
              <div style={{
                background: 'linear-gradient(135deg, #EEF0FF, #E8E6FF)',
                border: '1.5px solid #6C63FF',
                borderRadius: 10, padding: 14,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4B44CC', marginBottom: 6 }}>🚀 Mini Project</div>
                {generating ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6B7280' }}>
                    <div className="spinner" style={{ width: 14, height: 14 }} /> AI generating...
                  </div>
                ) : project ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#26215C', marginBottom: 4 }}>{project.title}</div>
                    <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 10, lineHeight: 1.5 }}>{project.description}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      {(project.tech_stack || []).map(t => (
                        <span key={t} style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 20,
                          background: '#EEF0FF', color: '#4B44CC', fontWeight: 600,
                        }}>{t}</span>
                      ))}
                    </div>
                    <button className="btn-primary" style={{ width: '100%', fontSize: 12, marginBottom: 6 }}
                      onClick={() => setPhase('editor')}>
                      Open Code Editor →
                    </button>
                    <button onClick={() => setActiveTab('todo')} style={{
                      width: '100%', padding: '7px 0', fontSize: 12,
                      borderRadius: 8, border: '1.5px solid #6C63FF',
                      background: 'white', color: '#6C63FF',
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                    }}>
                      View Todo ({totalTodos} tasks) →
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
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Progress</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6C63FF' }}>{doneTodos}/{totalTodos}</span>
                  </div>
                  <div className="progress-bar"><div style={{ width: `${totalTodos > 0 ? (doneTodos/totalTodos)*100 : 0}%` }} /></div>
                </div>
              )}

              {(() => {
                const grouped = {};
                todoItems.forEach(t => {
                  const key = t.subtopic;
                  if (!grouped[key]) grouped[key] = { topic: t.topic, items: [] };
                  grouped[key].items.push(t);
                });
                return Object.entries(grouped).map(([subtopic, { topic, items }]) => {
                  const allDone = items.every(i => i.done);
                  return (
                    <div key={subtopic} style={{ marginBottom: 14 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 800, marginBottom: 6,
                        color: allDone ? '#16A34A' : '#CC0000',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        display: 'flex', justifyContent: 'space-between',
                      }}>
                        <span>{allDone ? '✅' : '🔴'} {subtopic}</span>
                        <span style={{ color: '#9CA3AF', fontWeight: 500, textTransform: 'none' }}>{topic}</span>
                      </div>
                      {items.map(todo => (
                        <div key={todo.id} onClick={() => toggleTodo(todo.id)} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '7px 10px', borderRadius: 8, marginBottom: 4,
                          cursor: 'pointer',
                          background: todo.done ? '#F0FDF4' : '#FAFAFA',
                          border: `1px solid ${todo.done ? '#86EFAC' : '#E5E7EB'}`,
                          transition: 'all 0.15s',
                        }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: 4,
                            flexShrink: 0, marginTop: 1,
                            background: todo.done ? '#22C55E' : 'white',
                            border: `2px solid ${todo.done ? '#22C55E' : '#D1D5DB'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {todo.done && <span style={{ color: 'white', fontSize: 10, fontWeight: 800 }}>✓</span>}
                          </div>
                          <span style={{
                            fontSize: 12, lineHeight: 1.5,
                            color: todo.done ? '#6B7280' : '#374151',
                            textDecoration: todo.done ? 'line-through' : 'none',
                          }}>{todo.task}</span>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}

              {doneTodos === totalTodos && totalTodos > 0 && (
                <div style={{
                  textAlign: 'center', padding: 16,
                  background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
                  borderRadius: 10, border: '1.5px solid #22C55E',
                }}>
                  <div style={{ fontSize: 28 }}>🎉</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#15803D', marginTop: 6 }}>All done!</div>
                  <button className="btn-primary" style={{ marginTop: 10, fontSize: 12 }}
                    onClick={() => setPhase('editor')}>Build the project →</button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
