from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import SOSSignal


@receiver(post_save, sender=SOSSignal)
def sos_post_save(sender, instance, **kwargs):
    if instance.zone_id:
        from .flow import recount
        recount(instance.zone_id)
