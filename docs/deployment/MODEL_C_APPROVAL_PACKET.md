# Model-C release approval packet — pending signatures

Status: **PENDING; not a production approval.** Prepared 2026-09-28 for Maxene, Gio, and the advisor. Reymark has reported that the advisor selected Model-C, but the linked Drive folder contains only the ZIP, not a written sign-off. Do not turn this packet into a production `model-approval.json` by changing `approved` or `scope` without the evidence below.

## Exact artifact under review

- Drive: [2026-09-21-colab-C (LATEST)](https://drive.google.com/drive/folders/1o7qO6zcLErV50MCiIxpsKVNYk8pq2mFF)
- Local bundle: `ai/models/candidates/2026-09-21-colab-C/` (gitignored)
- Local version tag: `candidate-2026-09-21-colab-C-local`
- All SHA-256 values below were recomputed from local files on 2026-09-28; they match the local-validation-only manifest.

| File | SHA-256 |
|---|---|
| `config.json` | `f75c07a731c814da2dffe43eec21a85fa8ab9de8a3d9f7a562ba3e657eb2ba08` |
| `model.safetensors` | `85580ba9edae8ce4428ccbd09c4e80d2ba7a6aaf24c61b14c173b40ab4e8e69b` |
| `tokenizer_config.json` | `5d84c938d902dbd684af806ccc920e4c99812d897b0f271eebf856361a4337f6` |
| `tokenizer.json` | `2687cc191964de4bb7f4a43b29e7398decc0661f77e860d9c69d77a1bf6c5fdf` |
| `training_args.bin` | `39d75fea78c081cec1b4e9eb657ad7e737f18eb373a42795e82894a602c91ffe` |
| `version.json` | `b634684fd6e4007bc7f07412b9ac35b4bb0562e31d28ecd334569090d830ff4c` |

## Evidence to attach before release

1. Advisor's written selection of **this exact artifact/hash**, date, name, and document or message URL: **not supplied**.
2. Maxene's independent, previously unseen Filipino/English/Taglish holdout evaluation and acceptance thresholds: **not supplied**. The reused 3,236-row conversion holdout in `OFFLINE_AI_IMPLEMENTATION.md` is not independent generalization evidence.
3. Gio's real low-end Android fresh-install/airplane-mode SMS test, including latency, peak RAM, disk/battery and install-size acceptance: **not supplied**.
4. Cloud release test: immutable image/model binding, production `/ready`, authenticated NestJS-to-AI request, model mismatch rejection, campaign fixture, rollback and cost window: **not run**.

Only after these are reviewed should the release owners issue a *separate*, external hash-bound production manifest with `schema_version: 1`, `approved: true`, `scope: "production"`, an auditable `approval_reference`, the exact `version_tag`, and all six artifact hashes. The current service correctly refuses the local-validation manifest in production. Keep the signed approval record outside the model directory and private; a SHA-256 match establishes artifact identity, not model quality or advisor consent by itself.
