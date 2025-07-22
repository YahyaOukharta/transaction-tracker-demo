from django.urls import path

from transactions.views import TransactionLoadFromAPIView, TransactionRetrieveUpdateDestroyView, TransactionsListCreateView, UserBalanceView

urlpatterns = [
    path('', TransactionsListCreateView.as_view(), name='transactions'),
    path('<int:pk>/', TransactionRetrieveUpdateDestroyView.as_view(), name='transaction'),
    path('load-from-api/', TransactionLoadFromAPIView.as_view(), name='load-from-api'),
    path('balance/', UserBalanceView.as_view(), name='balance'),
]