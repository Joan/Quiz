# Video

**Cut 30 sec from 22’22”**
```
ffmpeg -ss 00:22:22 -i in.mp4 -t 00:00:30 -async 1 out.mp4
f=in.avi && ffmpeg -ss 00:22:22 -i $f -t 00:00:30 -async 1 ${f%.*}-out.mp4
```

**Extract 30 sec from 8’ and convert to MP4**
```
ffmpeg -ss 00:08:00 -i in.avi -t 00:00:30 -c:v libx264 -c:a aac out.mp4
f=in.avi && ffmpeg -ss 00:08:00.000 -i $f -t 00:00:30 -c:v libx264 -c:a aac ${f%.*}-out.mp4
```

**Force H264 and AAC codecs to MP4**
```
ffmpeg -i in.mp4 -c:v libx264 -c:a aac out.mp4
```

### Normalisation

```
for i in in/*.mp4; do ffmpeg -i "$i" "out/${${i:3}%.*}-norm.mp4"; done
```
```
for i in in/*.mp4; do ./videously.sh -a -i "$i" -o "out/${${i:3}%.*}.mp4"; done
```

# Audio

**Cut 20 sec from beginning and fade out**
```
for i in in/*; do ffmpeg -ss 00:00:00 -i "$i" -t 00:00:20 -af "afade=t=out:st=19:d=1" "out/${${i:3}%.*}.mp3"; done
```

# Subs shifting and burn-in

Specify first subtitle timing
```
pipx install pysubs2
chmod +x subs.sh
./subs.sh -i Test.srt -t 00.00.02.280
```

Burn subtitles in
```
brew install ffmpeg-full
alias ffmpeg-full='/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
for f in movie.mp4; do ffmpeg-full -i $f -vf "subtitles=${f%.*}.srt:force_style='FontSize=20,Bold=1'" -c:v libx264 -c:a copy ${f%.*}-srt.mp4; done
```