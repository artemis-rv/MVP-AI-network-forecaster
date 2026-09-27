import os
import tempfile
import json
import pytest
import pandas as pd
import numpy as np
import joblib
from backend.ml.data_pipeline.temporal_pipeline import TemporalDataPipeline

@pytest.fixture
def dummy_dataset_path():
    data = {
        "FLOW_START_MILLISECONDS": [5000, 1000, 4000, 2000, 3000, 7000, 6000, 8000, 10000, 9000],
        "IPV4_SRC_ADDR": ["10.0.0.1"] * 10,
        "L4_SRC_PORT": [1024, 2048, 80, 443, 53, 22, 21, 23, 110, 8080],
        "IN_BYTES": [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
        "OUT_BYTES": [50, 150, 250, 350, 450, 550, 650, 750, 850, 950],
        "Label": [0, 1, 0, 1, 1, 0, 0, 1, 1, 0],
        "Attack": ["Benign", "DoS", "Benign", "Exploits", "Backdoors", "Benign", "Benign", "DoS", "Fuzzers", "Benign"]
    }
    df = pd.DataFrame(data)
    fd, path = tempfile.mkstemp(suffix=".csv")
    with os.fdopen(fd, 'w') as f:
        df.to_csv(f, index=False)
    yield path
    os.remove(path)

@pytest.fixture
def output_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir

def test_chronological_ordering(dummy_dataset_path, output_dir):
    pipeline = TemporalDataPipeline(dummy_dataset_path, output_dir)
    df = pipeline.load_data()
    df_clean = pipeline.clean_data(df)
    
    timestamps = df_clean["FLOW_START_MILLISECONDS"].tolist()
    assert timestamps == sorted(timestamps)

def test_split_boundaries(dummy_dataset_path, output_dir):
    pipeline = TemporalDataPipeline(dummy_dataset_path, output_dir)
    pipeline.process()
    
    meta = pipeline.metadata
    bounds = meta["temporal_boundaries"]
    
    # Check bounds overlap logic (train end <= val start, val end <= test start)
    assert bounds["train"]["end"] <= bounds["validation"]["start"]
    assert bounds["validation"]["end"] <= bounds["test"]["start"]
    
    assert meta["split_sizes"]["train_count"] == 7
    assert meta["split_sizes"]["validation_count"] == 1
    assert meta["split_sizes"]["test_count"] == 2
    
def test_no_leakage_scaler(dummy_dataset_path, output_dir):
    pipeline = TemporalDataPipeline(dummy_dataset_path, output_dir)
    pipeline.process()
    
    scaler = joblib.load(os.path.join(output_dir, "temporal_scaler.joblib"))
    assert scaler.n_samples_seen_ == 7  # It was only fitted on the train split

def test_artifacts_saved(dummy_dataset_path, output_dir):
    pipeline = TemporalDataPipeline(dummy_dataset_path, output_dir)
    pipeline.process()
    
    assert os.path.exists(os.path.join(output_dir, "train_temporal.joblib"))
    assert os.path.exists(os.path.join(output_dir, "val_temporal.joblib"))
    assert os.path.exists(os.path.join(output_dir, "test_temporal.joblib"))
    assert os.path.exists(os.path.join(output_dir, "temporal_scaler.joblib"))
    assert os.path.exists(os.path.join(output_dir, "temporal_metadata.json"))
