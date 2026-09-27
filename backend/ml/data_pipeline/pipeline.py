import os
import json
import logging
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
import joblib

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DataPipeline:
    def __init__(self, data_path, output_dir, sample_size=None, seed=42):
        self.data_path = data_path
        self.output_dir = output_dir
        self.sample_size = sample_size
        self.seed = seed
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        
        self.metadata = {
            "dataset_name": "NF-UNSW-NB15-v3",
            "dataset_source": data_path,
            "row_count": 0,
            "feature_count": 0,
            "class_distribution": {},
            "missing_value_statistics": {},
            "train_size": 0,
            "validation_size": 0,
            "test_size": 0,
            "preprocessing_configuration": {
                "scaler": "StandardScaler",
                "categorical_encoding": "LabelEncoder",
                "seed": seed,
                "sample_size": sample_size
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
        df.dropna(inplace=True)
        df.drop_duplicates(inplace=True)
        self.metadata["row_count"] = len(df)
        return df
        
    def validate_schema(self, df):
        label_col = 'Label'
        attack_col = 'Attack'
        
        if attack_col not in df.columns:
            if 'attack_cat' in df.columns:
                attack_col = 'attack_cat'
            elif 'Attack_cat' in df.columns:
                attack_col = 'Attack_cat'
                
        if label_col not in df.columns and attack_col not in df.columns:
            logger.warning("Standard Label/Attack columns not found. Printing columns:")
            logger.info(df.columns)
            raise ValueError("Could not identify Label or Attack category columns.")
            
        return label_col, attack_col

    def process(self):
        df = self.load_data()
        df = self.clean_data(df)
        label_col, attack_col = self.validate_schema(df)
        
        if attack_col in df.columns:
            df[attack_col] = df[attack_col].fillna('Benign')
            df[attack_col] = df[attack_col].replace('Normal', 'Benign')
            df[attack_col] = df[attack_col].replace('Backdoors', 'Backdoor')
            
            target_classes = ['Benign', 'Fuzzers', 'Analysis', 'Backdoor', 'DoS', 'Exploits', 'Generic', 'Reconnaissance', 'Shellcode', 'Worms']
            
            # Keep only the target classes
            df = df[df[attack_col].isin(target_classes)].copy()
            
            y_original = df[attack_col].copy()
            class_dist = y_original.value_counts().to_dict()
            self.metadata["class_distribution"] = {str(k): int(v) for k, v in class_dist.items()}
            logger.info(f"Class distribution: {self.metadata['class_distribution']}")
            
            y_encoded = self.label_encoder.fit_transform(y_original)
            drop_cols = [label_col, attack_col]
        else:
            y_original = df[label_col].copy()
            class_dist = y_original.value_counts().to_dict()
            self.metadata["class_distribution"] = {str(k): int(v) for k, v in class_dist.items()}
            y_encoded = y_original.values
            drop_cols = [label_col]
            
        X = df.drop(columns=[col for col in drop_cols if col in df.columns])
        
        numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = X.select_dtypes(exclude=[np.number]).columns.tolist()
        
        cat_encoders = {}
        for col in cat_cols:
            le = LabelEncoder()
            X.loc[:, col] = le.fit_transform(X[col].astype(str))
            cat_encoders[col] = le
            
        self.metadata["feature_count"] = X.shape[1]
        
        try:
            X_train, X_temp, y_train_enc, y_temp_enc, y_train_orig, y_temp_orig = train_test_split(
                X, y_encoded, y_original, test_size=0.3, random_state=self.seed, stratify=y_encoded
            )
        except ValueError:
            logger.warning("Stratified split failed on train/test. Falling back to random split.")
            X_train, X_temp, y_train_enc, y_temp_enc, y_train_orig, y_temp_orig = train_test_split(
                X, y_encoded, y_original, test_size=0.3, random_state=self.seed
            )
            
        try:
            X_val, X_test, y_val_enc, y_test_enc, y_val_orig, y_test_orig = train_test_split(
                X_temp, y_temp_enc, y_temp_orig, test_size=0.5, random_state=self.seed, stratify=y_temp_enc
            )
        except ValueError:
            logger.warning("Stratified split failed (likely due to small sample size). Falling back to random split.")
            X_val, X_test, y_val_enc, y_test_enc, y_val_orig, y_test_orig = train_test_split(
                X_temp, y_temp_enc, y_temp_orig, test_size=0.5, random_state=self.seed
            )
        
        logger.info("Fitting scaler on training data only...")
        X_train_num = X_train[numeric_cols]
        self.scaler.fit(X_train_num)
        
        # We convert X to dataframe after transform so it keeps column names, but for now we just transform in place
        X_train_scaled = X_train.copy()
        X_val_scaled = X_val.copy()
        X_test_scaled = X_test.copy()

        X_train_scaled.loc[:, numeric_cols] = self.scaler.transform(X_train[numeric_cols])
        X_val_scaled.loc[:, numeric_cols] = self.scaler.transform(X_val[numeric_cols])
        X_test_scaled.loc[:, numeric_cols] = self.scaler.transform(X_test[numeric_cols])
        
        self.metadata["train_size"] = len(X_train_scaled)
        self.metadata["validation_size"] = len(X_val_scaled)
        self.metadata["test_size"] = len(X_test_scaled)
        
        os.makedirs(self.output_dir, exist_ok=True)
        joblib.dump(self.scaler, os.path.join(self.output_dir, "scaler.joblib"))
        joblib.dump(self.label_encoder, os.path.join(self.output_dir, "label_encoder.joblib"))
        if cat_encoders:
            joblib.dump(cat_encoders, os.path.join(self.output_dir, "cat_encoders.joblib"))
            
        with open(os.path.join(self.output_dir, "metadata.json"), "w") as f:
            json.dump(self.metadata, f, indent=4)
            
        joblib.dump((X_train_scaled, y_train_enc, y_train_orig), os.path.join(self.output_dir, "train.joblib"))
        joblib.dump((X_val_scaled, y_val_enc, y_val_orig), os.path.join(self.output_dir, "val.joblib"))
        joblib.dump((X_test_scaled, y_test_enc, y_test_orig), os.path.join(self.output_dir, "test.joblib"))
        
        logger.info("Pipeline completed successfully.")
        return self.metadata
