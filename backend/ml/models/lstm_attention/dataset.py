import numpy as np
import torch
from torch.utils.data import Dataset

class MemmapTemporalDataset(Dataset):
    def __init__(self, x_path, y_bin_path, y_enc_path, sample_size=None):
        self.X = np.load(x_path, mmap_mode='r')
        self.y_bin = np.load(y_bin_path, mmap_mode='r')
        self.y_enc = np.load(y_enc_path, mmap_mode='r')
        
        if sample_size is not None:
            self.length = min(self.X.shape[0], sample_size)
        else:
            self.length = self.X.shape[0]

    def __len__(self):
        return self.length

    def __getitem__(self, idx):
        # We copy to convert from memmap read-only slice to a standard array, then to tensor
        x = torch.from_numpy(self.X[idx].copy()).float()
        y_bin = torch.tensor(self.y_bin[idx], dtype=torch.float32)
        y_enc = torch.tensor(self.y_enc[idx], dtype=torch.long)
        return x, y_bin, y_enc

    def close(self):
        del self.X
        del self.y_bin
        del self.y_enc
