import pytest
import torch
import numpy as np
import tempfile
import os
import json
from backend.ml.models.lstm_attention.model import LSTMAttentionWorldModel
from backend.ml.models.lstm_attention.dataset import MemmapTemporalDataset

def test_model_forward_pass():
    batch_size = 32
    seq_len = 10
    features = 53
    hidden = 64
    
    model = LSTMAttentionWorldModel(input_size=features, hidden_size=hidden, num_layers=2, num_multiclass=10)
    
    # Create dummy input
    x = torch.randn(batch_size, seq_len, features)
    
    bin_logits, multi_logits, attn_weights = model(x)
    
    assert bin_logits.shape == (batch_size,)
    assert multi_logits.shape == (batch_size, 10)
    assert attn_weights.shape == (batch_size, seq_len)
    
    # Check if attention weights sum to ~1
    attn_sums = torch.sum(attn_weights, dim=1)
    assert torch.allclose(attn_sums, torch.ones(batch_size), atol=1e-5)

def test_dataset_loading():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create dummy memmaps
        N, seq_len, F = 100, 10, 53
        x_path = os.path.join(tmpdir, "X.npy")
        y_bin_path = os.path.join(tmpdir, "y_bin.npy")
        y_enc_path = os.path.join(tmpdir, "y_enc.npy")
        
        np.save(x_path, np.random.rand(N, seq_len, F).astype(np.float32))
        np.save(y_bin_path, np.random.randint(0, 2, N).astype(np.int8))
        np.save(y_enc_path, np.random.randint(0, 10, N).astype(np.int32))
        
        dataset = MemmapTemporalDataset(x_path, y_bin_path, y_enc_path)
        assert len(dataset) == 100
        
        x, y_bin, y_enc = dataset[0]
        assert x.shape == (10, 53)
        assert x.dtype == torch.float32
        assert y_bin.dtype == torch.float32
        assert y_enc.dtype == torch.int64
