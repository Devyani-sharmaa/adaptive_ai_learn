from django.db import models


class AssessmentSession(models.Model):
    session_key = models.CharField(max_length=40, unique=True)
    selected_topics = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Session {self.session_key}"


class TopicScore(models.Model):
    session = models.ForeignKey(
        AssessmentSession,
        on_delete=models.CASCADE,
        related_name='scores'
    )
    topic = models.CharField(max_length=50)
    correct = models.IntegerField(default=0)
    total = models.IntegerField(default=0)

    @property
    def percentage(self):
        if self.total == 0:
            return 0
        return round((self.correct / self.total) * 100)

    class Meta:
        unique_together = ('session', 'topic')

    def __str__(self):
        return f"{self.topic}: {self.correct}/{self.total}"


class ProjectRecommendation(models.Model):
    session = models.ForeignKey(
        AssessmentSession,
        on_delete=models.CASCADE,
        related_name='recommendations'
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    weak_topics_addressed = models.JSONField(default=list)
    tech_stack = models.JSONField(default=list)
    starter_code = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
