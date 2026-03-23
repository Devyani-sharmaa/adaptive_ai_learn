import './styles/global.css';
import { useStore } from './store/store';
import Topbar from './components/Topbar';
import TopicSelector from './components/TopicSelector';
import Quiz from './components/Quiz';
import KnowledgeGraph from './components/KnowledgeGraph';
import CodeEditor from './components/CodeEditor';

export default function App() {
  const { phase } = useStore();

  return (
    <>
      <Topbar />
      {phase === 'topic-select' && <TopicSelector />}
      {phase === 'quiz'         && <Quiz />}
      {phase === 'graph'        && <KnowledgeGraph />}
      {phase === 'editor'       && <CodeEditor />}
    </>
  );
}
