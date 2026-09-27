import os
import pytest
import numpy as np
import pandas as pd
import joblib
import tempfile
from sklearn.preprocessing import LabelEncoder
from backend.ml.baseline.baseline import BaselineModel

@pytest.fixture
def dummy_pipeline_output():
    with tempfile.TemporaryDirectory() as tmpdir:
        np.random.seed(42)
        X_train = pd.DataFrame(np.random.rand(10, 5), columns=["f1", "f2", "f3", "f4", "f5"])
        X_val = pd.DataFrame(np.random.rand(5, 5), columns=["f1", "f2", "f3", "f4", "f5"])
        X_test = pd.DataFrame(np.random.rand(5, 5), columns=["f1", "f2", "f3", "f4", "f5"])
        
        y_train_orig = pd.Series(["Benign", "DoS", "Benign", "Benign", "Exploits", "Benign", "Fuzzers", "DoS", "Exploits", "Benign"])
        y_val_orig = pd.Series(["Benign", "DoS", "Exploits", "Benign", "Fuzzers"])
        y_test_orig = pd.Series(["DoS", "Benign", "Fuzzers", "Benign", "Exploits"])
        
        le = LabelEncoder()
        le.fit(["Benign", "DoS", "Exploits", "Fuzzers"])
        
        y_train_enc = le.transform(y_train_orig)
        y_val_enc = le.transform(y_val_orig)
        y_test_enc = le.transform(y_test_orig)
        
        joblib.dump((X_train, y_train_enc, y_train_orig), os.path.join(tmpdir, "train.joblib"))
        joblib.dump((X_val, y_val_enc, y_val_orig), os.path.join(tmpdir, "val.joblib"))
        joblib.dump((X_test, y_test_enc, y_test_orig), os.path.join(tmpdir, "test.joblib"))
        joblib.dump(le, os.path.join(tmpdir, "label_encoder.joblib"))
        
        yield tmpdir

@pytest.fixture
def output_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir

def test_baseline_loading_and_evaluation(dummy_pipeline_output, output_dir):
    baseline = BaselineModel(dummy_pipeline_output, output_dir)
    results = baseline.train_and_evaluate()
    
    assert os.path.exists(os.path.join(output_dir, "binary_model.joblib"))
    assert os.path.exists(os.path.join(output_dir, "multiclass_model.joblib"))
    assert os.path.exists(os.path.join(output_dir, "baseline_metrics.json"))
    
    assert "binary_classification" in results
    assert "multiclass_classification" in results
    
    assert "tp" in results["binary_classification"]["validation"]["metrics"]
    assert "fpr" in results["binary_classification"]["test"]["metrics"]
    
    assert "macro avg" in results["multiclass_classification"]["validation"]["metrics"]
