## Abstraction

- __daegu-sdk-test__ 는 [daegu_sdk](../daegu_sdk) 를 사용해서 테스트넷과 상호작용하면서 누적 회귀와 응답 시간을 관찰하기 위한 테스트 코드다.
- 현재 사용자 정의 스마트컨트랙트인 __did__, __dmile__, __nft__, __prescription__ 그리고 인라인으로 작성한 __sc_custom__(로열티 컨트랙트) 테스트가 작성되어 있다.
- 로컬 노드, dev 테스트넷, 대구 메인넷에서 동작한다.
- dev/testnet 자격증명은 `.env` 또는 shell export 로 주입한다. ***(외부에 절대 노출하지 말 것)***

<br>

## Install

이 레포지토리를 clone 한 뒤 의존성을 설치한다. [daegu_sdk](../daegu_sdk) 가 npm 에 올라가 있지 않으므로 `package.json` 에서 `file:../daegu_sdk` 로 직접 참조한다. 두 디렉터리가 **나란히** 있어야 한다.

```bash
$ git clone <repo>
$ cd daegu-sdk-test
$ npm i
```

<br>

## Structure

```bash
.
├── README.md
├── package.json
├── scripts/
│   ├── test.sh
│   └── nightly.sh
├── src/
│   ├── setting.ts
│   ├── common.ts
│   ├── testUtils.ts
│   ├── metrics.ts
│   └── sdkHelper.ts
└── test/
    ├── 0_summary/
    ├── 0_metrics/
    ├── did/
    ├── dmile/
    ├── nft/
    ├── prescription/
    └── sc_custom/
```

<br>

- **scripts**: 테스트 코드를 실행하는 shell script 모음. cron 으로 반복 실행할 때 사용한다.

- **src**: 테스트 코드에서 공통으로 쓰는 유틸들이 모여 있다.

- **src/setting.ts**: <code>setNetwork</code> 함수가 정의되어 있다. local / dev / testnet 중 어떤 네트워크에 붙을지 고르고 기본 currency 와 테스트 계정 정보를 가져온다.

- **src/common.ts**: <code>currentTime</code>, <code>sleep</code> 같이 자주 쓰는 함수가 들어있다.

- **src/testUtils.ts**: TestHelper 클래스가 정의되어 있다. summary 기록, revert 검증 등을 도와준다.

- **src/metrics.ts**: <code>measure</code> 함수가 정의되어 있다. 각 SDK 호출의 latency 와 block_height 를 CSV 한 줄로 append 한다.

- **src/sdkHelper.ts**: Mitum 의 blockHeight 콜백, daegu_sdk 안의 `.go` 파일 경로를 잡아주는 helper.

- **test/0_summary**: 회차별 PASS/FAIL 요약 파일이 쌓인다.

- **test/0_metrics**: latency 누적 CSV (`latency_<network>.csv`) 가 쌓인다. append-only.

- **test/{contract model}/test_{contract model}_model.ts**: 해당 컨트랙트의 정상 시나리오 테스트. 각 호출의 latency 를 기록한다.

- **test/{contract model}/test_{contract model}_error.ts**: 해당 컨트랙트의 revert 회귀 테스트. 새 기능이 들어와도 기존 에러 경로가 유지되는지 본다.

<br>

## Note

테스트를 돌리기 전에 아래 사항을 확인할 것:

1. dev / testnet 으로 돌릴 때는 환경변수로 자격증명을 주입한다. 값은 [src/setting.ts](src/setting.ts) 참고.

    ```bash
    export DAEGU_DEV_API="http://..."
    export DAEGU_DEV_ADDR="0x..."
    export DAEGU_DEV_PRIV="...fpr"
    export DAEGU_DEV_CURRENCY="MCC"
    ```

<br>

2. 트랜잭션을 보낸 뒤 블록에 들어갔는지 polling 으로 확인한다. polling 시간은 실행 인자로 지정한다 (millisecond).

    인자 형식은 <code>"network,timeout"</code> 이다. 너무 짧으면 timeout 으로 테스트가 일찍 죽으니 30000 정도가 적당하다.

    ```bash
    $ ./scripts/test.sh local,30000
    ```

<br>

## Usage

특정 테스트를 mocha 로 직접 돌릴 수 있다.

```bash
$ npx mocha --require ts-node/register --extensions ts test/nft/test_nft_model.ts "local,30000"
```

모델 단위로 돌리기:

```bash
$ npx mocha --require ts-node/register --extensions ts 'test/did/test_*.ts' "local,30000"
$ npx mocha --require ts-node/register --extensions ts 'test/dmile/test_*.ts' "local,30000"
$ npx mocha --require ts-node/register --extensions ts 'test/nft/test_*.ts' "local,30000"
$ npx mocha --require ts-node/register --extensions ts 'test/prescription/test_*.ts' "local,30000"
$ npx mocha --require ts-node/register --extensions ts 'test/sc_custom/test_*.ts' "local,30000"
```

전체를 한 번에 돌리고 싶으면 <code>scripts/test.sh</code> 를 쓴다.

```bash
$ ./scripts/test.sh local,30000
```

dev 넷에서 여러 계정을 동시에 돌려 동시성 부하를 보고 싶으면 <code>scripts/test2.sh</code> 를 쓴다. 미리 등록된 10개 계정을 각각 별도 프로세스로 띄워 SDK state (nonce 등) 충돌 없이 병렬 실행한다.

```bash
# 10개 계정 전부, 전체 suite
$ ./scripts/test2.sh

# 계정 수만 줄이기 (1..10)
$ N=3 ./scripts/test2.sh

# 일부 suite 만
$ SUITES="did dmile" ./scripts/test2.sh

# 조합
$ N=5 SUITES="nft prescription" ./scripts/test2.sh
```

- 각 사용자 로그는 [logs/concurrent/&lt;timestamp&gt;/user-&lt;idx&gt;.log](logs/concurrent/) 에 쌓인다.
- 한 명이라도 실패하면 종료 코드가 0이 아니고, 콘솔에 실패한 user index 와 로그 경로가 찍힌다.
- 계정/프라이빗 키는 스크립트 상단 `ACCOUNTS` 배열에 하드코딩되어 있으며 dev 넷 전용이다. 다른 환경에는 쓰지 말 것.

<br>

매일 자동으로 돌려서 추이를 보고 싶으면 <code>scripts/nightly.sh</code> 를 cron 에 등록한다.

```bash
$ crontab -e
# 매일 03:00 dev 네트워크
0 3 * * * /path/to/daegu-sdk-test/scripts/nightly.sh dev,30000 \
  >> /path/to/daegu-sdk-test/test/0_summary/cron.log 2>&1
```

<br>

## Result

- **PASS/FAIL 로그**: [test/0_summary/](test/0_summary/) 안에 회차별로 쌓인다.
- **Latency 추이**: [test/0_metrics/latency_<network>.csv](test/0_metrics/)

CSV 컬럼은 <code>timestamp, network, suite, test, op, duration_ms, block_height, ok, note</code> 이다.

며칠~몇 주 쌓이면 `block_height` 대비 `duration_ms` 산점도로 블록 누적에 따른 응답성 변화를 볼 수 있다.

<br>

> **⚠️ Note**
>
> daegu_sdk 의 typed Gno 컨트랙트는 일반 Go 가 아니다. `package contract` 필수, import allowlist (`mitum/chain`, `strconv`, `strings`, `errors`, `bytes`, `encoding/hex`, `encoding/base64`, `unicode/utf8`) 만 허용, write/query 인자는 scalar 만 가능. 자세한 건 `daegu_sdk/Contract-language-support.md` 를 볼 것.
