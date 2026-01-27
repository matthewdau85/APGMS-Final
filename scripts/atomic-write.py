#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime
import os
from pathlib import Path
import shutil
import sys


def validate_content(data: bytes) -> None:
    if b'\x00' in data:
        raise ValueError('source contains NUL byte')
    if b'\r' in data:
        raise ValueError('source contains CR characters; expected LF only')
    try:
        data.decode('ascii')
    except UnicodeDecodeError as exc:
        raise ValueError(f'source is not ASCII-only: {exc}')


def main() -> int:
    parser = argparse.ArgumentParser(description='Atomically replace a file with validation + backups')
    parser.add_argument('target', type=Path, help='Target file path to replace')
    parser.add_argument('source', type=Path, help='Source temp file path (validated first)')
    args = parser.parse_args()

    if not args.source.exists():
        print(f'FAIL: source file {args.source} does not exist', file=sys.stderr)
        return 1

    data = args.source.read_bytes()
    try:
        validate_content(data)
    except ValueError as exc:
        print(f'FAIL: validation error: {exc}', file=sys.stderr)
        return 2

    target_dir = args.target.parent
    target_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    if args.target.exists():
        backup = args.target.with_suffix(f'{args.target.suffix}.bak-{timestamp}') if args.target.suffix else Path(f'{args.target}.bak-{timestamp}')
        shutil.copy2(args.target, backup)
        print(f'Backed up {args.target} -> {backup}')

    temp_path = args.target.with_suffix(f'{args.target.suffix}.tmp') if args.target.suffix else Path(f'{args.target}.tmp')
    temp_path.write_bytes(data)
    os.replace(temp_path, args.target)

    print(f'OK: {args.target} updated from {args.source}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
