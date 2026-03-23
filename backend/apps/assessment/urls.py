from django.urls import path
from . import views

urlpatterns = [
    path('ollama-status/', views.OllamaStatusView.as_view()),
    path('session/create/', views.CreateSessionView.as_view()),
    path('question/generate/', views.GenerateQuestionView.as_view()),
    path('results/save/', views.SaveResultsView.as_view()),
    path('project/generate/', views.GenerateProjectView.as_view()),
    path('code/review/', views.ReviewCodeView.as_view()),
]
