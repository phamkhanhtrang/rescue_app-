"""Shared Colab/server code for the two-model SOS experiment."""
import os

# This package uses PyTorch only; avoid importing an unrelated TensorFlow install.
os.environ.setdefault('USE_TF', '0')
os.environ.setdefault('USE_FLAX', '0')
