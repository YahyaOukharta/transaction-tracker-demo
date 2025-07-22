from django.shortcuts import render
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from transactions.models import Transaction, User
from transactions.serializers import TransactionSerializer, TransactionCreateSerializer
from transactions.services.transactions_api import TransactionsAPIService
from rest_framework import status
from rest_framework.pagination import LimitOffsetPagination
from django.utils.dateparse import parse_datetime
import logging

logger = logging.getLogger(__name__)

class TransactionsListCreateView(ListCreateAPIView):
    serializer_class = TransactionCreateSerializer
    pagination_class = LimitOffsetPagination

    def get_serializer_class(self):
        if self.request.method == 'GET': # load
            return TransactionSerializer
        return TransactionCreateSerializer

    def get_queryset(self):
        queryset = Transaction.objects.all()
        
        # Filter by type
        transaction_type = self.request.query_params.get('type')
        if transaction_type:
            queryset = queryset.filter(type=transaction_type)
        
        # Filter by from_date
        from_date = self.request.query_params.get('from_date')
        if from_date:
            parsed_from_date = parse_datetime(from_date)
            if parsed_from_date:
                queryset = queryset.filter(createdAt__gte=parsed_from_date)
        
        # Filter by to_date
        to_date = self.request.query_params.get('to_date')
        if to_date:
            parsed_to_date = parse_datetime(to_date)
            if parsed_to_date:
                queryset = queryset.filter(createdAt__lte=parsed_to_date)
        
        return queryset
    

class TransactionRetrieveUpdateDestroyView(RetrieveUpdateDestroyAPIView):
    
    serializer_class = TransactionSerializer
    queryset = Transaction.objects.all()


class TransactionLoadFromAPIView(APIView):
    transactions_service = TransactionsAPIService()

    def get(self, request):
        try:
            txs = self.transactions_service.get_transactions()
            created_txs = self.transactions_service.bulk_add_transactions(txs)
            return Response(TransactionSerializer(created_txs, many=True).data)
        except Exception as e:
            logger.error(f"Error loading transactions from API: {e}")
            return Response({'error': "Error loading transactions from API"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
class UserBalanceView(APIView):
    def get(self, request):
        user = User.objects.first()
        return Response({'balance': user.balance})
    
