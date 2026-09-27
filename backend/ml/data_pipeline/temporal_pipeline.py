import os
import json
import logging
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
import warnings
warnings.filterwarnings('ignore', category=FutureWarning)

logger = logging.getLogger(__name__)

class TemporalDataPipeline:
    def __init__(self, data_path, output_dir, sample_size=None, seed=42):
        self.data_path = data_path
        self.output_dir = output_dir
        self.sample_size = sample_size
        self.seed = seed
        self.scaler = StandardScaler()
        self.metadata = {
            "dataset_name": "NF-UNSW-NB15-v3",
            "dataset_source": self.data_path,
            "preprocessing_configuration": {
                "scaler": "StandardScaler",
                "categorical_encoding": "LabelEncoder",
                "seed": self.seed,
                "sample_size": self.sample_size,
                "split_type": "chronological"
            }
        }
        
    def load_data(self):
        logger.info(f"Loading data from {self.data_path}")
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Dataset not found at {self.data_path}")
            
        if self.sample_size:
            df = pd.read_csv(self.data_path, nrows=self.sample_size)
            logger.info(f"Loaded {len(df)} rows (sample mode).")
        else:
            df = pd.read_csv(self.data_path)
            logger.info(f"Loaded {len(df)} rows (full mode).")
            
        return df

    def clean_data(self, df):
        logger.info("Cleaning data...")
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        missing_stats = df.isna().sum().to_dict()
        self.metadata["missing_value_statistics"] = {k: int(v) for k, v in missing_stats.items() if v > 0}
        
        initial_len = len(df)
        df.dropna(inplace=True)
        final_len = len(df)
        logger.info(f"Dropped {initial_len - final_len} rows containing NaN/Inf values.")
        
        if "FLOW_START_MILLISECONDS" not in df.columns:
            raise ValueError("Dataset missing 'FLOW_START_MILLISECONDS' column required for temporal ordering.")
            
        logger.info("Sorting chronologically by FLOW_START_MILLISECONDS...")
        df.sort_values(by="FLOW_START_MILLISECONDS", inplace=True)
        df.reset_index(drop=True, inplace=True)
        
        return df

    def validate_schema(self, df):
        if "Label" not in df.columns or "Attack" not in df.columns:
            raise ValueError("Target columns 'Label' or 'Attack' missing from dataset.")
        return "Label", "Attack"

    def process(self):
        df = self.load_data()
        df = self.clean_data(df)
        label_col, attack_col = self.validate_schema(df)
        
        self.metadata["row_count"] = len(df)
        y_original = df[attack_col].copy()
        
        self.label_encoder = LabelEncoder()
        y_encoded = self.label_encoder.fit_transform(y_original.astype(str))
        
        X = df.drop(columns=[label_col, attack_col])
        numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = X.select_dtypes(exclude=[np.number]).columns.tolist()
        
        cat_encoders = {}
        for col in cat_cols:
            le = LabelEncoder()
            X.loc[:, col] = le.fit_transform(X[col].astype(str))
            cat_encoders[col] = le
            
        self.metadata["feature_count"] = X.shape[1]
        
        n_samples = len(X)
        train_end = int(n_samples * 0.7)
        val_end = int(n_samples * 0.85)
        
        X_train = X.iloc[:train_end]
        y_train_enc = y_encoded[:train_end]
        y_train_orig = y_original.iloc[:train_end]
        
        X_val = X.iloc[train_end:val_end]
        y_val_enc = y_encoded[train_end:val_end]
        y_val_orig = y_original.iloc[train_end:val_end]
        
        X_test = X.iloc[val_end:]
        y_test_enc = y_encoded[val_end:]
        y_test_orig = y_original.iloc[val_end:]
        
        train_start = X_train["FLOW_START_MILLISECONDS"].min()
        train_end_ts = X_train["FLOW_START_MILLISECONDS"].max()
        val_start = X_val["FLOW_START_MILLISECONDS"].min()
        val_end_ts = X_val["FLOW_START_MILLISECONDS"].max()
        test_start = X_test["FLOW_START_MILLISECONDS"].min()
        test_end_ts = X_test["FLOW_START_MILLISECONDS"].max()
        
        self.metadata["temporal_boundaries"] = {
            "train": {"start": int(train_start), "end": int(train_end_ts)},
            "validation": {"start": int(val_start), "end": int(val_end_ts)},
            "test": {"start": int(test_start), "end": int(test_end_ts)}
        }
        
        if train_end_ts > val_start or val_end_ts > test_start:
             logger.warning("Timestamp overlap detected across chronological splits.")
        
        self.metadata["split_sizes"] = {
            "train_count": len(X_train),
            "validation_count": len(X_val),
            "test_count": len(X_test)
        }
        
        self.metadata["class_distributions"] = {
            "train": y_train_orig.value_counts().to_dict(),
            "validation": y_val_orig.value_counts().to_dict(),
            "test": y_test_orig.value_counts().to_dict()
        }
        
        logger.info("Fitting scaler on temporal training data only...")
        X_train_num = X_train[numeric_cols]
        self.scaler.fit(X_train_num)
        
        X_train_scaled = X_train.copy()
        X_val_scaled = X_val.copy()
        X_test_scaled = X_test.copy()
        
        X_train_scaled.loc[:, numeric_cols] = self.scaler.transform(X_train[numeric_cols])
        X_val_scaled.loc[:, numeric_cols] = self.scaler.transform(X_val[numeric_cols])
        X_test_scaled.loc[:, numeric_cols] = self.scaler.transform(X_test[numeric_cols])
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        joblib.dump(self.scaler, os.path.join(self.output_dir, "temporal_scaler.joblib"))
        joblib.dump(self.label_encoder, os.path.join(self.output_dir, "temporal_label_encoder.joblib"))
        joblib.dump(cat_encoders, os.path.join(self.output_dir, "temporal_cat_encoders.joblib"))
        
        joblib.dump((X_train_scaled, y_train_enc, y_train_orig.values), os.path.join(self.output_dir, "train_temporal.joblib"))
        joblib.dump((X_val_scaled, y_val_enc, y_val_orig.values), os.path.join(self.output_dir, "val_temporal.joblib"))
        joblib.dump((X_test_scaled, y_test_enc, y_test_orig.values), os.path.join(self.output_dir, "test_temporal.joblib"))
        
        with open(os.path.join(self.output_dir, "temporal_metadata.json"), "w") as f:
            json.dump(self.metadata, f, indent=4)
            
        logger.info("Temporal pipeline completed successfully.")
        return self.metadata
