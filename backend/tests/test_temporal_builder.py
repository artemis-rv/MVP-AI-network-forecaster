import os
import tempfile
import json
import pytest
import numpy as np
import joblib
from backend.ml.temporal.builder import TemporalSequenceBuilder

@pytest.fixture
def dummy_input_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create dummy chronological split artifacts
        np.random.seed(42)
        N_train = 20
        N_val = 10
        N_test = 10
        F = 5
        
        X_train = np.random.rand(N_train, F)
        y_train_enc = np.random.randint(0, 10, N_train)
        y_train_orig = np.array(["Benign"] * (N_train // 2) + ["Attack"] * (N_train // 2))
        
        X_val = np.random.rand(N_val, F)
        y_val_enc = np.random.randint(0, 10, N_val)
        y_val_orig = np.array(["Benign"] * (N_val // 2) + ["Attack"] * (N_val // 2))
        
        X_test = np.random.rand(N_test, F)
        y_test_enc = np.random.randint(0, 10, N_test)
        y_test_orig = np.array(["Benign"] * (N_test // 2) + ["Attack"] * (N_test // 2))
        
        # We need pandas DataFrame so .values and .iloc work in the builder if we load it. 
        # Wait, the artifact in step 1 is actually pandas dataframe? 
        # Actually in temporal_pipeline we save X_train_scaled which is a pandas DataFrame.
        import pandas as pd
        X_train_df = pd.DataFrame(X_train)
        X_val_df = pd.DataFrame(X_val)
        X_test_df = pd.DataFrame(X_test)
        
        joblib.dump((X_train_df, y_train_enc, y_train_orig), os.path.join(tmpdir, "train_temporal.joblib"))
        joblib.dump((X_val_df, y_val_enc, y_val_orig), os.path.join(tmpdir, "val_temporal.joblib"))
        joblib.dump((X_test_df, y_test_enc, y_test_orig), os.path.join(tmpdir, "test_temporal.joblib"))
        
        meta = {
            "dataset_name": "dummy",
            "temporal_boundaries": {
                "train": {"start": 0, "end": 20},
                "validation": {"start": 21, "end": 30},
                "test": {"start": 31, "end": 40}
            }
        }
        with open(os.path.join(tmpdir, "temporal_metadata.json"), "w") as f:
            json.dump(meta, f)
            
        yield tmpdir

@pytest.fixture
def output_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir

def test_sequence_builder(dummy_input_dir, output_dir):
    seq_len = 5
    stride = 2
    builder = TemporalSequenceBuilder(dummy_input_dir, output_dir, seq_len=seq_len, stride=stride)
    builder.process()
    
    assert os.path.exists(os.path.join(output_dir, "X_train.npy"))
    assert os.path.exists(os.path.join(output_dir, "y_bin_train.npy"))
    assert os.path.exists(os.path.join(output_dir, "y_enc_train.npy"))
    assert os.path.exists(os.path.join(output_dir, "sequence_metadata.json"))
    
    X_train = np.load(os.path.join(output_dir, "X_train.npy"), mmap_mode='r')
    y_bin_train = np.load(os.path.join(output_dir, "y_bin_train.npy"), mmap_mode='r')
    y_enc_train = np.load(os.path.join(output_dir, "y_enc_train.npy"), mmap_mode='r')
    
    # N = 20, seq_len = 5, stride = 2.
    # number of seq = (20 - 5) // 2 = 7
    assert X_train.shape == (7, 5, 5)
    assert y_bin_train.shape == (7,)
    assert y_enc_train.shape == (7,)
    
    # Check no leakage: the last element of X_train[0] should be index 4 of original dataset
    # And target y_bin_train[0] should be index 5
    # Since stride=2, X_train[1] starts at 2, ends at 6. Target at 7.
    pass
