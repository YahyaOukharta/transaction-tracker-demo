import requests
from django.db import connection, transaction
from rest_framework.exceptions import ValidationError

from transactions.models import Transaction, User
from transactions.serializers import  TransactionLoadSerializer
from transactions.choices import TransactionTypeChoices


class TransactionsAPIService:

    def get_transactions(self):
        request = requests.get('https://685efce5c55df675589d49df.mockapi.io/api/v1/transactions')
        return request.json()
    
    def bulk_add_transactions(self, transactions):
        print(transactions)
        serializer = TransactionLoadSerializer(data=transactions, many=True)
        serializer.is_valid(raise_exception=True)

        new_ids = [tx['id'] for tx in serializer.validated_data if tx.get('id', None)]
        existing_ids = set(Transaction.objects.filter(id__in=new_ids).values_list('id', flat=True))
        
        # new transactions that are not in the database
        new_transactions_data = [tx for tx in serializer.validated_data if tx.get('id') not in existing_ids and tx.get('id', None)]
        
        if new_transactions_data:
            # Manual balance validation and update since bulk_create bypasses save()
            user = User.objects.first()
            
            total_income = sum(tx['amount'] for tx in new_transactions_data if tx['type'] == TransactionTypeChoices.DEPOSIT)
            total_expense = sum(tx['amount'] for tx in new_transactions_data if tx['type'] == TransactionTypeChoices.EXPENSE)
            net_change = total_income - total_expense
            
            # Validate sufficient balance for expenses
            if user.balance + net_change < 0:
                raise ValidationError("Insufficient balance for bulk transactions")
            
            # Use database transaction to ensure atomicity
            with transaction.atomic():
                # Update user balance
                user.balance += net_change
                user.save()
                
                # Create the transactions
                txs = [Transaction(**tx, editable=False) for tx in new_transactions_data]
                created_txs = Transaction.objects.bulk_create(txs)
                
                # Reset the PostgreSQL sequence to prevent ID conflicts
                self._reset_sequence()
                
                return created_txs
        else:
            return []
    
    def _reset_sequence(self):
        """Reset the PostgreSQL sequence for transactions table after bulk insert with explicit IDs"""
        with connection.cursor() as cursor:
            table_name = Transaction._meta.db_table
            cursor.execute(f"SELECT MAX(id) FROM {table_name}")
            max_id = cursor.fetchone()[0]
            
            if max_id is not None:
                next_id = max_id + 1
                sequence_name = f"{table_name}_id_seq"
                cursor.execute(f"SELECT setval('{sequence_name}', %s, false)", [next_id])
    
