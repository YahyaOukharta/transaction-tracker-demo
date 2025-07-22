from django.db import models

class TransactionTypeChoices(models.TextChoices):
    DEPOSIT = 'deposit'
    EXPENSE = 'expense'