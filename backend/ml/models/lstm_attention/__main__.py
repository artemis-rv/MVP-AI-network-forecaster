import argparse
import os
import json
import logging
import torch
import numpy as np
from torch.utils.data import DataLoader
from .model import LSTMAttentionWorldModel
from .dataset import MemmapTemporalDataset
from .trainer import ModelTrainer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="NEXTRACE AI - ML Step 4: LSTM Attention World Model")
    parser.add_argument("--input_dir", type=str, default=r"d:\MVP-AI-network-forecaster\backend\ml\temporal\output")
    parser.add_argument("--output_dir", type=str, default=r"d:\MVP-AI-network-forecaster\backend\ml\models\lstm_attention\output")
    parser.add_argument("--smoke_test", action="store_true", help="Run a quick smoke test on a subset.")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch_size", type=int, default=2048)
    parser.add_argument("--hidden_size", type=int, default=128)
    parser.add_argument("--num_layers", type=int, default=2)
    parser.add_argument("--dropout", type=float, default=0.2)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--patience", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    
    args = parser.parse_args()
    
    # Reproducibility
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Load metadata
    meta_path = os.path.join(args.input_dir, "sequence_metadata.json")
    with open(meta_path, 'r') as f:
        metadata = json.load(f)
        
    # Calculate Class Weights using TRAINING set only
    train_bin = metadata["train_binary_distribution"]
    n_neg = train_bin.get("0", 0)
    n_pos = train_bin.get("1", 0)
    pos_weight_bin = n_neg / max(n_pos, 1)
    
    train_multi = metadata["train_multiclass_distribution"]
    n_total = sum(train_multi.values())
    num_classes = len(train_multi)
    # weights = N_total / (num_classes * N_i)
    # Default to 0 for missing classes (or a very small weight), but all 10 classes should exist.
    multi_weights = [n_total / (num_classes * max(train_multi.get(str(i), 1), 1)) for i in range(10)]
    
    with open(os.path.join(args.output_dir, "class_weights.json"), "w") as f:
        json.dump({"binary_pos_weight": pos_weight_bin, "multiclass_weights": multi_weights}, f, indent=4)
        
    config = {
        "hidden_size": args.hidden_size,
        "num_layers": args.num_layers,
        "dropout": args.dropout,
        "learning_rate": args.lr,
        "batch_size": args.batch_size,
        "epochs": args.epochs if not args.smoke_test else 1,
        "patience": args.patience,
        "binary_loss_weight": 1.0,
        "multiclass_loss_weight": 1.0,
        "input_size": metadata["feature_count"],
        "num_multiclass": 10
    }
    
    with open(os.path.join(args.output_dir, "model_config.json"), "w") as f:
        json.dump(config, f, indent=4)
        
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {device}")
    
    sample_size = 5000 if args.smoke_test else None
    
    logger.info("Loading Datasets...")
    train_ds = MemmapTemporalDataset(
        os.path.join(args.input_dir, "X_train.npy"),
        os.path.join(args.input_dir, "y_bin_train.npy"),
        os.path.join(args.input_dir, "y_enc_train.npy"),
        sample_size=sample_size
    )
    val_ds = MemmapTemporalDataset(
        os.path.join(args.input_dir, "X_val.npy"),
        os.path.join(args.input_dir, "y_bin_val.npy"),
        os.path.join(args.input_dir, "y_enc_val.npy"),
        sample_size=sample_size
    )
    
    train_loader = DataLoader(train_ds, batch_size=config["batch_size"], shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=config["batch_size"], shuffle=False, num_workers=0)
    
    model = LSTMAttentionWorldModel(
        input_size=config["input_size"],
        hidden_size=config["hidden_size"],
        num_layers=config["num_layers"],
        dropout=config["dropout"],
        num_multiclass=config["num_multiclass"]
    )
    
    trainer = ModelTrainer(model, device, config, pos_weight_bin, multi_weights)
    
    logger.info("Starting training...")
    trainer.fit(train_loader, val_loader, args.output_dir)
    
    logger.info("Evaluating on Test Set...")
    # Load best model
    model.load_state_dict(torch.load(os.path.join(args.output_dir, "best_model.pt"), weights_only=True))
    test_ds = MemmapTemporalDataset(
        os.path.join(args.input_dir, "X_test.npy"),
        os.path.join(args.input_dir, "y_bin_test.npy"),
        os.path.join(args.input_dir, "y_enc_test.npy"),
        sample_size=sample_size
    )
    test_loader = DataLoader(test_ds, batch_size=config["batch_size"], shuffle=False, num_workers=0)
    
    test_metrics = trainer.evaluate(test_loader, phase="test")
    
    with open(os.path.join(args.output_dir, "test_metrics.json"), "w") as f:
        json.dump(test_metrics, f, indent=4)
        
    with open(os.path.join(args.output_dir, "confusion_matrix_binary.json"), "w") as f:
        json.dump(test_metrics["binary"]["confusion_matrix"], f, indent=4)
        
    with open(os.path.join(args.output_dir, "confusion_matrix_multiclass.json"), "w") as f:
        json.dump(test_metrics["multiclass"]["confusion_matrix"], f, indent=4)
        
    logger.info("ML Step 4 completed successfully.")

if __name__ == "__main__":
    main()
