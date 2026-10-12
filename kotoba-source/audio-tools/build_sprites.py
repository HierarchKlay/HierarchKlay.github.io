#!/usr/bin/env python3
"""Seven seekable MP3 sprite files, with sample-derived segment boundaries."""
import os
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np

ROOT = Path(__file__).resolve().parent
LESSON = Path(os.environ.get('KOTOBA_LESSON', str(ROOT.parent / 'dist/lesson.json')))
RATE = 24000
PAD_SECONDS = 0.20
PAD = np.zeros(round(RATE * PAD_SECONDS), dtype='<f4')


def decode(path):
    proc = subprocess.run([
        'ffmpeg', '-v', 'error', '-nostdin', '-i', str(path), '-threads', '1',
        '-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', str(RATE), '-ac', '1', 'pipe:1'
    ], capture_output=True, check=True)
    return np.frombuffer(proc.stdout, dtype='<f4')


def main():
    lesson_bytes = LESSON.read_bytes()
    lesson = json.loads(lesson_bytes)
    clips = {}
    files = []
    dest = ROOT / 'sprites'
    dest.mkdir(exist_ok=True)
    for day in lesson['days']:
        ids = day['core'] + day['reserve']
        assert len(ids) == 45 and len(set(ids)) == 45
        name = f"day-{int(day['number']):02}.mp3"
        blocks, cursor = [], 0
        expected_segments = []
        for ident in ids:
            for key in [ident, ident + '-example']:
                if key in clips:
                    raise ValueError(f'Duplicate audio sprite key: {key}')
                pcm = decode(ROOT / 'mp3' / (key + '.mp3'))
                block = np.concatenate([PAD, pcm, PAD])
                start = cursor / RATE
                cursor += len(block)
                end = cursor / RATE
                clips[key] = {'file': name, 'start': round(start, 6), 'end': round(end, 6)}
                expected_segments.append((key, start, end))
                blocks.append(block)
        combined = np.concatenate(blocks).astype('<f4')
        path = dest / name
        subprocess.run([
            'ffmpeg', '-v', 'error', '-nostdin', '-y', '-f', 'f32le', '-ar', str(RATE),
            '-ac', '1', '-i', 'pipe:0', '-threads', '1', '-ar', str(RATE), '-ac', '1',
            '-c:a', 'libmp3lame', '-b:a', '48k', '-write_xing', '1',
            '-metadata', f'title=日々ことば Day {day["number"]} synthesized Japanese',
            '-metadata', 'artist=Open JTalk / HTS Voice NIT ATR503 M001 1.05',
            '-metadata', 'comment=Voice: CC BY 3.0. See audio attribution. Synthetic reading aid, not pitch-accent evidence.',
            str(path)
        ], input=combined.tobytes(), capture_output=True, check=True)
        final = decode(path)
        # MP3 time-base rounding can add a few tail samples; it must not shift
        # the speech timeline or exceed 5 ms at the end of the whole sprite.
        delta_samples = len(final) - len(combined)
        if abs(delta_samples) > round(RATE * 0.005):
            raise ValueError(f'MP3 gapless duration mismatch in {name}: {len(final)} != {len(combined)}')
        n = min(len(final), len(combined))
        left, right = combined[:n].astype(float), final[:n].astype(float)
        alignment_correlation = float(np.dot(left, right) / np.sqrt(np.dot(left, left) * np.dot(right, right)))
        if alignment_correlation < 0.90:
            raise ValueError(f'Sprite waveform alignment failed: {name}: {alignment_correlation}')
        for key, start, end in expected_segments:
            # Test inside the speech area; padding alone must not satisfy the check.
            speech = final[round((start+PAD_SECONDS)*RATE):round((end-PAD_SECONDS)*RATE)]
            if len(speech) == 0 or not np.isfinite(speech).all() or np.sqrt(np.mean(speech.astype(float)**2)) < 0.002:
                raise ValueError(f'Sprite segment failed decoded non-silence check: {key}')
        data = path.read_bytes()
        files.append({'file': name, 'clips': len(expected_segments), 'duration': round(cursor/RATE, 6), 'decodedTailDeltaSamples': delta_samples, 'alignmentCorrelation': round(alignment_correlation, 6), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        print(f'{name}: {len(expected_segments)} segments; {cursor/RATE:.3f}s; {len(data)} bytes', flush=True)
    if len(clips) != 630:
        raise ValueError(f'Expected 630 segments, got {len(clips)}')
    result = {
        'version': 1, 'sampleRate': RATE, 'channels': 1, 'bitRate': 48000,
        'paddingBeforeSeconds': PAD_SECONDS, 'paddingAfterSeconds': PAD_SECONDS,
        'voice': 'HTS Voice NIT ATR503 M001 1.05', 'voiceLicense': 'CC BY 3.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by/3.0/',
        'notice': '合成朗读辅助，非真人录音；不可作为声调校验依据。',
        'lessonSha256': hashlib.sha256(lesson_bytes).hexdigest(),
        'totalBytes': sum(x['bytes'] for x in files), 'files': files, 'clips': clips,
    }
    (dest / 'audio-sprites.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'spriteFiles': len(files), 'clips': len(clips), 'totalBytes': result['totalBytes']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
