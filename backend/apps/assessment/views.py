import json
import uuid
import requests
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import AssessmentSession, TopicScore, ProjectRecommendation

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:1b"   # lightweight, good quality


def call_ollama(prompt, system="", stream=False):
    """Call local Ollama LLM"""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "system": system,
        "stream": stream,
        "options": {
            "temperature": 0.7,
            "num_predict": 600,
        }
    }
    try:
        if stream:
            return requests.post(OLLAMA_URL, json=payload, stream=True, timeout=60)
        else:
            resp = requests.post(OLLAMA_URL, json=payload, timeout=60)
            resp.raise_for_status()
            return resp.json().get("response", "")
    except requests.exceptions.ConnectionError:
        return None


class OllamaStatusView(APIView):
    """Check if Ollama is running"""
    def get(self, request):
        try:
            resp = requests.get("http://localhost:11434/api/tags", timeout=3)
            models = [m['name'] for m in resp.json().get('models', [])]
            return Response({
                "running": True,
                "models": models,
                "ready": any(OLLAMA_MODEL in m for m in models)
            })
        except Exception:
            return Response({"running": False, "models": [], "ready": False})


class CreateSessionView(APIView):
    """Create a new assessment session"""
    def post(self, request):
        session_key = str(uuid.uuid4())[:8]
        topics = request.data.get('topics', [])
        session = AssessmentSession.objects.create(
            session_key=session_key,
            selected_topics=topics
        )
        return Response({
            'session_key': session.session_key,
        }, status=status.HTTP_201_CREATED)


class GenerateQuestionView(APIView):
    """Generate a quiz question using Ollama"""
    def post(self, request):
        topic = request.data.get('topic', 'Python')
        difficulty = request.data.get('difficulty', 'beginner')
        previous = request.data.get('previous_questions', [])

        prev_text = "\n".join(f"- {q}" for q in previous) if previous else "None"

        prompt = f"""Generate a multiple choice quiz question about {topic} for a {difficulty} level developer.

Do NOT repeat these questions:
{prev_text}

Return ONLY valid JSON with no extra text, no markdown, no explanation:
{{
  "question": "Your question here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0,
  "explanation": "Brief explanation of the correct answer"
}}

The "correct" field is the index (0-3) of the correct option."""

        system = "You are a coding quiz generator. Always return ONLY valid JSON. No markdown. No extra text. No explanation outside JSON."

        raw = call_ollama(prompt, system)

        if raw is None:
            # Fallback static questions if Ollama is not running
            return self._fallback_question(topic)

        try:
            # Clean and parse JSON
            cleaned = raw.strip()
            if "```" in cleaned:
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            start = cleaned.find("{")
            end = cleaned.rfind("}") + 1
            if start != -1 and end > start:
                cleaned = cleaned[start:end]
            data = json.loads(cleaned)
            return Response(data)
        except (json.JSONDecodeError, ValueError):
            return self._fallback_question(topic)

    def _fallback_question(self, topic):
        """Static fallback questions when Ollama is unavailable"""
        fallbacks = {
            "Python": {
                "question": "What does len() function return in Python?",
                "options": ["The last element", "Number of items in object", "Memory size", "Data type"],
                "correct": 1,
                "explanation": "len() returns the number of items in an object like list, string, dict etc."
            },
            "HTML/CSS": {
                "question": "Which CSS property is used to change text color?",
                "options": ["text-color", "font-color", "color", "foreground"],
                "correct": 2,
                "explanation": "The 'color' property sets the color of the text content."
            },
            "SQL": {
                "question": "Which SQL clause is used to filter records?",
                "options": ["ORDER BY", "GROUP BY", "WHERE", "HAVING"],
                "correct": 2,
                "explanation": "WHERE clause filters records based on a condition."
            },
            "JavaScript": {
                "question": "Which keyword declares a block-scoped variable in JS?",
                "options": ["var", "let", "def", "dim"],
                "correct": 1,
                "explanation": "let declares block-scoped variables, unlike var which is function-scoped."
            }
        }
        return Response(fallbacks.get(topic, fallbacks["Python"]))


class SaveResultsView(APIView):
    """Save quiz results"""
    def post(self, request):
        session_key = request.data.get('session_key')
        scores = request.data.get('scores', {})

        try:
            session = AssessmentSession.objects.get(session_key=session_key)
        except AssessmentSession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)

        for topic, data in scores.items():
            TopicScore.objects.update_or_create(
                session=session,
                topic=topic,
                defaults={
                    'correct': data.get('correct', 0),
                    'total': data.get('total', 0)
                }
            )
        return Response({'message': 'Results saved successfully'})


class GenerateProjectView(APIView):
    """Generate project recommendation using Ollama"""
    def post(self, request):
        weak_topics = request.data.get('weak_topics', [])
        strong_topics = request.data.get('strong_topics', [])
        session_key = request.data.get('session_key')

        prompt = f"""A developer completed a quiz assessment.
Weak topics (needs improvement): {', '.join(weak_topics)}
Strong topics: {', '.join(strong_topics)}

Suggest ONE mini project that focuses on their weak areas to help them improve.

Return ONLY valid JSON with no extra text:
{{
  "title": "Project title",
  "description": "2-3 sentence description of the project",
  "weak_topics_addressed": {json.dumps(weak_topics)},
  "tech_stack": ["tech1", "tech2"],
  "starter_code": "# Starter code here\\n# Use the weak topics in this code\\nprint('Hello World')"
}}"""

        system = "You are a coding mentor. Return valid JSON only. No markdown. No extra text."
        raw = call_ollama(prompt, system)

        if raw is None:
            project = self._fallback_project(weak_topics)
        else:
            try:
                cleaned = raw.strip()
                if "```" in cleaned:
                    parts = cleaned.split("```")
                    cleaned = parts[1] if len(parts) > 1 else cleaned
                    if cleaned.startswith("json"):
                        cleaned = cleaned[4:]
                start = cleaned.find("{")
                end = cleaned.rfind("}") + 1
                if start != -1 and end > start:
                    cleaned = cleaned[start:end]
                project = json.loads(cleaned)
            except Exception:
                project = self._fallback_project(weak_topics)

        # Save to DB
        try:
            session = AssessmentSession.objects.get(session_key=session_key)
            ProjectRecommendation.objects.create(
                session=session,
                title=project.get('title', ''),
                description=project.get('description', ''),
                weak_topics_addressed=project.get('weak_topics_addressed', []),
                tech_stack=project.get('tech_stack', []),
                starter_code=project.get('starter_code', '')
            )
        except Exception:
            pass

        return Response(project)

    def _fallback_project(self, weak_topics):
        topics_str = ", ".join(weak_topics) if weak_topics else "Python"
        return {
            "title": f"Practice Project: {topics_str}",
            "description": f"Build a simple web app that uses {topics_str}. This will help reinforce your weak areas through practical application.",
            "weak_topics_addressed": weak_topics,
            "tech_stack": weak_topics + ["Django", "SQLite"],
            "starter_code": f"# Practice Project - {topics_str}\n# TODO: Build your project here\n\ndef main():\n    print('Starting project...')\n\nif __name__ == '__main__':\n    main()\n"
        }


class ReviewCodeView(APIView):
    """Review code using Ollama — returns streaming response"""
    def post(self, request):
        code = request.data.get('code', '')
        topic = request.data.get('topic', 'Python')

        if not code.strip():
            return Response({"feedback": "No code provided."})

        prompt = f"""Review this {topic} code. Find bugs, errors, or improvements.

Code:
```
{code}
```

List at most 3 issues in this format:
LINE X: [issue description] → [suggested fix]

If no issues found, say: "✓ Code looks good! [one tip]"
Be concise and helpful."""

        system = "You are a senior code reviewer. Give short, precise feedback. Maximum 3 issues."

        def generate():
            resp = call_ollama(prompt, system, stream=True)
            if resp is None:
                yield "data: Ollama not running. Start Ollama and try again.\n\n"
                return
            for line in resp.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("response", "")
                        if token:
                            yield f"data: {json.dumps({'token': token})}\n\n"
                        if chunk.get("done"):
                            yield "data: [DONE]\n\n"
                            break
                    except Exception:
                        continue

        return StreamingHttpResponse(
            generate(),
            content_type='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
            }
        )
