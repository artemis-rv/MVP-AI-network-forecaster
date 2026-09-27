import os
import json
import logging
import torch
import torch.nn as nn
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix, accuracy_score
import numpy as np
from tqdm import tqdm

logger = logging.getLogger(__name__)

class ModelTrainer:
    def __init__(self, model, device, config, pos_weight_bin, multi_weights):
        self.model = model.to(device)
        self.device = device
        self.config = config
        
        # Binary: BCEWithLogitsLoss takes pos_weight
        self.pos_weight = torch.tensor([pos_weight_bin], dtype=torch.float32).to(device)
        self.criterion_bin = nn.BCEWithLogitsLoss(pos_weight=self.pos_weight)
        
        # Multiclass: CrossEntropyLoss takes weight
        self.multi_weights = torch.tensor(multi_weights, dtype=torch.float32).to(device)
        self.criterion_multi = nn.CrossEntropyLoss(weight=self.multi_weights)
        
        self.optimizer = torch.optim.Adam(
            self.model.parameters(), 
            lr=config.get("learning_rate", 1e-3),
            weight_decay=config.get("weight_decay", 1e-5)
        )
        
        self.bin_loss_weight = config.get("binary_loss_weight", 1.0)
        self.multi_loss_weight = config.get("multiclass_loss_weight", 1.0)
        
        self.history = {"train_loss": [], "val_loss": [], "val_f1_macro": []}
        self.best_val_metric = -1.0
        self.patience_counter = 0

    def train_epoch(self, dataloader):
        self.model.train()
        total_loss = 0
        for x, y_bin, y_enc in tqdm(dataloader, desc="Training", leave=False):
            x, y_bin, y_enc = x.to(self.device), y_bin.to(self.device), y_enc.to(self.device)
            
            self.optimizer.zero_grad()
            bin_logits, multi_logits, _ = self.model(x)
            
            loss_bin = self.criterion_bin(bin_logits, y_bin)
            loss_multi = self.criterion_multi(multi_logits, y_enc)
            
            loss = (self.bin_loss_weight * loss_bin) + (self.multi_loss_weight * loss_multi)
            loss.backward()
            self.optimizer.step()
            
            total_loss += loss.item()
            
        return total_loss / len(dataloader)

    def evaluate(self, dataloader, phase="val"):
        self.model.eval()
        total_loss = 0
        
        all_bin_preds = []
        all_bin_true = []
        all_multi_preds = []
        all_multi_true = []
        
        with torch.no_grad():
            for x, y_bin, y_enc in tqdm(dataloader, desc=f"Evaluating {phase}", leave=False):
                x, y_bin, y_enc = x.to(self.device), y_bin.to(self.device), y_enc.to(self.device)
                
                bin_logits, multi_logits, _ = self.model(x)
                
                loss_bin = self.criterion_bin(bin_logits, y_bin)
                loss_multi = self.criterion_multi(multi_logits, y_enc)
                loss = (self.bin_loss_weight * loss_bin) + (self.multi_loss_weight * loss_multi)
                total_loss += loss.item()
                
                bin_preds = (torch.sigmoid(bin_logits) > 0.5).int()
                multi_preds = torch.argmax(multi_logits, dim=1)
                
                all_bin_preds.extend(bin_preds.cpu().numpy())
                all_bin_true.extend(y_bin.cpu().numpy())
                all_multi_preds.extend(multi_preds.cpu().numpy())
                all_multi_true.extend(y_enc.cpu().numpy())
                
        metrics = {
            "loss": total_loss / len(dataloader),
            "binary": {
                "accuracy": float(accuracy_score(all_bin_true, all_bin_preds)),
                "precision": float(precision_score(all_bin_true, all_bin_preds, zero_division=0)),
                "recall": float(recall_score(all_bin_true, all_bin_preds, zero_division=0)),
                "f1": float(f1_score(all_bin_true, all_bin_preds, zero_division=0)),
                "confusion_matrix": confusion_matrix(all_bin_true, all_bin_preds).tolist()
            },
            "multiclass": {
                "accuracy": float(accuracy_score(all_multi_true, all_multi_preds)),
                "f1_macro": float(f1_score(all_multi_true, all_multi_preds, average='macro', zero_division=0)),
                "f1_weighted": float(f1_score(all_multi_true, all_multi_preds, average='weighted', zero_division=0)),
                "precision_macro": float(precision_score(all_multi_true, all_multi_preds, average='macro', zero_division=0)),
                "recall_macro": float(recall_score(all_multi_true, all_multi_preds, average='macro', zero_division=0)),
                "confusion_matrix": confusion_matrix(all_multi_true, all_multi_preds).tolist()
            }
        }
        return metrics

    def fit(self, train_loader, val_loader, output_dir):
        epochs = self.config.get("epochs", 10)
        patience = self.config.get("patience", 3)
        
        for epoch in range(epochs):
            train_loss = self.train_epoch(train_loader)
            val_metrics = self.evaluate(val_loader, phase="val")
            val_loss = val_metrics["loss"]
            val_f1 = val_metrics["multiclass"]["f1_macro"]
            
            logger.info(f"Epoch {epoch+1}/{epochs} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val Macro F1: {val_f1:.4f}")
            
            self.history["train_loss"].append(train_loss)
            self.history["val_loss"].append(val_loss)
            self.history["val_f1_macro"].append(val_f1)
            
            if val_f1 > self.best_val_metric:
                self.best_val_metric = val_f1
                self.patience_counter = 0
                torch.save(self.model.state_dict(), os.path.join(output_dir, "best_model.pt"))
                with open(os.path.join(output_dir, "validation_metrics.json"), "w") as f:
                    json.dump(val_metrics, f, indent=4)
                logger.info("-> Saved new best model")
            else:
                self.patience_counter += 1
                if self.patience_counter >= patience:
                    logger.info(f"Early stopping triggered at epoch {epoch+1}")
                    break
        
        with open(os.path.join(output_dir, "training_history.json"), "w") as f:
            json.dump(self.history, f, indent=4)
