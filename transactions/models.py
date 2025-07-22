from django.db import models
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from django.db import transaction

from transactions.choices import TransactionTypeChoices

class Transaction(models.Model):
    id = models.AutoField(primary_key=True)
    amount = models.FloatField()
    type = models.CharField(max_length=10, choices=TransactionTypeChoices.choices)
    editable = models.BooleanField(default=True) # False for transactions that will be loaded from API
    createdAt = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        with transaction.atomic():
            user = User.objects.first()
            
            is_new = self.pk is None
            if is_new:
                if self.type == TransactionTypeChoices.EXPENSE and user.balance - self.amount < 0:
                    raise ValidationError("Insufficient balance")
                
                self._apply_transaction_to_balance(user, self.type, self.amount)
                user.save()
            else:
                original = Transaction.objects.get(pk=self.pk)
                
                self._reverse_transaction_from_balance(user, original.type, original.amount)
                

                if self.type == TransactionTypeChoices.EXPENSE and user.balance - self.amount < 0:
                    self._apply_transaction_to_balance(user, original.type, original.amount)
                    user.save()
                    raise ValidationError("Insufficient balance")
                
                # Apply the new transaction values
                self._apply_transaction_to_balance(user, self.type, self.amount)
                user.save()
            
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            user = User.objects.select_for_update().first()
            
            self._reverse_transaction_from_balance(user, self.type, self.amount)
            user.save()
            
            super().delete(*args, **kwargs)

    def _apply_transaction_to_balance(self, user, transaction_type, amount):
        if transaction_type == TransactionTypeChoices.DEPOSIT:
            user.balance += amount
        elif transaction_type == TransactionTypeChoices.EXPENSE:
            user.balance -= amount

    def _reverse_transaction_from_balance(self, user, transaction_type, amount):
        if transaction_type == TransactionTypeChoices.DEPOSIT:
            user.balance -= amount
        elif transaction_type == TransactionTypeChoices.EXPENSE:
            user.balance += amount

    def __str__(self):
        return f"TXN-{self.id}"

    class Meta:
        ordering = ['-createdAt']

class User(models.Model):
    id = models.AutoField(primary_key=True)
    balance = models.FloatField(default=0)

    def __str__(self):
        return f"TXN-{self.id}"