from __future__ import annotations

from django.urls import path, re_path

from apps.rhinopeak.controllers.api import api_entry

urlpatterns = [
    path("api", api_entry),
    path("api/", api_entry),
    re_path(r"^api/(?P<route>.*)$", api_entry),
]

