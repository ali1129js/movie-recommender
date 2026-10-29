#!/usr/bin/env bash
# Downloads the raw inputs for the data build into ./raw (git-ignored) or $RECSYS_RAW_DIR.
# Nothing here is committed: raw MovieLens ratings must not be redistributed.
set -euo pipefail
RAW="${RECSYS_RAW_DIR:-raw}"
mkdir -p "$RAW"
cd "$RAW"

# MovieLens 32M (GroupLens, non-commercial research licence; see https://grouplens.org/datasets/movielens/).
if [ ! -d ml-32m ]; then
  curl -fL -o ml-32m.zip https://files.grouplens.org/datasets/movielens/ml-32m.zip
  unzip -q ml-32m.zip
fi

# IMDb non-commercial datasets (https://developer.imdb.com/non-commercial-datasets/), refreshed daily.
curl -fL -o title.ratings.tsv.gz https://datasets.imdbws.com/title.ratings.tsv.gz
curl -fL -o title.basics.tsv.gz https://datasets.imdbws.com/title.basics.tsv.gz
echo "Raw data ready in $(pwd)"
