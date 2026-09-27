import argparse
import os
from .baseline import BaselineModel

def main():
    parser = argparse.ArgumentParser(description="NEXTRACE AI - ML Step 2: Logistic Regression Baseline")
    parser.add_argument("--input_dir", type=str, default=r"d:\MVP-AI-network-forecaster\backend\ml\data_pipeline\output", help="Directory containing Step 1 artifacts.")
    parser.add_argument("--output_dir", type=str, default=r"d:\MVP-AI-network-forecaster\backend\ml\baseline\output", help="Directory to save baseline artifacts.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for model training.")
    parser.add_argument("--max_iter", type=int, default=1000, help="Maximum iterations for Logistic Regression.")
    parser.add_argument("--class_weight", type=str, default="balanced", help="Class weight strategy (e.g., 'balanced' or 'None').")
    
    args = parser.parse_args()
    
    cw = None if args.class_weight.lower() == "none" else args.class_weight
    
    baseline = BaselineModel(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        seed=args.seed,
        max_iter=args.max_iter,
        class_weight=cw
    )
    
    baseline.train_and_evaluate()

if __name__ == "__main__":
    main()
