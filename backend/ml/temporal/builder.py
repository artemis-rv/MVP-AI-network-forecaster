import os
import json
import logging
import joblib
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

logger = logging.getLogger(__name__)

class TemporalSequenceBuilder:
    def __init__(self, input_dir, output_dir, seq_len=10, stride=1, sample_size=None):
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.seq_len = seq_len
        self.stride = stride
        self.sample_size = sample_size
        self.metadata = {}
        
    def build_split(self, split_name):
        logger.info(f"Building sequences for {split_name} split...")
        file_path = os.path.join(self.input_dir, f"{split_name}_temporal.joblib")
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Missing {file_path}")
            
        X_df, y_enc, y_orig = joblib.load(file_path)
        
        if self.sample_size:
            X_df = X_df.iloc[:self.sample_size]
            y_enc = y_enc[:self.sample_size]
            y_orig = y_orig[:self.sample_size]
            
        X_arr = X_df.values.astype(np.float32)
        y_bin = (y_orig != "Benign").astype(int)
        
        N, F = X_arr.shape
        num_seq = max(0, (N - self.seq_len) // self.stride)
        
        if num_seq == 0:
            logger.warning(f"Not enough samples in {split_name} to create any sequences.")
            self.metadata[f"{split_name}_sequence_count"] = 0
            return 0, F
            
        X_out_path = os.path.join(self.output_dir, f"X_{split_name}.npy")
        y_bin_out_path = os.path.join(self.output_dir, f"y_bin_{split_name}.npy")
        y_enc_out_path = os.path.join(self.output_dir, f"y_enc_{split_name}.npy")
        
        X_memmap = np.lib.format.open_memmap(X_out_path, mode='w+', dtype=X_arr.dtype, shape=(num_seq, self.seq_len, F))
        y_bin_memmap = np.lib.format.open_memmap(y_bin_out_path, mode='w+', dtype=np.int8, shape=(num_seq,))
        y_enc_memmap = np.lib.format.open_memmap(y_enc_out_path, mode='w+', dtype=y_enc.dtype, shape=(num_seq,))
        
        view = sliding_window_view(X_arr, (self.seq_len, F)).squeeze(axis=1)
        
        batch_size = 50000
        for i in range(0, num_seq, batch_size):
            end = min(i + batch_size, num_seq)
            idx = np.arange(i, end) * self.stride
            X_memmap[i:end] = view[idx]
            
            target_idx = idx + self.seq_len
            y_bin_memmap[i:end] = y_bin[target_idx]
            y_enc_memmap[i:end] = y_enc[target_idx]
            
        X_memmap.flush()
        y_bin_memmap.flush()
        y_enc_memmap.flush()
        
        unique_bin, counts_bin = np.unique(y_bin_memmap, return_counts=True)
        dist_bin = dict(zip([str(x) for x in unique_bin], [int(x) for x in counts_bin]))
        
        unique_enc, counts_enc = np.unique(y_enc_memmap, return_counts=True)
        dist_enc = dict(zip([str(x) for x in unique_enc], [int(x) for x in counts_enc]))
        
        self.metadata[f"{split_name}_sequence_count"] = int(num_seq)
        self.metadata[f"{split_name}_binary_distribution"] = dist_bin
        self.metadata[f"{split_name}_multiclass_distribution"] = dist_enc
        
        return int(num_seq), F

    def process(self):
        os.makedirs(self.output_dir, exist_ok=True)
        
        meta_path = os.path.join(self.input_dir, "temporal_metadata.json")
        if os.path.exists(meta_path):
            with open(meta_path, 'r') as f:
                step1_meta = json.load(f)
            self.metadata["dataset"] = step1_meta.get("dataset_name", "NF-UNSW-NB15-v3")
            self.metadata["timestamp_boundaries"] = step1_meta.get("temporal_boundaries", {})
            self.metadata["preprocessing_source"] = step1_meta.get("preprocessing_configuration", {})
        else:
            self.metadata["dataset"] = "NF-UNSW-NB15-v3"
            
        self.metadata["sequence_length"] = self.seq_len
        self.metadata["stride"] = self.stride
        
        seq_train, F = self.build_split("train")
        seq_val, _ = self.build_split("val")
        seq_test, _ = self.build_split("test")
        
        self.metadata["feature_count"] = F
        self.metadata["X_shape"] = [None, self.seq_len, F]
        self.metadata["Y_shape"] = [None]
        
        with open(os.path.join(self.output_dir, "sequence_metadata.json"), "w") as f:
            json.dump(self.metadata, f, indent=4)
            
        logger.info("Temporal Sequence Builder completed successfully.")
        return self.metadata
