#!/usr/bin/env python3
"""Generate a minimal 256x256 PNG icon for CloudronManifest."""
import struct
import zlib
from pathlib import Path


def png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def main() -> None:
    width, height = 256, 256
    # RGB rows: dark blue-purple (#1a1a2e) with lighter accent stripe
    rows = []
    for y in range(height):
        row = b"\x00"
        for x in range(width):
            if 80 <= x < 176 and 80 <= y < 176:
                row += bytes([0x4F, 0x9C, 0xF9])  # accent
            else:
                row += bytes([0x1A, 0x1A, 0x2E])
        rows.append(row)
    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += png_chunk(b"IHDR", ihdr)
    png += png_chunk(b"IDAT", compressed)
    png += png_chunk(b"IEND", b"")
    out = Path(__file__).resolve().parent.parent / "icon.png"
    out.write_bytes(png)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
