import torch
import torch.nn as nn

class TemporalAttention(nn.Module):
    def __init__(self, hidden_size):
        super().__init__()
        self.attention = nn.Linear(hidden_size, 1)

    def forward(self, lstm_out):
        # lstm_out shape: [batch_size, seq_len, hidden_size]
        attn_weights = self.attention(lstm_out) # [batch_size, seq_len, 1]
        attn_weights = torch.softmax(attn_weights, dim=1) # normalize over seq_len
        # Context vector
        context = torch.sum(attn_weights * lstm_out, dim=1) # [batch_size, hidden_size]
        return context, attn_weights.squeeze(-1)

class LSTMAttentionWorldModel(nn.Module):
    def __init__(self, input_size=53, hidden_size=128, num_layers=2, dropout=0.2, num_multiclass=10):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size, 
            hidden_size=hidden_size, 
            num_layers=num_layers, 
            batch_first=True, 
            dropout=dropout if num_layers > 1 else 0
        )
        self.attention = TemporalAttention(hidden_size)
        
        self.binary_head = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, 1)
        )
        
        self.multiclass_head = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, num_multiclass)
        )

    def forward(self, x):
        # x shape: [batch_size, seq_len, features]
        lstm_out, _ = self.lstm(x)
        context, attn_weights = self.attention(lstm_out)
        
        bin_logits = self.binary_head(context).squeeze(-1)
        multi_logits = self.multiclass_head(context)
        
        return bin_logits, multi_logits, attn_weights
