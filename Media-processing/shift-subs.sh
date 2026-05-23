#!/bin/bash

# Usage: ./shift_subs.sh -i fichier.srt -t 00:00:01.234

while getopts "i:t:" opt; do
    case $opt in
        i) input="$OPTARG" ;;
        t) target="$OPTARG" ;;
    esac
done

# Récupère le timing du premier sous-titre (ligne "00:00:XX,XXX --> ...")
first=$(grep -m 1 "^[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\},[0-9]\{3\} -->" "$input" | awk '{print $1}')

# Convertit en millisecondes
to_ms() {
    echo "$1" | awk -F'[:,]' '{print ($1*3600 + $2*60 + $3) * 1000 + $4}'
}

first_ms=$(to_ms "$first")
# Accepte les deux formats : 00:00:01.234 et 00:00:01,234
target_clean=$(echo "$target" | tr '.' ',')
target_ms=$(to_ms "$target_clean")

diff_ms=$((target_ms - first_ms))

echo "Premier sous-titre : $first ($first_ms ms)"
echo "Cible              : $target ($target_ms ms)"
echo "Shift appliqué     : ${diff_ms}ms"

# pysubs2 --shift "${diff_ms}ms" <"$input" >"$input"

if [ $diff_ms -ge 0 ]; then
    pysubs2 --shift "${diff_ms}ms" "$input"
else
    pysubs2 --shift-back "${diff_ms#-}ms" "$input"
fi