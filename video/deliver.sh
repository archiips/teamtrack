#!/bin/sh
# Muxes video + soundtrack, normalizes loudness, bakes the poster in as frame 0.
# Usage: sh video/deliver.sh [long|short|v2|v3]
set -e
cd "$(dirname "$0")"
CUT=${1:-long}
if [ "$CUT" = long ]; then SUF=""; POSTER_T=14.0
elif [ "$CUT" = v2 ]; then SUF="-v2"; POSTER_T=16.0
elif [ "$CUT" = v3 ]; then SUF="-v3"; POSTER_T=11.8
else SUF="-$CUT"; POSTER_T=5.8; fi
mkdir -p out
node render.mjs --cut "$CUT" --stills "$POSTER_T"
cp "work/stills/$CUT-t$(printf '%.2f' "$POSTER_T").png" "work/poster$SUF.png"
ffmpeg -y -loglevel error -i "work/poster$SUF.png" -q:v 2 "out/teamtrack-demo$SUF-poster.jpg"
ffmpeg -y -loglevel error \
  -i "work/video-noaudio$SUF.mp4" -i "work/music$SUF.wav" -i "work/poster$SUF.png" \
  -filter_complex "[0:v][2:v]overlay=enable='eq(n\,0)'[v];[1:a]loudnorm=I=-16:TP=-1.5:LRA=7[a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
  "out/teamtrack-demo$SUF.mp4"
echo "wrote out/teamtrack-demo$SUF.mp4"
