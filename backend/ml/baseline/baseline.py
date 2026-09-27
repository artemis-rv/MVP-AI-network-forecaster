import os
import json
import logging
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BaselineModel:
    def __init__(self, input_dir, output_dir, seed=42, max_iter=1000, class_weight='balanced'):
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.seed = seed
        self.max_iter = max_iter
        self.class_weight = class_weight
        
        self.binary_model = LogisticRegression(
            random_state=seed, max_iter=max_iter, class_weight=class_weight, verbose=1
        )
        self.multiclass_model = LogisticRegression(
            random_state=seed, max_iter=max_iter, class_weight=class_weight, verbose=1
        )
        
    def load_data(self):
        logger.info(f"Loading datasets from {self.input_dir}...")
        self.X_train, self.y_train_enc, self.y_train_orig = joblib.load(os.path.join(self.input_dir, "train.joblib"))
        self.X_val, self.y_val_enc, self.y_val_orig = joblib.load(os.path.join(self.input_dir, "val.joblib"))
        self.X_test, self.y_test_enc, self.y_test_orig = joblib.load(os.path.join(self.input_dir, "test.joblib"))
        self.label_encoder = joblib.load(os.path.join(self.input_dir, "label_encoder.joblib"))
        
        self.y_train_bin = (self.y_train_orig != "Benign").astype(int)
        self.y_val_bin = (self.y_val_orig != "Benign").astype(int)
        self.y_test_bin = (self.y_test_orig != "Benign").astype(int)
        
    def evaluate_binary(self, model, X, y_true, split_name="validation"):
        y_pred = model.predict(X)
        cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        
        metrics = {
            "accuracy": accuracy_score(y_true, y_pred),
            "precision": precision_score(y_true, y_pred, zero_division=0),
            "recall": recall_score(y_true, y_pred, zero_division=0),
            "f1": f1_score(y_true, y_pred, zero_division=0),
            "fpr": fpr,
            "tp": int(tp),
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn)
        }
        return metrics, cm.tolist()
        
    def evaluate_multiclass(self, model, X, y_true, split_name="validation"):
        y_pred = model.predict(X)
        cm = confusion_matrix(y_true, y_pred)
        report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)
        return report, cm.tolist()

    def train_and_evaluate(self):
        self.load_data()
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        logger.info("Training Binary Logistic Regression...")
        self.binary_model.fit(self.X_train, self.y_train_bin)
        
        logger.info("Evaluating Binary Baseline...")
        val_bin_metrics, val_bin_cm = self.evaluate_binary(self.binary_model, self.X_val, self.y_val_bin, "validation")
        test_bin_metrics, test_bin_cm = self.evaluate_binary(self.binary_model, self.X_test, self.y_test_bin, "test")
        
        logger.info("Training Multiclass Logistic Regression...")
        self.multiclass_model.fit(self.X_train, self.y_train_enc)
        
        logger.info("Evaluating Multiclass Baseline...")
        val_multi_metrics, val_multi_cm = self.evaluate_multiclass(self.multiclass_model, self.X_val, self.y_val_enc, "validation")
        test_multi_metrics, test_multi_cm = self.evaluate_multiclass(self.multiclass_model, self.X_test, self.y_test_enc, "test")
        
        results = {
            "metadata": {
                "input_dir": self.input_dir,
                "seed": self.seed,
                "max_iter": self.max_iter,
                "class_weight": self.class_weight,
                "note": "IP addresses were encoded as arbitrary integers by LabelEncoder in Step 1. They are treated as continuous numeric features here, which is suboptimal but strictly follows the Step 1 artifacts."
            },
            "binary_classification": {
                "validation": {
                    "metrics": val_bin_metrics,
                    "confusion_matrix": val_bin_cm
                },
                "test": {
                    "metrics": test_bin_metrics,
                    "confusion_matrix": test_bin_cm
                }
            },
            "multiclass_classification": {
                "validation": {
                    "metrics": val_multi_metrics,
                    "confusion_matrix": val_multi_cm
                },
                "test": {
                    "metrics": test_multi_metrics,
                    "confusion_matrix": test_multi_cm
                },
                "classes": self.label_encoder.classes_.tolist()
            }
        }
        
        with open(os.path.join(self.output_dir, "baseline_metrics.json"), "w") as f:
            json.dump(results, f, indent=4)
            
        joblib.dump(self.binary_model, os.path.join(self.output_dir, "binary_model.joblib"))
        joblib.dump(self.multiclass_model, os.path.join(self.output_dir, "multiclass_model.joblib"))
        
        logger.info("Baseline training and evaluation completed successfully.")
        return results
