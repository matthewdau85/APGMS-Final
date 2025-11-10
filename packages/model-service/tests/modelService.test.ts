import { createBaselineModel, describeModel, predictScores, warmupModel } from '../src/index';

describe('model service pipeline', () => {
  it('creates a model with the expected topology', () => {
    const model = createBaselineModel({ inputSize: 3, hiddenUnits: 4, learningRate: 0.001 });

    expect(model.layers).toHaveLength(2);
    expect(model.inputs[0].shape?.[1]).toBe(3);
    expect(model.outputs[0].shape?.[1]).toBe(1);
  });

  it('performs warmup without throwing', async () => {
    const model = createBaselineModel({ inputSize: 2, hiddenUnits: 2, learningRate: 0.01 });

    await expect(warmupModel(model, 2)).resolves.toBeUndefined();
  });

  it('predicts scores for the provided samples', async () => {
    const model = createBaselineModel({ inputSize: 2, hiddenUnits: 2, learningRate: 0.01 });

    const scores = await predictScores(model, [
      [0.1, 0.9],
      [0.5, 0.5]
    ]);

    expect(scores).toHaveLength(2);
    expect(scores[0]).toBeGreaterThanOrEqual(0);
    expect(scores[0]).toBeLessThanOrEqual(1);
  });

  it('describes the model with a timestamp', () => {
    const model = createBaselineModel({ inputSize: 1, hiddenUnits: 1, learningRate: 0.01 });

    const metadata = describeModel(model);

    expect(metadata.name).toBe(model.name ?? 'baseline-model');
    expect(metadata.description).toContain('Baseline dense neural network');
    expect(metadata.createdAt).toBeInstanceOf(Date);
  });
});
