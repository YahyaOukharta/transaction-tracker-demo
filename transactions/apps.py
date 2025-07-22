from django.apps import AppConfig


class TransactionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'transactions'

    def ready(self):
        from django.db.models.signals import post_migrate
        from django.dispatch import receiver
        
        @receiver(post_migrate, sender=self)
        def create_default_user(sender, **kwargs):
            from transactions.models import User
            
            # Check if any users exist, if not create a default one
            if not User.objects.exists():
                User.objects.create(balance=0)
                print("Created default user with balance 0")
