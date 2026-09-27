import os
import tempfile
import json
import pytest
import pandas as pd
import numpy as np
import joblib
from backend.ml.data_pipeline.pipeline import DataPipeline

@pytest.fixture
def dummy_dataset_path():
    # Create a small dummy CSV that simulates NF-UNSW-NB15-v3
    data = {
        "IPV4_SRC_ADDR": ["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4", "10.0.0.5", "10.0.0.6", "10.0.0.7", "10.0.0.8", "10.0.0.9", "10.0.0.10"],
        "L4_SRC_PORT": [1024, 2048, 80, 443, 53, 22, 21, 23, 110, 8080],
        "IN_BYTES": [100, 200, 300, np.inf, 500, 600, 700, 800, 900, 1000],
        "OUT_BYTES": [50, 150, 250, 350, np.nan, 550, 650, 750, 850, 950],
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

def test_dataset_loading_and_cleaning(dummy_dataset_path, output_dir):
    pipeline = DataPipeline(dummy_dataset_path, output_dir)
    df = pipeline.load_data()
    assert len(df) == 10
    
    df_clean = pipeline.clean_data(df)
    # 1 inf row, 1 nan row should be dropped, leaving 8
    assert len(df_clean) == 8
    assert pipeline.metadata["missing_value_statistics"]["OUT_BYTES"] == 1
    assert pipeline.metadata["missing_value_statistics"]["IN_BYTES"] == 1

def test_schema_validation(dummy_dataset_path, output_dir):
    pipeline = DataPipeline(dummy_dataset_path, output_dir)
    df = pipeline.load_data()
    label_col, attack_col = pipeline.validate_schema(df)
    assert label_col == "Label"
    assert attack_col == "Attack"

def test_preprocessing_and_artifacts(dummy_dataset_path, output_dir):
    pipeline = DataPipeline(dummy_dataset_path, output_dir)
    metadata = pipeline.process()
    
    # Check metadata
    assert metadata["row_count"] == 8
    assert "class_distribution" in metadata
    assert metadata["class_distribution"]["Benign"] == 5
    assert metadata["class_distribution"]["DoS"] == 2
    assert "Backdoor" not in metadata["class_distribution"] # Was dropped due to NaN/Inf in the dummy data row
    
    # Check artifacts
    assert os.path.exists(os.path.join(output_dir, "scaler.joblib"))
    assert os.path.exists(os.path.join(output_dir, "label_encoder.joblib"))
    assert os.path.exists(os.path.join(output_dir, "metadata.json"))
    assert os.path.exists(os.path.join(output_dir, "train.joblib"))
    assert os.path.exists(os.path.join(output_dir, "val.joblib"))
    assert os.path.exists(os.path.join(output_dir, "test.joblib"))
    
    # Check loaded data
    X_train, y_train_enc, y_train_orig = joblib.load(os.path.join(output_dir, "train.joblib"))
    assert len(X_train) == metadata["train_size"]
    
def test_leakage_prevention(dummy_dataset_path, output_dir):
    pipeline = DataPipeline(dummy_dataset_path, output_dir)
    pipeline.process()
    
    X_train, y_train_enc, y_train_orig = joblib.load(os.path.join(output_dir, "train.joblib"))
    # Ensure Attack and Label are NOT in X_train
    assert "Attack" not in X_train.columns
    assert "Label" not in X_train.columns
