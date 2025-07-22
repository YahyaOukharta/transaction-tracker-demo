"""
URL configuration for transaction_tracker project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import FileResponse, HttpResponse
from django.shortcuts import render
import os
import mimetypes


def serve_static_file(request, file_path):
    """Serve static files from web directory with correct MIME types"""
    full_path = os.path.join(settings.BASE_DIR, 'web', file_path)
    
    if not os.path.exists(full_path):
        from django.http import Http404
        raise Http404("File not found")
    
    # Get the correct MIME type
    content_type, _ = mimetypes.guess_type(full_path)
    if content_type is None:
        content_type = 'application/octet-stream'
    
    # Special handling for JavaScript files
    if file_path.endswith('.js'):
        content_type = 'application/javascript'
    elif file_path.endswith('.css'):
        content_type = 'text/css'
    elif file_path.endswith('.html'):
        content_type = 'text/html'
    
    return FileResponse(open(full_path, 'rb'), content_type=content_type)


def index_view(request):
    """Serve the frontend index.html"""
    index_path = os.path.join(settings.BASE_DIR, 'web', 'index.html')
    return FileResponse(open(index_path, 'rb'), content_type='text/html')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('transactions/', include('transactions.urls')),
    # Serve specific static files with correct MIME types
    path('main.js', serve_static_file, {'file_path': 'main.js'}, name='main_js'),
    path('style.css', serve_static_file, {'file_path': 'style.css'}, name='style_css'),
    path('', index_view, name='index'),  # Serve frontend at root
]

# Serve other static files during development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
