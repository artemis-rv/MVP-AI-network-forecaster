import argparse
import os
from .pipeline import DataPipeline
from .temporal_pipeline import TemporalDataPipeline

def main():
    parser = argparse.ArgumentParser(description="NEXTRACE AI - ML Step 1: NF-UNSW-NB15-v3 Data Pipeline")
    parser.add_argument("--data_path", type=str, default=r"d:\MVP-AI-network-forecaster\Dataset\data\NF-UNSW-NB15-v3.csv", help="Path to the dataset CSV.")
    parser.add_argument("--sample_size", type=int, default=10000, help="Number of rows to process. Use --full_dataset to process all.")
    parser.add_argument("--full_dataset", action="store_true", help="Process the entire dataset.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for splitting.")
    parser.add_argument("--output_dir", type=str, default=r"d:\MVP-AI-network-forecaster\backend\ml\data_pipeline\output", help="Directory to save artifacts.")
    parser.add_argument("--temporal_output_dir", type=str, default=r"d:\MVP-AI-network-forecaster\backend\ml\data_pipeline\temporal_output", help="Directory for temporal artifacts.")
    parser.add_argument("--temporal", action="store_true", help="Run the chronological temporal pipeline instead of random stratified.")
    
    args = parser.parse_args()
    
    sample_size = None if args.full_dataset else args.sample_size
    
    if args.temporal:
        pipeline = TemporalDataPipeline(
            data_path=args.data_path,
            output_dir=args.temporal_output_dir,
            sample_size=sample_size,
            seed=args.seed
        )
    else:
        pipeline = DataPipeline(
            data_path=args.data_path,
            output_dir=args.output_dir,
            sample_size=sample_size,
            seed=args.seed
        )
    
    pipeline.process()

if __name__ == "__main__":
    main()
