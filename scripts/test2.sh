#!/usr/bin/env bash
# Simulate N concurrent users on devnet by running the full suite under
# different accounts in parallel. Each account = one OS process, so SDK
# state (nonce, etc.) does not collide.
#
# Logs: logs/concurrent/<timestamp>/user-<idx>.log
# Exit code: non-zero if any user failed.

set -u

ACCOUNTS=(
  "0xEb24055c8D1Ece51DF5E0551e24099578Df610Acfca:713f51a4e6d0a18605b0683b5edd27103654141e85b9464716d31cd0ab5e4e13fpr"
  "0xE824024e1C8505c8733df48f86f03eF03c0460b0fca:f208ee9088c5d08fc44c56cc09ef727112c62fcd3d1ad2059d8e9d57272bb7dafpr"
  "0xa0540B61247fBE8a63aCE615FD01b342C20ebB89fca:b3c56acdd5dff932e5c90ae482c4bbbc146f647f7e8a8684b1466df5824b4458fpr"
  "0xF4368B73CB218921A3C78d3adDe34BB53D5ddE41fca:315a25f1d77664e43b5a2ed4b117f7f643241fc6f13b99f31a57d54834923596fpr"
  "0x4D5dcAfF4686c9bC7204f49987A3314e20Fe7748fca:8924d6f7648b08cd1f6588f829927c797f8f75a1bc8dcf0017c64a9e575d6057fpr"
  "0x7b3683AC674bf94778B3197ED61A18E45F1E442afca:f7ab8b7480fda4d7b32d21bb8184574d19d651e7203e76eeed7caa81d1db4837fpr"
  "0x71D058339FE4cD125F4FFA50C593Ea3BE3Dd8305fca:1ec5bad321b1f6fd069f4a92894f44e2ed8647db8b0cdea491f0bd418b81d39ffpr"
  "0xC0CbAdeAC31EF29DAe35e235a742eD52Fd6851C2fca:b76e6d807d2088164d6e41a251a522f1d5f8cc162ad526d9bbaf29fd62d60765fpr"
  "0xbF2708f629dCB66Ec4E2fC4b87F7d19Df72f5132fca:1b69c23729f7f8a68816bb29efa31dc6f697d284d27f8e97a0fd9de0a4418dd3fpr"
  "0x1792685efee3272D508c0385D9163c1605e42053fca:f2a19a5d65b044a4c914be99882a70db97dfda7d6fe00f9761497890f4b0f275fpr"
)

# Subset of suites to run, or all when SUITES is unset.
# Example: SUITES="did dmile" ./scripts/test2.sh
SUITES_ALL=(did dmile nft prescription sc_custom)
read -r -a SUITES <<< "${SUITES:-${SUITES_ALL[*]}}"

# Concurrency: number of accounts to launch (1..10). Default = all 10.
N="${N:-${#ACCOUNTS[@]}}"

TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="logs/concurrent/$TS"
mkdir -p "$LOG_DIR"

echo "[concurrent] users=$N suites=${SUITES[*]} log_dir=$LOG_DIR"

pids=()
for ((i=0; i<N; i++)); do
  IFS=":" read -r ADDR PRIV <<< "${ACCOUNTS[$i]}"
  log="$LOG_DIR/user-$i.log"
  (
    echo "[user $i] addr=$ADDR start=$(date -Iseconds)"
    for suite in "${SUITES[@]}"; do
      echo "[user $i] >>> $suite"
      DAEGU_DEV_ADDR="$ADDR" DAEGU_DEV_PRIV="$PRIV" \
        npx mocha --require ts-node/register --extensions ts \
          "test/$suite/test_*.ts" dev,60000 \
        || { echo "[user $i] FAIL in $suite"; exit 1; }
    done
    echo "[user $i] done=$(date -Iseconds)"
  ) > "$log" 2>&1 &
  pids+=($!)
done

fail=0
for ((i=0; i<${#pids[@]}; i++)); do
  if ! wait "${pids[$i]}"; then
    echo "[concurrent] user $i FAILED — see $LOG_DIR/user-$i.log"
    fail=1
  else
    echo "[concurrent] user $i ok"
  fi
done

exit "$fail"
