import { useState, useRef, useCallback } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useStore } from '../store/store';
import { streamCodeReview } from '../api';

// ─── Smart Code Analyzer (works WITHOUT Ollama) ─────────────────────────────

// Python built-in names — these are valid, not undefined variables
const PYTHON_BUILTINS = new Set([
  'print','input','len','range','int','str','float','bool','list','dict','set',
  'tuple','type','isinstance','id','abs','round','min','max','sum','sorted',
  'reversed','enumerate','zip','map','filter','open','help','dir','vars',
  'hasattr','getattr','setattr','repr','format','chr','ord','hex','oct','bin',
  'True','False','None','and','or','not','in','is','if','else','elif','for',
  'while','def','class','return','import','from','as','with','try','except',
  'finally','raise','pass','break','continue','lambda','yield','global',
  'nonlocal','del','assert','self','super','__init__','__str__','__repr__',
  'append','extend','insert','remove','pop','clear','index','count','sort',
  'reverse','keys','values','items','get','update','split','join','strip',
  'replace','find','upper','lower','startswith','endswith','read','write',
  'close','print','args','kwargs','object','Exception','ValueError','TypeError',
  'IndexError','KeyError','AttributeError','NameError','FileNotFoundError',
]);

const JS_BUILTINS = new Set([
  'console','log','window','document','Math','JSON','Array','Object','String',
  'Number','Boolean','parseInt','parseFloat','isNaN','undefined','null','true',
  'false','let','const','var','function','return','if','else','for','while',
  'class','import','export','default','new','this','typeof','instanceof',
  'setTimeout','setInterval','clearTimeout','clearInterval','fetch','Promise',
  'async','await','try','catch','finally','throw','Error','length','push',
  'pop','shift','unshift','map','filter','reduce','forEach','find','includes',
  'indexOf','slice','splice','join','split','toString','parseInt','parseFloat',
  'addEventListener','querySelector','getElementById','createElement','alert',
]);

const SQL_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','JOIN','ON','GROUP','BY','ORDER','HAVING','INSERT',
  'INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','DROP','ALTER','ADD',
  'COLUMN','INDEX','PRIMARY','KEY','FOREIGN','REFERENCES','NOT','NULL','AND',
  'OR','IN','LIKE','BETWEEN','AS','DISTINCT','LIMIT','OFFSET','COUNT','SUM',
  'AVG','MIN','MAX','INNER','LEFT','RIGHT','FULL','OUTER','UNION','ALL',
  'EXISTS','CASE','WHEN','THEN','ELSE','END','IS','ASC','DESC','INT','VARCHAR',
  'TEXT','DATE','BOOLEAN','SERIAL','AUTO_INCREMENT','DEFAULT','UNIQUE',
]);

// ── Python deep analysis ────────────────────────────────────────────────────
function analyzePython(lines) {
  const issues = [];
  const defined = new Set(PYTHON_BUILTINS);

  lines.forEach((line, i) => {
    const ln = i + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    // Track variable definitions  →  x = ..., def x, class X, for x in, import x
    const assignMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=/);
    if (assignMatch) defined.add(assignMatch[1]);

    const defMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)/);
    if (defMatch) defined.add(defMatch[1]);

    const classMatch = trimmed.match(/^class\s+([a-zA-Z_]\w*)/);
    if (classMatch) defined.add(classMatch[1]);

    const forMatch = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s+in/);
    if (forMatch) defined.add(forMatch[1]);

    const importMatch = trimmed.match(/^import\s+([a-zA-Z_]\w*)/);
    if (importMatch) defined.add(importMatch[1]);

    const fromMatch = trimmed.match(/^from\s+\S+\s+import\s+([a-zA-Z_]\w*)/);
    if (fromMatch) defined.add(fromMatch[1]);

    // ── Rule checks ─────────────────────────────────────────────────

    // print without parens: print "hello"
    if (/^print\s+[^(]/.test(trimmed)) {
      issues.push({ type: 'error', line: ln,
        msg: `print() without parentheses — Python 3 mein print() function hai`,
        fix: `print(${trimmed.slice(6).trim()})` });
    }

    // Undefined variables inside print(...)
    const printArgsMatch = trimmed.match(/^print\(([^)]+)\)/);
    if (printArgsMatch) {
      const args = printArgsMatch[1].split(',');
      args.forEach(arg => {
        const a = arg.trim();
        // Pure identifier (not string, not number, not expression)
        if (/^[a-zA-Z_]\w*$/.test(a) && !defined.has(a)) {
          issues.push({ type: 'error', line: ln,
            msg: `'${a}' is not defined — variable define nahi ki`,
            fix: `${a} = "your_value"  # pehle yeh add karo line ${ln} se upar` });
        }
      });
    }

    // Missing colon after if/for/while/def/class/else/elif/try/except
    if (/^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(trimmed)
        && !trimmed.endsWith(':')
        && !trimmed.endsWith('\\')) {
      issues.push({ type: 'error', line: ln,
        msg: `Line ${ln}: Missing ':' at end of ${trimmed.split(' ')[0]} statement`,
        fix: `${trimmed}:` });
    }

    // = instead of == in if condition
    if (/^if\s+\w+\s*=[^=]/.test(trimmed)) {
      issues.push({ type: 'error', line: ln,
        msg: `Line ${ln}: '=' used in if condition — use '==' for comparison`,
        fix: trimmed.replace(/=([^=])/, '==$1') });
    }

    // Indentation with tabs
    if (/^\t/.test(line)) {
      issues.push({ type: 'warning', line: ln,
        msg: `Line ${ln}: Tab indentation — use 4 spaces instead`,
        fix: line.replace(/\t/g, '    ') });
    }

    // Division without float check
    if (/\/[^/=]/.test(trimmed) && !/float|\.0/.test(trimmed)) {
      issues.push({ type: 'tip', line: ln,
        msg: `Tip: Integer division possible — use float() if decimal result chahiye`,
        fix: `float(numerator) / float(denominator)` });
    }

    // bare except
    if (/^except\s*:/.test(trimmed)) {
      issues.push({ type: 'warning', line: ln,
        msg: `Line ${ln}: Bare 'except:' catches everything — specify exception type`,
        fix: `except Exception as e:` });
    }
  });

  return issues;
}

// ── JavaScript deep analysis ────────────────────────────────────────────────
function analyzeJavaScript(lines) {
  const issues = [];
  const defined = new Set(JS_BUILTINS);

  lines.forEach((line, i) => {
    const ln = i + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) return;

    // Track declarations
    const letConst = trimmed.match(/(?:let|const|var)\s+([a-zA-Z_]\w*)/);
    if (letConst) defined.add(letConst[1]);
    const fnMatch = trimmed.match(/function\s+([a-zA-Z_]\w*)/);
    if (fnMatch) defined.add(fnMatch[1]);

    // var usage
    if (/\bvar\s+/.test(trimmed)) {
      issues.push({ type: 'warning', line: ln,
        msg: `Line ${ln}: 'var' avoids — use 'let' ya 'const'`,
        fix: trimmed.replace(/\bvar\b/, 'let') });
    }

    // == instead of ===
    if (/[^=!<>]==[^=]/.test(trimmed)) {
      issues.push({ type: 'error', line: ln,
        msg: `Line ${ln}: '==' use mat karo — '===' (strict equality) use karo`,
        fix: trimmed.replace(/([^=!<>])==([^=])/g, '$1===$2') });
    }

    // Missing semicolon (simple heuristic)
    if (trimmed.length > 0
        && !trimmed.endsWith('{') && !trimmed.endsWith('}')
        && !trimmed.endsWith(';') && !trimmed.endsWith(',')
        && !trimmed.startsWith('//') && !trimmed.startsWith('*')
        && /^(let|const|var|return|console|throw)\b/.test(trimmed)) {
      issues.push({ type: 'warning', line: ln,
        msg: `Line ${ln}: Missing semicolon ';' at end`,
        fix: `${trimmed};` });
    }

    // console.log left in
    if (/console\.log/.test(trimmed)) {
      issues.push({ type: 'tip', line: ln,
        msg: `Line ${ln}: console.log() production mein remove karna`,
        fix: `// ${trimmed}  ← remove before deploy` });
    }
  });

  return issues;
}

// ── HTML/CSS deep analysis ─────────────────────────────────────────────────
function analyzeHTML(lines) {
  const issues = [];
  lines.forEach((line, i) => {
    const ln = i + 1;
    const trimmed = line.trim();

    if (/<img(?![^>]*alt=)[^>]*>/.test(trimmed)) {
      issues.push({ type: 'error', line: ln,
        msg: `Line ${ln}: <img> mein alt attribute missing — accessibility issue`,
        fix: `<img src="..." alt="description here">` });
    }
    if (/style\s*=/.test(trimmed)) {
      issues.push({ type: 'tip', line: ln,
        msg: `Line ${ln}: Inline style — CSS class mein move karo for reusability`,
        fix: `class="my-style"  then CSS mein: .my-style { ... }` });
    }
    if (/!important/.test(trimmed)) {
      issues.push({ type: 'warning', line: ln,
        msg: `Line ${ln}: !important avoid karo — specificity issues create karta hai`,
        fix: trimmed.replace(/\s*!important/g, '') });
    }
    if (/<a(?![^>]*href)[^>]*>/.test(trimmed)) {
      issues.push({ type: 'error', line: ln,
        msg: `Line ${ln}: <a> tag mein href missing`,
        fix: `<a href="url">link text</a>` });
    }
  });
  return issues;
}

// ── SQL deep analysis ──────────────────────────────────────────────────────
function analyzeSQL(lines) {
  const issues = [];
  lines.forEach((line, i) => {
    const ln = i + 1;
    const trimmed = line.trim().toUpperCase();

    if (/SELECT \*/.test(trimmed)) {
      issues.push({ type: 'warning', line: ln,
        msg: `Line ${ln}: SELECT * slow hota hai — specific columns likho`,
        fix: `SELECT id, name, email FROM ...` });
    }
    if (/DELETE FROM/.test(trimmed) && !/WHERE/.test(trimmed)) {
      issues.push({ type: 'error', line: ln,
        msg: `⚠ Line ${ln}: DELETE without WHERE — SAARA data delete ho jayega!`,
        fix: `DELETE FROM table WHERE id = ?` });
    }
    if (/DROP TABLE/.test(trimmed)) {
      issues.push({ type: 'error', line: ln,
        msg: `⚠ Line ${ln}: DROP TABLE permanently table delete karta hai!`,
        fix: `-- Are you sure? Add: DROP TABLE IF EXISTS table_name` });
    }
    if (/JOIN/.test(trimmed) && !/ON\s/.test(trimmed)) {
      issues.push({ type: 'error', line: ln,
        msg: `Line ${ln}: JOIN mein ON condition missing — cartesian product ban jayega`,
        fix: `JOIN table2 ON table1.id = table2.fk_id` });
    }
  });
  return issues;
}

// ── Main analysis dispatcher ───────────────────────────────────────────────
function analyzeCodeLocally(code, topic) {
  const lines = code.split('\n');
  let issues  = [];

  if (topic === 'Python')          issues = analyzePython(lines);
  else if (topic === 'JavaScript') issues = analyzeJavaScript(lines);
  else if (topic === 'HTML/CSS')   issues = analyzeHTML(lines);
  else if (topic === 'SQL')        issues = analyzeSQL(lines);

  // Deduplicate by message
  const seen = new Set();
  const unique = issues.filter(iss => {
    if (seen.has(iss.msg)) return false;
    seen.add(iss.msg);
    return true;
  }).slice(0, 6);

  if (unique.length === 0) {
    return '✅ No issues found!\n\nSuggestions:\n• Add comments to explain logic\n• Handle edge cases\n• Test with different inputs';
  }

  const errors   = unique.filter(i => i.type === 'error');
  const warnings = unique.filter(i => i.type === 'warning');
  const tips     = unique.filter(i => i.type === 'tip');

  let out = '';

  if (errors.length) {
    out += '🔴 Errors (fix karo):\n';
    errors.forEach(e => {
      out += `• ${e.msg}\n`;
      if (e.fix) out += `  ✏ Fix: ${e.fix}\n`;
    });
    out += '\n';
  }
  if (warnings.length) {
    out += '⚠ Warnings:\n';
    warnings.forEach(w => {
      out += `• ${w.msg}\n`;
      if (w.fix) out += `  ✏ Fix: ${w.fix}\n`;
    });
    out += '\n';
  }
  if (tips.length) {
    out += '💡 Tips:\n';
    tips.forEach(t => {
      out += `• ${t.msg}\n`;
      if (t.fix) out += `  ✏ Better: ${t.fix}\n`;
    });
  }

  return out.trim();
}
// ────────────────────────────────────────────────────────────────────────────

export default function CodeEditor() {
  const { projectData, getWeakTopics, getStrongTopics } = useStore();
  const weakTopics   = getWeakTopics();
  const strongTopics = getStrongTopics();
  const primaryTopic = projectData?.weak_topics_addressed?.[0] || weakTopics[0] || 'Python';

  const langMap = { 'Python': 'python', 'JavaScript': 'javascript', 'HTML/CSS': 'html', 'SQL': 'sql' };
  const language = langMap[primaryTopic] || 'python';

  const filenameMap = { 'Python': 'main.py', 'JavaScript': 'main.js', 'HTML/CSS': 'index.html', 'SQL': 'query.sql' };
  const filename = filenameMap[primaryTopic] || 'main.py';

  const [code, setCode]         = useState(projectData?.starter_code || getStarterCode(primaryTopic));
  const [feedback, setFeedback] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [usingOllama, setUsingOllama] = useState(false);
  const debounceRef = useRef(null);

  const handleCodeChange = useCallback((value) => {
    setCode(value || '');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!value || value.trim().length < 5) return;
      startReview(value);
    }, 1200);
  }, [primaryTopic]);

  function startReview(codeToReview) {
    setReviewing(true);

    // First: instant local analysis
    const localResult = analyzeCodeLocally(codeToReview, primaryTopic);
    setFeedback(localResult);

    // Then try Ollama for deeper analysis (non-blocking)
    setUsingOllama(true);
    let ollamaFeedback = '';
    let ollamaWorked   = false;

    const timeout = setTimeout(() => {
      // Ollama too slow or not running — keep local result
      if (!ollamaWorked) {
        setUsingOllama(false);
        setReviewing(false);
      }
    }, 5000); // 5 second timeout

    streamCodeReview(
      codeToReview,
      primaryTopic,
      (token) => {
        ollamaFeedback += token;
        ollamaWorked = true;
        if (ollamaFeedback.length > 20) {
          setFeedback(ollamaFeedback); // Switch to Ollama result
        }
      },
      () => {
        clearTimeout(timeout);
        setUsingOllama(false);
        setReviewing(false);
        if (!ollamaWorked || ollamaFeedback.trim().length < 10) {
          // Ollama failed/empty — keep local result
          setFeedback(localResult);
        }
      }
    );
  }

  function manualReview() {
    if (code.trim().length > 3) startReview(code);
  }

  return (
    <div className="editor-layout">

      {/* Left Sidebar */}
      <div className="editor-sidebar">
        <h4>Project</h4>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6C63FF', lineHeight: 1.5 }}>
          {projectData?.title || `${primaryTopic} Practice`}
        </div>

        <h4>Focus Areas</h4>
        {weakTopics.length > 0
          ? weakTopics.map(t => <span key={t} className="topic-pill weak">⚠ {t}</span>)
          : <span style={{ fontSize: 12, color: '#22C55E' }}>All strong! 🎉</span>
        }

        <h4>Strengths</h4>
        {strongTopics.length > 0
          ? strongTopics.map(t => <span key={t} className="topic-pill strong">✓ {t}</span>)
          : <span style={{ fontSize: 12, color: '#9CA3AF' }}>Keep practicing!</span>
        }

        <h4>Tech Stack</h4>
        {(projectData?.tech_stack || [primaryTopic]).map(t => (
          <span key={t} className="topic-pill neutral">{t}</span>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* AI mode indicator */}
          <div style={{
            fontSize: 11, padding: '6px 10px',
            borderRadius: 6, textAlign: 'center',
            background: usingOllama ? '#DCFCE7' : '#EEF0FF',
            color: usingOllama ? '#166534' : '#4B44CC',
          }}>
            {usingOllama ? '🤖 Ollama AI' : '⚡ Smart Analysis'}
          </div>

          <button
            className="btn-outline"
            style={{ width: '100%', fontSize: 12 }}
            onClick={manualReview}
            disabled={reviewing}
          >
            {reviewing ? '⏳ Analyzing...' : '🔍 Review Code'}
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="editor-main">
        <div className="editor-topbar">
          <span className="editor-filename">{filename}</span>
          <div className="ai-watch">
            <div className={`ai-dot ${reviewing ? 'thinking' : ''}`} />
            {reviewing
              ? usingOllama ? 'Ollama reviewing...' : 'Analyzing...'
              : 'AI watching'}
          </div>
        </div>
        <div className="monaco-wrap">
          <MonacoEditor
            height="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={handleCodeChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'JetBrains Mono, Consolas, monospace',
              wordWrap: 'on',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              padding: { top: 14 },
            }}
          />
        </div>
      </div>

      {/* AI Feedback Panel */}
      <div className="ai-feedback-panel">
        <div className="ai-feedback-header">
          🤖 Code Analysis
          {reviewing && <div className="spinner" style={{ width: 14, height: 14, marginLeft: 'auto' }} />}
        </div>
        <div className="ai-feedback-body">
          {feedback
            ? feedback
            : (
              <div className="feedback-placeholder">
                <div style={{ fontSize: 28, marginBottom: 10 }}>✍️</div>
                <div style={{ fontFamily: 'var(--font)', fontSize: 13 }}>
                  Start typing code...<br /><br />
                  AI analyzes automatically after you stop typing.
                  <br /><br />
                  Click <strong>Review Code</strong> to analyze instantly.
                </div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}

// Starter code templates per topic
function getStarterCode(topic) {
  const templates = {
    Python: `# Python Practice
# Fix the bugs and improve this code!

def calculate_average(numbers):
    total = 0
    for num in numbers
        total = total + num
    average = total / len(numbers)
    return average

result = calculate_average([10, 20, 30, 40, 50])
print "Average:", result
`,
    JavaScript: `// JavaScript Practice
// Fix the bugs and improve this code!

var calculateAverage = function(numbers) {
    var total = 0;
    for (var i = 0; i < numbers.length; i++) {
        total = total + numbers[i];
    }
    var average = total / numbers.length;
    return average;
}

var result = calculateAverage([10, 20, 30, 40, 50]);
console.log("Average: " + result);
`,
    "HTML/CSS": `<!-- HTML/CSS Practice -->
<!-- Fix the issues in this code! -->

<!DOCTYPE html>
<html>
<head>
    <title>My Page</title>
    <style>
        .container {
            width: 100%;
            background-color: #f0f0f0 !important;
        }
        .title {
            font-size: 24px;
            color: #333333;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="title" style="color: red;">Hello World</h1>
        <img src="photo.jpg">
        <p>Welcome to my page</p>
    </div>
</body>
</html>
`,
    SQL: `-- SQL Practice
-- Find and fix the issues!

SELECT * FROM users
WHERE age > 18

SELECT name, email FROM orders
JOIN users ON orders.user_id = users.id

DELETE FROM temp_data

SELECT COUNT(*) FROM products
GROUP BY category
ORDER BY COUNT(*) DESC
`,
  };
  return templates[topic] || templates['Python'];
}
