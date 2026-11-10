from django.apps import AppConfig


class RescueOperationsConfig(AppConfig):
    name = "rescue_operations"

    def ready(self):
        import rescue_operations.signals  # noqa
