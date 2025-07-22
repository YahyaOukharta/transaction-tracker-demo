from rest_framework import serializers

from transactions.models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'amount', 'type', 'editable', 'createdAt', 'updated_at']


class TransactionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['amount', 'type',]


class TransactionLoadSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    amount = serializers.FloatField(required=True)
    type = serializers.CharField(required=True)
    createdAt = serializers.DateTimeField(required=False)


