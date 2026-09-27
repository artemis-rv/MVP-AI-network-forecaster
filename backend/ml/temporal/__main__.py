import argparse
import os
import logging
from .builder import TemporalSequenceBuilder

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def main():
    parser = argparse.ArgumentParser(description="NEXTRACE AI - ML Step 3: Temporal Sequence Builder")
    parser.add_argument("--input_dir", type=str, default=r"d:\MVP-AI-network-forecaster\backend\ml\data_pipeline\temporal_output", help="Directory containing Step 1 temporal artifacts.")
    parser.add_argument("--output_dir", type=str, default=r"d:\MVP-AI-network-forecaster\backend\ml\temporal\output", help="Directory to save generated sequences.")
    parser.add_argument("--sequence_length", type=int, default=10, help="Number of timesteps per sequence.")
    parser.add_argument("--stride", type=int, default=1, help="Stride between sequences.")
    parser.add_argument("--sample_size", type=int, default=None, help="Number of rows to use for testing/development.")
    parser.add_argument("--full_dataset", action="store_true", help="Process the full dataset splits.")
    
    args = parser.parse_args()
    
    sample = None if args.full_dataset else args.sample_size
    
    builder = TemporalSequenceBuilder(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        seq_len=args.sequence_length,
        stride=args.stride,
        sample_size=sample
    )
    
    builder.process()

if __name__ == "__main__":
    main()
