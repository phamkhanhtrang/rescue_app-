"""Model A: one encoder + two classification heads. Model B uses HF token classifier."""
import json
from pathlib import Path
import torch
from torch import nn
from transformers import AutoModel
from safetensors.torch import save_file, load_file
from .data import NEEDS


class RequestNeedsModel(nn.Module):
    def __init__(self, encoder):
        super().__init__()
        self.encoder = encoder
        self.dropout = nn.Dropout(0.1)
        self.heads = nn.ModuleDict({'request': nn.Linear(encoder.config.hidden_size, 1),
                                    'needs': nn.Linear(encoder.config.hidden_size, len(NEEDS))})

    def forward(self, input_ids, attention_mask):
        pooled = self.dropout(self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state[:, 0])
        return self.heads['request'](pooled).squeeze(-1), self.heads['needs'](pooled)

    def save_bundle(self, directory, tokenizer, metadata):
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        self.encoder.save_pretrained(directory / 'encoder', safe_serialization=True)
        tokenizer.save_pretrained(directory)
        save_file({k: v.detach().cpu().contiguous() for k, v in self.heads.state_dict().items()}, str(directory / 'heads.safetensors'))
        (directory / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')

    @classmethod
    def from_bundle(cls, directory):
        directory = Path(directory)
        model = cls(AutoModel.from_pretrained(directory / 'encoder', local_files_only=True))
        model.heads.load_state_dict(load_file(str(directory / 'heads.safetensors')))
        return model
