import { useStore } from '../store/store';

const PHASES = [
  { id: 'topic-select', label: '1. Topics' },
  { id: 'quiz',         label: '2. Quiz' },
  { id: 'graph',        label: '3. Graph' },
  { id: 'editor',       label: '4. Build' },
];

const ORDER = ['topic-select', 'quiz', 'graph', 'editor'];

export default function Topbar() {
  const { phase } = useStore();
  const currentIdx = ORDER.indexOf(phase);

  return (
    <div className="topbar">
      <div className="logo">
        <div className="logo-icon">⚡</div>
        SkillForge AI
      </div>
      <div className="phase-tabs">
        {PHASES.map((p, i) => {
          let cls = 'phase-tab';
          if (i === currentIdx) cls += ' active';
          else if (i < currentIdx) cls += ' done';
          return (
            <div key={p.id} className={cls}>
              {i < currentIdx ? '✓ ' : ''}{p.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
