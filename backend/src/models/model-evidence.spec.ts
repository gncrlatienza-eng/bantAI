import { bundleDigest, readArtifacts } from './model-evidence';

describe('bundleDigest', () => {
  it('matches the Python implementation byte for byte', () => {
    // Same fixture as ai/tests/test_model_evidence.py; the serving host and
    // the registry must derive identical digests from identical files.
    expect(
      bundleDigest({
        'tokenizer.json': 'c'.repeat(64),
        'config.json': 'a'.repeat(64),
        'model.safetensors': 'B'.repeat(64),
        'version.json': 'd'.repeat(64),
      }),
    ).toBe('64d70b77c8998c3f53fce19dbcdef9e6853108d005777185f2dbf90e60c28980');
  });

  it('ignores version.json, which records the other digests', () => {
    const base = { 'model.safetensors': 'b'.repeat(64) };
    expect(bundleDigest({ ...base, 'version.json': 'd'.repeat(64) })).toBe(
      bundleDigest(base),
    );
  });
});

describe('readArtifacts', () => {
  it.each([
    [{ artifacts: { 'model.safetensors': 'x' } }, /not a SHA-256/],
    [{ artifacts: { '../model.safetensors': 'a'.repeat(64) } }, /unsafe path/],
    [{ artifacts: { 'config.json': 'a'.repeat(64) } }, /model weights/],
    [{ artifacts: [] }, /must be an object/],
  ])('rejects %j', (provenance, message) => {
    const { artifacts, problems } = readArtifacts(provenance);
    expect(artifacts).toBeNull();
    expect(problems.join('; ')).toMatch(message);
  });
});
