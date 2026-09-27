import os
import json
import logging
import torch
import numpy as np
from torch.utils.data import DataLoader
from backend.ml.models.lstm_attention.model import LSTMAttentionWorldModel
from backend.ml.models.lstm_attention.dataset import MemmapTemporalDataset
from backend.ml.models.lstm_attention.trainer import ModelTrainer
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def evaluate_thresholds(model, dataloader, device, phase="val"):
    model.eval()
    all_bin_probs = []
    all_bin_true = []
    
    with torch.no_grad():
        for x, y_bin, _ in tqdm(dataloader, desc=f"Evaluating {phase}", leave=False):
            x, y_bin = x.to(device), y_bin.to(device)
            bin_logits, _, _ = model(x)
            
            probs = torch.sigmoid(bin_logits)
            all_bin_probs.extend(probs.cpu().numpy())
            all_bin_true.extend(y_bin.cpu().numpy())
            
    return np.array(all_bin_true), np.array(all_bin_probs)

def compute_metrics(y_true, y_prob, threshold):
    y_pred = (y_prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    
    return {
        "threshold": float(threshold),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "fpr": float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0,
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]]
    }

def run_experiment(exp_name, config_update, train_loader, val_loader, test_loader, device, input_dir, base_config):
    logger.info(f"--- Starting Experiment: {exp_name} ---")
    exp_dir = os.path.join(r"d:\MVP-AI-network-forecaster\backend\ml\models\lstm_attention\experiments", exp_name)
    os.makedirs(exp_dir, exist_ok=True)
    
    config = base_config.copy()
    config.update(config_update)
    
    with open(os.path.join(exp_dir, "experiment_config.json"), "w") as f:
        json.dump(config, f, indent=4)
        
    model = LSTMAttentionWorldModel(
        input_size=config["input_size"],
        hidden_size=config["hidden_size"],
        num_layers=config["num_layers"],
        dropout=config["dropout"],
        num_multiclass=config["num_multiclass"]
    )
    
    if config.get("load_existing_model"):
        logger.info("Loading existing model checkpoint...")
        model.load_state_dict(torch.load(r"d:\MVP-AI-network-forecaster\backend\ml\models\lstm_attention\output\best_model.pt", map_location=device, weights_only=True))
    else:
        logger.info("Training new model...")
        trainer = ModelTrainer(model, device, config, config["pos_weight_bin"], config["multi_weights"])
        trainer.fit(train_loader, val_loader, exp_dir)
        model.load_state_dict(torch.load(os.path.join(exp_dir, "best_model.pt"), map_location=device, weights_only=True))
        
    logger.info("Evaluating thresholds on Validation Set...")
    val_true, val_probs = evaluate_thresholds(model, val_loader, device, phase="val")
    
    thresholds = np.arange(0.05, 0.96, 0.05)
    val_results = []
    best_f1 = -1
    best_thresh = 0.5
    
    for t in thresholds:
        metrics = compute_metrics(val_true, val_probs, t)
        val_results.append(metrics)
        if metrics["f1"] > best_f1:
            best_f1 = metrics["f1"]
            best_thresh = t
            
    with open(os.path.join(exp_dir, "validation_threshold_results.json"), "w") as f:
        json.dump(val_results, f, indent=4)
        
    logger.info(f"Selected Best Threshold based on Val F1: {best_thresh:.2f} (F1: {best_f1:.4f})")
    
    logger.info("Evaluating on untouched Test Set...")
    test_true, test_probs = evaluate_thresholds(model, test_loader, device, phase="test")
    
    test_metrics = compute_metrics(test_true, test_probs, best_thresh)
    test_metrics["best_validation_threshold"] = best_thresh
    
    # Ensure attention works properly
    x, _, _ = next(iter(test_loader))
    x = x.to(device)
    _, _, attn = model(x)
    attn_sum = torch.sum(attn, dim=1).mean().item()
    test_metrics["attention_verification"] = {
        "shape": list(attn.shape),
        "average_sum": attn_sum
    }
    
    with open(os.path.join(exp_dir, "test_metrics.json"), "w") as f:
        json.dump(test_metrics, f, indent=4)
        
    with open(os.path.join(exp_dir, "confusion_matrix_binary.json"), "w") as f:
        json.dump(test_metrics["confusion_matrix"], f, indent=4)
        
    return test_metrics

def main():
    input_dir = r"d:\MVP-AI-network-forecaster\backend\ml\temporal\output"
    
    with open(os.path.join(input_dir, "sequence_metadata.json"), 'r') as f:
        metadata = json.load(f)
        
    train_multi = metadata["train_multiclass_distribution"]
    n_total = sum(train_multi.values())
    num_classes = len(train_multi)
    multi_weights = [n_total / (num_classes * max(train_multi.get(str(i), 1), 1)) for i in range(10)]
    
    train_ds = MemmapTemporalDataset(os.path.join(input_dir, "X_train.npy"), os.path.join(input_dir, "y_bin_train.npy"), os.path.join(input_dir, "y_enc_train.npy"))
    val_ds = MemmapTemporalDataset(os.path.join(input_dir, "X_val.npy"), os.path.join(input_dir, "y_bin_val.npy"), os.path.join(input_dir, "y_enc_val.npy"))
    test_ds = MemmapTemporalDataset(os.path.join(input_dir, "X_test.npy"), os.path.join(input_dir, "y_bin_test.npy"), os.path.join(input_dir, "y_enc_test.npy"))
    
    batch_size = 2048
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    base_config = {
        "hidden_size": 128,
        "num_layers": 2,
        "dropout": 0.2,
        "learning_rate": 1e-3,
        "batch_size": batch_size,
        "epochs": 3,
        "patience": 3,
        "binary_loss_weight": 1.0,
        "multiclass_loss_weight": 1.0,
        "input_size": 53,
        "num_multiclass": 10,
        "multi_weights": multi_weights
    }
    
    summary = {}
    
    # 1. Tune Original 
    summary["Original (Tuned Threshold)"] = run_experiment(
        "exp1_original_tuned",
        {"load_existing_model": True, "pos_weight_bin": 33.0}, 
        train_loader, val_loader, test_loader, device, input_dir, base_config
    )
    
    # 2. Reduced Weight
    summary["Reduced Weight (10.0)"] = run_experiment(
        "exp2_reduced_weight_10",
        {"load_existing_model": False, "pos_weight_bin": 10.0}, 
        train_loader, val_loader, test_loader, device, input_dir, base_config
    )
    
    # 3. No Weight
    summary["No Weight (1.0)"] = run_experiment(
        "exp3_no_weight_1",
        {"load_existing_model": False, "pos_weight_bin": 1.0}, 
        train_loader, val_loader, test_loader, device, input_dir, base_config
    )
    
    with open(r"d:\MVP-AI-network-forecaster\backend\ml\models\lstm_attention\experiments\summary_table.json", "w") as f:
        json.dump(summary, f, indent=4)
        
    logger.info("All tuning experiments completed successfully.")

if __name__ == "__main__":
    main()
