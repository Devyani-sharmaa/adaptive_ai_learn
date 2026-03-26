import json
import uuid
import requests
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import AssessmentSession, TopicScore, ProjectRecommendation

# ── LLM caller — auto-switches Groq (cloud) vs Ollama (local) ───────────────

def call_llm(prompt, system="", stream=False):
    """
    Uses Groq if GROQ_API_KEY is set (production),
    falls back to Ollama (local dev).
    """
    groq_key = getattr(settings, 'GROQ_API_KEY', '')

    if groq_key:
        return _call_groq(prompt, system, groq_key, stream)
    else:
        return _call_ollama(prompt, system, stream)


def _call_groq(prompt, system, api_key, stream=False):
    """Groq cloud API — free, fast, no download needed."""
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    messages = []
    if system:
        messages.append({'role': 'system', 'content': system})
    messages.append({'role': 'user', 'content': prompt})

    payload = {
        'model': 'llama3-8b-8192',
        'messages': messages,
        'temperature': 0.7,
        'max_tokens': 600,
        'stream': stream,
    }
    try:
        if stream:
            return requests.post(
                'https://api.groq.com/openai/v1/chat/completions',
                headers=headers, json=payload, stream=True, timeout=60
            )
        resp = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers=headers, json=payload, timeout=30
        )
        resp.raise_for_status()
        return resp.json()['choices'][0]['message']['content']
    except Exception as e:
        print(f"Groq error: {e}")
        return None


def _call_ollama(prompt, system, stream=False):
    """Local Ollama — for development."""
    ollama_url   = getattr(settings, 'OLLAMA_URL', 'http://localhost:11434')
    ollama_model = getattr(settings, 'OLLAMA_MODEL', 'llama3.2:1b')
    payload = {
        'model': ollama_model,
        'prompt': prompt,
        'system': system,
        'stream': stream,
        'options': {'temperature': 0.7, 'num_predict': 600},
    }
    try:
        if stream:
            return requests.post(f'{ollama_url}/api/generate', json=payload, stream=True, timeout=60)
        resp = requests.post(f'{ollama_url}/api/generate', json=payload, timeout=60)
        resp.raise_for_status()
        return resp.json().get('response', '')
    except requests.exceptions.ConnectionError:
        return None


def parse_json_response(raw):
    """Safely extract JSON from LLM response."""
    if not raw:
        return None
    try:
        cleaned = raw.strip()
        if '```' in cleaned:
            parts   = cleaned.split('```')
            cleaned = parts[1] if len(parts) > 1 else cleaned
            if cleaned.startswith('json'):
                cleaned = cleaned[4:]
        start = cleaned.find('{')
        end   = cleaned.rfind('}') + 1
        if start != -1 and end > start:
            cleaned = cleaned[start:end]
        return json.loads(cleaned)
    except Exception:
        return None


# ── Views ────────────────────────────────────────────────────────────────────

class OllamaStatusView(APIView):
    def get(self, request):
        groq_key = getattr(settings, 'GROQ_API_KEY', '')
        if groq_key:
            return Response({'running': True, 'models': ['groq/llama3-8b-8192'], 'ready': True, 'mode': 'groq'})
        try:
            ollama_url = getattr(settings, 'OLLAMA_URL', 'http://localhost:11434')
            resp   = requests.get(f'{ollama_url}/api/tags', timeout=3)
            models = [m['name'] for m in resp.json().get('models', [])]
            model  = getattr(settings, 'OLLAMA_MODEL', 'llama3.2:1b')
            return Response({
                'running': True,
                'models':  models,
                'ready':   any(model in m for m in models),
                'mode':    'ollama',
            })
        except Exception:
            return Response({'running': False, 'models': [], 'ready': False, 'mode': 'none'})


class CreateSessionView(APIView):
    def post(self, request):
        session_key = str(uuid.uuid4())[:8]
        topics      = request.data.get('topics', [])
        session     = AssessmentSession.objects.create(
            session_key=session_key, selected_topics=topics
        )
        return Response({'session_key': session.session_key}, status=status.HTTP_201_CREATED)


class GenerateQuestionView(APIView):
    def post(self, request):
        topic      = request.data.get('topic', 'Python')
        difficulty = request.data.get('difficulty', 'beginner')
        previous   = request.data.get('previous_questions', [])

        prev_text = '\n'.join(f'- {q}' for q in previous) if previous else 'None'
        prompt = f"""Generate a multiple choice question about {topic} for a {difficulty} level developer.

Do NOT repeat these questions:
{prev_text}

Return ONLY valid JSON with no extra text:
{{
  "question": "Your question here?",
  "subtopic": "specific subtopic name (e.g. Functions, Loops, Arrays, SELECT, Joins)",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0,
  "explanation": "Brief explanation"
}}"""

        system = "You are a coding quiz generator. Return ONLY valid JSON. No markdown. No extra text."
        raw    = call_llm(prompt, system)

        if raw is None:
            return self._fallback(topic)

        data = parse_json_response(raw)
        if data and 'question' in data:
            return Response(data)
        return self._fallback(topic)

    def _fallback(self, topic):
        fallbacks = {
            'Python':     {'subtopic': 'Functions', 'question': 'Which keyword defines a function in Python?', 'options': ['function', 'func', 'def', 'define'], 'correct': 2, 'explanation': "'def' defines functions in Python."},
            'HTML/CSS':   {'subtopic': 'CSS Basics', 'question': 'Which CSS property changes text color?', 'options': ['text-color', 'font-color', 'color', 'foreground'], 'correct': 2, 'explanation': "'color' sets text color."},
            'SQL':        {'subtopic': 'SELECT', 'question': 'Which clause filters SQL rows?', 'options': ['ORDER BY', 'GROUP BY', 'WHERE', 'HAVING'], 'correct': 2, 'explanation': 'WHERE filters records.'},
            'JavaScript': {'subtopic': 'Variables', 'question': 'Which declares a block-scoped variable?', 'options': ['var', 'let', 'def', 'dim'], 'correct': 1, 'explanation': "'let' is block-scoped."},
        }
        return Response(fallbacks.get(topic, fallbacks['Python']))


class SaveResultsView(APIView):
    def post(self, request):
        session_key = request.data.get('session_key')
        scores      = request.data.get('scores', {})
        try:
            session = AssessmentSession.objects.get(session_key=session_key)
        except AssessmentSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)
        for topic, data in scores.items():
            TopicScore.objects.update_or_create(
                session=session, topic=topic,
                defaults={'correct': data.get('correct', 0), 'total': data.get('total', 0)}
            )
        return Response({'message': 'Saved'})


class GenerateProjectView(APIView):
    def post(self, request):
        weak_topics   = request.data.get('weak_topics', [])
        strong_topics = request.data.get('strong_topics', [])
        session_key   = request.data.get('session_key')

        prompt = f"""A developer finished a quiz.
Weak areas: {', '.join(weak_topics)}
Strong areas: {', '.join(strong_topics)}

Suggest ONE mini project to improve weak areas.
Return ONLY valid JSON:
{{
  "title": "Project title",
  "description": "2-3 sentence description",
  "weak_topics_addressed": {json.dumps(weak_topics)},
  "tech_stack": ["tech1", "tech2"],
  "starter_code": "# starter code here\\nprint('hello')"
}}"""

        system = "You are a coding mentor. Return valid JSON only. No markdown."
        raw    = call_llm(prompt, system)
        data   = parse_json_response(raw) if raw else None

        if not data:
            data = {
                'title': f'Practice: {", ".join(weak_topics) or "General"}',
                'description': f'Build a project focusing on: {", ".join(weak_topics)}.',
                'weak_topics_addressed': weak_topics,
                'tech_stack': weak_topics or ['Python'],
                'starter_code': f'# Practice Project\n# Focus: {", ".join(weak_topics)}\n\nprint("Start here!")\n',
            }

        try:
            session = AssessmentSession.objects.get(session_key=session_key)
            ProjectRecommendation.objects.create(
                session=session,
                title=data.get('title', ''),
                description=data.get('description', ''),
                weak_topics_addressed=data.get('weak_topics_addressed', []),
                tech_stack=data.get('tech_stack', []),
                starter_code=data.get('starter_code', ''),
            )
        except Exception:
            pass

        return Response(data)


class ReviewCodeView(APIView):
    def post(self, request):
        code  = request.data.get('code', '')
        topic = request.data.get('topic', 'Python')

        if not code.strip():
            return Response({'feedback': 'No code provided.'})

        prompt = f"""Review this {topic} code. Find bugs or issues.

```
{code}
```

List max 3 issues as:
LINE X: issue → fix

If no issues: "✓ Code looks good! [one tip]"
Be short and helpful."""

        system = "You are a senior code reviewer. Give short, precise feedback."

        groq_key = getattr(settings, 'GROQ_API_KEY', '')

        def generate_groq():
            headers = {
                'Authorization': f'Bearer {groq_key}',
                'Content-Type': 'application/json',
            }
            payload = {
                'model': 'llama3-8b-8192',
                'messages': [
                    {'role': 'system', 'content': system},
                    {'role': 'user',   'content': prompt},
                ],
                'stream': True,
                'max_tokens': 300,
            }
            try:
                resp = requests.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    headers=headers, json=payload, stream=True, timeout=30
                )
                for line in resp.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            data_str = line[6:]
                            if data_str.strip() == '[DONE]':
                                yield 'data: [DONE]\n\n'
                                break
                            try:
                                chunk  = json.loads(data_str)
                                token  = chunk['choices'][0]['delta'].get('content', '')
                                if token:
                                    yield f'data: {json.dumps({"token": token})}\n\n'
                            except Exception:
                                continue
            except Exception as e:
                yield f'data: {json.dumps({"token": f"Error: {str(e)}"})}\n\n'
                yield 'data: [DONE]\n\n'

        def generate_ollama():
            resp = call_llm(prompt, system, stream=True)
            if resp is None:
                yield f'data: {json.dumps({"token": "Ollama not running. Install from ollama.com"})}\n\n'
                yield 'data: [DONE]\n\n'
                return
            for line in resp.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line)
                        token = chunk.get('response', '')
                        if token:
                            yield f'data: {json.dumps({"token": token})}\n\n'
                        if chunk.get('done'):
                            yield 'data: [DONE]\n\n'
                            break
                    except Exception:
                        continue

        generator = generate_groq() if groq_key else generate_ollama()

        return StreamingHttpResponse(
            generator,
            content_type='text/event-stream',
            headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
        )
